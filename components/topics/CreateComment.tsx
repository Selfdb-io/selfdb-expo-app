import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native'
import { useAuth } from '@/contexts/AuthContext'
import { db, storage } from '@/services/selfdb'
import { Comment } from '@/types'
import { useImagePicker } from '@/lib/deviceUtils'
import { FilePreview } from '@/components/FilePreview'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Ionicons } from '@expo/vector-icons'

interface CreateCommentProps {
  topicId: string
  onCommentCreated: (comment: Comment) => void
  onCancel: () => void
  initialComment?: Comment
  onEditComplete?: () => void
  onCommentDeleted?: () => void
  onCommentUpdated?: () => void
}

export const CreateComment: React.FC<CreateCommentProps> = ({ 
  topicId,
  onCommentCreated, 
  onCancel,
  initialComment,
  onEditComplete,
  onCommentDeleted,
  onCommentUpdated
}) => {
  const { user, isAuthenticated } = useAuth()
  const [content, setContent] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [removeCurrentFile, setRemoveCurrentFile] = useState(false)
  const isEditMode = !!initialComment

  // image-picker utilities
  const { showMediaPickerOptions, launchCamera, launchImageLibrary } = useImagePicker()

  useEffect(() => {
    if (initialComment) {
      setContent(initialComment.content)
      setAuthorName(initialComment.author_name)
      setUploadedFileId(initialComment.file_id || null)
    }
  }, [initialComment])

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert('Error', 'Please enter a comment')
      return
    }

    if (!isAuthenticated && !authorName.trim()) {
      Alert.alert('Error', 'Please enter your name')
      return
    }

    setLoading(true)

    try {
      let fileId = uploadedFileId

      // Upload new file if one is selected but not yet uploaded
      if (selectedFile && !uploadedFileId) {
        try {
          // Create a File object from the URI
          const fileInfo = await fetch(selectedFile)
          const blob = await fileInfo.blob()
          const fileName = selectedFile.split('/').pop() || 'file'
          
          const file = new File([blob], fileName, {
            type: blob.type || 'application/octet-stream'
          })
          
          const uploadResult = await storage.upload('discussion', file)
          fileId = uploadResult.file.id.toString()
        } catch (uploadError) {
          console.error('Failed to upload file:', uploadError)
          Alert.alert('Error', 'Failed to upload file. Please try again.')
          setLoading(false)
          return
        }
      }

      if (isEditMode && initialComment) {
        // Update comment
        let finalFileId = fileId

        // Handle file removal if user marked current file for removal
        if (removeCurrentFile && !selectedFile) {
          finalFileId = null
        }

        const updatedCommentData = {
          content: content.trim(),
          file_id: finalFileId
        }

        try {
          await db
            .from('comments')
            .where('id', initialComment.id)
            .update(updatedCommentData)

          // Delete old file only after successful update and if we're replacing with a new file OR removing it
          if (initialComment.file_id && (
            (selectedFile && fileId !== initialComment.file_id) || // Replacing with new file
            (removeCurrentFile && !selectedFile) // Removing current file
          )) {
            try {
              await storage.files.deleteFile('discussion', initialComment.file_id)
            } catch (deleteError) {
              console.warn('Could not delete old file:', deleteError)
              // Continue even if old file deletion fails
            }
          }

          const updatedComment: Comment = {
            ...initialComment,
            ...updatedCommentData,
            file_id: updatedCommentData.file_id || undefined
          }

          onCommentCreated(updatedComment)
          
          // Call onCommentUpdated to trigger refetch in parent component  
          if (onCommentUpdated) {
            onCommentUpdated()
          }
          
          if (onEditComplete) {
            onEditComplete()
          }
        } catch (updateError) {
          console.error('Failed to update comment in database:', updateError)
          throw new Error('Database update failed')
        }
      } else {
        // Create new comment
        const commentData = {
          topic_id: topicId,
          content: content.trim(),
          author_name: isAuthenticated ? user!.email : authorName.trim(),
          user_id: isAuthenticated ? user!.id : undefined,
          file_id: fileId || null
        }

        console.log('Creating comment with data:', commentData)
        try {
          const newComment = await db.from('comments').insert(commentData) as unknown as Comment
          console.log('Comment created:', newComment)
          
          onCommentCreated(newComment)
        } catch (createError) {
          console.error('Failed to create comment in database:', createError)
          throw new Error('Failed to create comment')
        }
      }
      
      // Reset form
      setContent('')
      setAuthorName('')
      setSelectedFile(null)
      setUploadedFileId(null)
      setRemoveCurrentFile(false)
      onCancel()
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} comment:`, error)
      Alert.alert('Error', `Failed to ${isEditMode ? 'update' : 'create'} comment. Please try again.`)
    } finally {
      setLoading(false)
    }
  }

  const openCamera = async () => {
    try {
      const result = await launchCamera()
      
      if (!result) {
        Alert.alert(
          'Camera Error', 
          'Failed to open camera. This might be because you\'re using a simulator. Please try using Photo Library instead.'
        )
        return
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        setSelectedFile(asset.uri)
        setUploadedFileId(null)
      }
    } catch (error) {
      console.error('Error opening camera:', error)
      Alert.alert(
        'Camera Error', 
        'Failed to open camera. This might be because you\'re using a simulator. Please try using Photo Library instead.'
      )
    }
  }

  const openLibrary = async () => {
    try {
      const result = await launchImageLibrary()
      
      if (!result) {
        Alert.alert('Error', 'Failed to access photo library. Please check permissions.')
        return
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        setSelectedFile(asset.uri)
        setUploadedFileId(null)
      }
    } catch (error) {
      console.error('Error picking from library:', error)
      Alert.alert('Error', 'Failed to pick media file.')
    }
  }

  const pickMedia = async () => {
    try {
      const options = await showMediaPickerOptions(openCamera, openLibrary)
      
      Alert.alert(
        'Select Media',
        'Choose how you want to add media',
        options
      )
    } catch (error) {
      console.error('Error showing media options:', error)
      Alert.alert('Error', 'Failed to show media options.')
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
    setUploadedFileId(null)
  }

  const handleRemoveCurrentFile = () => {
    setRemoveCurrentFile(true)
    setUploadedFileId(null)
  }

  const handleDeleteComment = async () => {
    if (!initialComment) return

    try {
      setLoading(true)

      // Delete attached file if it exists
      if (initialComment.file_id) {
        try {
          await storage.files.deleteFile('discussion', initialComment.file_id)
        } catch (deleteError) {
          console.warn('Could not delete comment file:', deleteError)
          // Continue with comment deletion even if file deletion fails
        }
      }

      // Delete comment using query builder API
      await db
        .from('comments')
        .where('id', initialComment.id)
        .delete()

      Alert.alert('Success', 'Comment deleted successfully')

      // Call onCommentDeleted to update parent component
      if (onCommentDeleted) {
        onCommentDeleted()
      }

      // Close modal
      onCancel()
    } catch (error) {
      console.error('Failed to delete comment:', error)
      Alert.alert('Error', 'Failed to delete comment. Please try again.')
    } finally {
      setLoading(false)
      setShowDeleteDialog(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-100"
    >
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-5">
          {/* Header with cancel button */}
          <View className="flex-row justify-between items-center mb-5">
            <TouchableOpacity
              className="p-2 rounded-md bg-gray-50"
              onPress={onCancel}
              disabled={loading}
            >
              <Ionicons name="close" size={24} color="#007AFF" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-gray-800 text-center">
              {isEditMode ? 'Edit Comment' : 'Add Comment'}
            </Text>
            {isEditMode ? (
              <TouchableOpacity
                className="p-2 rounded-md bg-gray-50"
                onPress={() => setShowDeleteDialog(true)}
                disabled={loading}
              >
                <Ionicons name="trash" size={24} color="#ff4757" />
              </TouchableOpacity>
            ) : (
              <View className="w-10" />
            )}
          </View>
          
          <View className="mb-8">
            <Input
              className="h-30 pt-3"
              placeholder="Write your comment..."
              placeholderTextColor="#666"
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              autoFocus
            />
            
            {!isAuthenticated && !isEditMode && (
              <Input
                className="mt-4"
                placeholder="Your name"
                placeholderTextColor="#666"
                value={authorName}
                onChangeText={setAuthorName}
              />
            )}

            {/* File Upload Section */}
            <View className="mt-4">
              <TouchableOpacity
                className="bg-gray-50 border border-gray-300 rounded-lg py-3 px-4 items-center mb-3"
                onPress={pickMedia}
                disabled={loading}
              >
                <Text className="text-primary-500 text-base font-medium">
                  📷 {isEditMode && initialComment?.file_id ? 'Replace Photo or Video' : 'Add Photo or Video'}
                </Text>
              </TouchableOpacity>

              {selectedFile && (
                <View className="bg-gray-50 border border-gray-300 rounded-lg p-3 items-center">
                  <View className="w-full mb-3">
                    <FilePreview 
                      localUri={selectedFile}
                      style={{ width: '100%', height: 250 }}
                    />
                  </View>
                  <TouchableOpacity
                    className="bg-red-500 py-2 px-3 rounded-md"
                    onPress={removeFile}
                  >
                    <Text className="text-white text-sm font-medium">✕ Remove</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Show current file if editing and no new file selected */}
              {isEditMode && initialComment?.file_id && !selectedFile && !removeCurrentFile && (
                <View className="bg-gray-50 border border-gray-300 rounded-lg p-3 mt-3">
                  <View className="w-full mb-3">
                    <FilePreview 
                      fileId={initialComment.file_id} 
                      style={{ width: '100%', height: 250 }}
                    />
                  </View>
                  <TouchableOpacity
                    className="bg-red-500 py-2 px-3 rounded-md"
                    onPress={handleRemoveCurrentFile}
                    disabled={loading}
                  >
                    <Text className="text-white text-sm font-medium">✕ Remove</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Show removal notice if file is marked for removal */}
              {isEditMode && initialComment?.file_id && !selectedFile && removeCurrentFile && (
                <View className="bg-red-50 border border-red-500 rounded-lg p-4 mt-3">
                  <View className="flex-row items-center justify-between">
                    <Ionicons name="warning" size={20} color="#ff4757" />
                    <Text className="text-red-500 text-sm font-medium flex-1 ml-2">
                      Attachment will be removed when you update
                    </Text>
                    <TouchableOpacity
                      className="bg-primary-500 py-1.5 px-3 rounded-md"
                      onPress={() => setRemoveCurrentFile(false)}
                      disabled={loading}
                    >
                      <Text className="text-white text-xs font-medium">Undo</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
          
          <View className="flex-row justify-between gap-4">
            <Button
              title="Cancel"
              variant="outline"
              onPress={onCancel}
              disabled={loading}
              className="flex-1"
            />
            
            <TouchableOpacity
              className={`flex-1 bg-primary-500 py-4 rounded-lg items-center justify-center ${loading ? 'opacity-60' : ''}`}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white text-base font-semibold">
                  {isEditMode ? 'Update' : 'Post'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      
      {/* Delete Confirmation Modal */}
      {isEditMode && (
        <Modal
          visible={showDeleteDialog}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteDialog(false)}
        >
          <View className="flex-1 bg-black/50 justify-center items-center">
            <View className="bg-white rounded-xl p-5 mx-5 min-w-75">
              <Text className="text-lg font-bold text-gray-800 mb-3 text-center">
                Delete Comment?
              </Text>
              <Text className="text-sm text-gray-600 text-center mb-5 leading-5">
                This action cannot be undone. This will permanently delete this comment.
              </Text>
              <View className="flex-row gap-3">
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setShowDeleteDialog(false)}
                  className="flex-1"
                />
                <TouchableOpacity
                  className={`flex-1 bg-red-500 py-3 rounded-lg items-center justify-center ${loading ? 'opacity-60' : ''}`}
                  onPress={handleDeleteComment}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text className="text-white text-base font-semibold">Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </KeyboardAvoidingView>
  )
}