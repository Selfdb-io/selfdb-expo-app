import { FilePreview } from '@/components/FilePreview'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { MediaPickerSelector } from '@/components/ui/MediaPickerSelector'
import { useAuth } from '@/contexts/AuthContext'
import { db, files, storage } from '@/services/selfdb'
import { Comment } from '@/types'
import { Ionicons } from '@expo/vector-icons'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

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
              await files.deleteFile(initialComment.file_id)
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
          await files.deleteFile(initialComment.file_id)
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
      className="flex-1 bg-gray-100 dark:bg-gray-900">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-5">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-5">
            <TouchableOpacity
              className="p-2 rounded-md bg-gray-50 dark:bg-gray-800"
              onPress={onCancel}
              disabled={loading}
            >
              <Ionicons name="close" size={24} color="#007AFF" />
            </TouchableOpacity>

            <Text className="text-2xl font-bold text-gray-800 dark:text-gray-100 text-center">
              {isEditMode ? 'Edit Comment' : 'Add Comment'}
            </Text>

            <TouchableOpacity
              className="p-2 rounded-md bg-gray-50 dark:bg-gray-800"
              onPress={() => setShowDeleteDialog(true)}
              disabled={loading}
            >
              <Ionicons name="trash" size={24} color="#ff4757" />
            </TouchableOpacity>
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
              scrollEnabled={true}
              blurOnSubmit={false}
              returnKeyType="default"
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
              {selectedFile && (
                <View className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 items-center">
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
                <View className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 mt-3">
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
            <View className="flex-1">
              <MediaPickerSelector
                onFileSelected={(uri) => {
                  setSelectedFile(uri)
                  setUploadedFileId(null)
                }}
                disabled={loading}
              />
            </View>
            
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
            <View className="bg-white dark:bg-gray-800 rounded-xl p-5 mx-5 min-w-75">
              <Text className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3 text-center">
                Delete Comment?
              </Text>
              <Text className="text-sm text-gray-600 dark:text-gray-300 text-center mb-5 leading-5">
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