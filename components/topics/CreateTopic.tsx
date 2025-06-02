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
import { Topic } from '@/types'
import { useImagePicker } from '@/lib/deviceUtils'
import { FilePreview } from '@/components/FilePreview'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'

interface CreateTopicProps {
  onTopicCreated: (topic: Topic) => void
  onCancel: () => void
  initialTopic?: Topic
  onEditComplete?: () => void
  onBack?: () => void
  onTopicDeleted?: () => void
  onTopicUpdated?: () => void
}

export const CreateTopic: React.FC<CreateTopicProps> = ({ 
  onTopicCreated, 
  onCancel,
  initialTopic,
  onEditComplete,
  onBack,
  onTopicDeleted,
  onTopicUpdated
}) => {
  const { user, isAuthenticated } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [removeCurrentFile, setRemoveCurrentFile] = useState(false)
  const isEditMode = !!initialTopic

  // image-picker utilities
  const { launchCamera, launchImageLibrary } = useImagePicker()

  useEffect(() => {
    if (initialTopic) {
      setTitle(initialTopic.title)
      setContent(initialTopic.content)
      setAuthorName(initialTopic.author_name)
      setUploadedFileId(initialTopic.file_id || null)
    }
  }, [initialTopic])

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title')
      return
    }

    if (!content.trim()) {
      Alert.alert('Error', 'Please enter content')
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

      if (isEditMode && initialTopic) {
        // Update topic
        let finalFileId = fileId

        // Handle file removal if user marked current file for removal
        if (removeCurrentFile && !selectedFile) {
          finalFileId = null
        }

        const updatedTopicData = {
          title: title.trim(),
          content: content.trim(),
          file_id: finalFileId
        }

        try {
          await db
            .from('topics')
            .where('id', initialTopic.id)
            .update(updatedTopicData)

          // Delete old file only after successful update and if we're replacing with a new file OR removing it
          if (initialTopic.file_id && (
            (selectedFile && fileId !== initialTopic.file_id) || // Replacing with new file
            (removeCurrentFile && !selectedFile) // Removing current file
          )) {
            try {
              await storage.files.deleteFile('discussion', initialTopic.file_id)
            } catch (deleteError) {
              console.warn('Could not delete old file:', deleteError)
              // Continue even if old file deletion fails
            }
          }

          const updatedTopic: Topic = {
            ...initialTopic,
            ...updatedTopicData,
            file_id: updatedTopicData.file_id || undefined
          }

          onTopicCreated(updatedTopic)
          
          // Call onTopicUpdated to trigger refetch in parent component  
          if (onTopicUpdated) {
            onTopicUpdated()
          }
          
          if (onEditComplete) {
            onEditComplete()
          }
        } catch (updateError) {
          console.error('Failed to update topic in database:', updateError)
          throw new Error('Database update failed')
        }
      } else {
        // Create new topic
        const topicData = {
          title: title.trim(),
          content: content.trim(),
          author_name: isAuthenticated ? user!.email : authorName.trim(),
          user_id: isAuthenticated ? user!.id : undefined,
          file_id: fileId || null
        }

        console.log('Creating topic with data:', topicData)
        try {
          const newTopic = await db.from('topics').insert(topicData) as unknown as Topic
          console.log('Topic created:', newTopic)
          
          onTopicCreated(newTopic)
        } catch (createError) {
          console.error('Failed to create topic in database:', createError)
          throw new Error('Failed to create topic')
        }
      }
      
      // Reset form
      setTitle('')
      setContent('')
      setAuthorName('')
      setSelectedFile(null)
      setUploadedFileId(null)
      setRemoveCurrentFile(false)
      onCancel()
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} topic:`, error)
      Alert.alert('Error', `Failed to ${isEditMode ? 'update' : 'create'} topic. Please try again.`)
    } finally {
      setLoading(false)
    }
  }

  const pickMedia = async () => {
    Alert.alert(
      'Select Media',
      'Choose how you want to add media',
      [
        {
          text: 'Camera',
          onPress: openCamera,
        },
        {
          text: 'Photo Library',
          onPress: openLibrary,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    )
  }

  const openCamera = async () => {
    const result = await launchCamera()
    
    if (result && !result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setSelectedFile(asset.uri)
      setUploadedFileId(null)
    } else if (result === null) {
      Alert.alert(
        'Camera Error', 
        'Failed to open camera. This might be because you\'re using a simulator or permissions were denied.'
      )
    }
    // If result.canceled is true, user cancelled - no action needed
  }

  const openLibrary = async () => {
    const result = await launchImageLibrary()
    
    if (result && !result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setSelectedFile(asset.uri)
      setUploadedFileId(null)
    } else if (result === null) {
      Alert.alert('Error', 'Failed to access photo library. Please check permissions in Settings.')
    }
    // If result.canceled is true, user cancelled - no action needed
  }

  const removeFile = () => {
    setSelectedFile(null)
    setUploadedFileId(null)
  }

  const handleRemoveCurrentFile = () => {
    setRemoveCurrentFile(true)
    setUploadedFileId(null)
  }

  const handleDeleteTopic = async () => {
    if (!initialTopic) return

    try {
      setLoading(true)

      // Delete attached file if it exists
      if (initialTopic.file_id) {
        try {
          await storage.files.deleteFile('discussion', initialTopic.file_id)
        } catch (deleteError) {
          console.warn('Could not delete topic file:', deleteError)
          // Continue with topic deletion even if file deletion fails
        }
      }

      // Delete all comments associated with this topic first
      try {
        await db
          .from('comments')
          .where('topic_id', initialTopic.id)
          .delete()
      } catch (commentsDeleteError) {
        console.warn('Could not delete topic comments:', commentsDeleteError)
        // Continue with topic deletion
      }

      // Delete topic using query builder API
      await db
        .from('topics')
        .where('id', initialTopic.id)
        .delete()

      Alert.alert('Success', 'Topic deleted successfully')

      // Call onTopicDeleted to trigger refetch in parent component
      if (onTopicDeleted) {
        onTopicDeleted()
      }

      // Navigate back
      if (onBack) {
        onBack()
      } else if (onCancel) {
        onCancel()
      } else {
           router.replace('/')
      }
    } catch (error) {
      console.error('Failed to delete topic:', error)
      Alert.alert('Error', 'Failed to delete topic. Please try again.')
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
              disabled={loading}>
              <Ionicons name="close" size={24} color="#007AFF" />
            </TouchableOpacity>

            <Text className="text-2xl font-bold text-gray-800 dark:text-gray-100 text-center">
              {isEditMode ? 'Edit Topic' : 'Create New Topic'}
            </Text>

            {isEditMode ? (
              <TouchableOpacity
                className="p-2 rounded-md bg-gray-50 dark:bg-gray-800"
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
              placeholder="Topic title"
              placeholderTextColor="#666"
              value={title}
              onChangeText={setTitle}
              autoFocus
              className="mb-4"
            />
            
            <Input
              className="h-30 pt-3"
              placeholder="What would you like to discuss?"
              placeholderTextColor="#666"
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
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
              className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg py-3 px-4 items-center mb-3"
              onPress={pickMedia}
              disabled={loading}
            >
              <Text className="text-primary-500 text-base font-medium">
                📷 {isEditMode && initialTopic?.file_id ? 'Replace Photo or Video' : 'Add Photo or Video'}
              </Text>
            </TouchableOpacity>

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
              {isEditMode && initialTopic?.file_id && !selectedFile && !removeCurrentFile && (
                <View className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 mt-3">
                  <View className="w-full mb-3">
                    <FilePreview 
                      fileId={initialTopic.file_id}
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
              {isEditMode && initialTopic?.file_id && !selectedFile && removeCurrentFile && (
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
                  {isEditMode ? 'Update Topic' : 'Create Topic'}
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
                Delete Topic?
              </Text>
              <Text className="text-sm text-gray-600 dark:text-gray-300 text-center mb-5 leading-5">
                This action cannot be undone. This will permanently delete the topic and all its comments.
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
                  onPress={handleDeleteTopic}
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
