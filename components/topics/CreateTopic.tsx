import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native'
import { Image } from 'expo-image'
import { useAuth } from '@/contexts/AuthContext'
import { db, storage } from '@/services/selfdb'
import { Topic } from '@/types'
import { showMediaPickerOptions, safeLaunchCamera, safeLaunchImageLibrary } from '@/lib/deviceUtils'
import { FilePreview } from '@/components/FilePreview'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'

interface CreateTopicProps {
  onTopicCreated: (topic: Topic) => void
  onCancel: () => void
  initialTopic?: Topic
  onEditComplete?: () => void
  onBack?: () => void
}

export const CreateTopic: React.FC<CreateTopicProps> = ({ 
  onTopicCreated, 
  onCancel,
  initialTopic,
  onEditComplete,
  onBack
}) => {
  const { user, isAuthenticated } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const isEditMode = !!initialTopic

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

      // Handle file replacement in edit mode
      if (selectedFile && isEditMode && initialTopic?.file_id) {
        try {
          const buckets = await storage.buckets.listBuckets()
          const discussionBucket = buckets.find(b => b.name === 'discussion')
          if (discussionBucket) {
            await storage.files.deleteFile(discussionBucket.id, initialTopic.file_id)
          }
        } catch (deleteError) {
          console.warn('Could not delete old file:', deleteError)
        }
      }

      // Upload file if one is selected but not yet uploaded
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
        const updatedTopicData = {
          title: title.trim(),
          content: content.trim(),
          file_id: fileId || null
        }

        try {
          await db
            .from('topics')
            .where('id', initialTopic.id)
            .update(updatedTopicData)

          const updatedTopic: Topic = {
            ...initialTopic,
            ...updatedTopicData,
            file_id: updatedTopicData.file_id || undefined
          }

          onTopicCreated(updatedTopic)
          
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
      onCancel()
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} topic:`, error)
      Alert.alert('Error', `Failed to ${isEditMode ? 'update' : 'create'} topic. Please try again.`)
    } finally {
      setLoading(false)
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

  const openCamera = async () => {
    try {
      const result = await safeLaunchCamera()
      
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
      const result = await safeLaunchImageLibrary()
      
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

  const removeFile = () => {
    setSelectedFile(null)
    setUploadedFileId(null)
  }

  const handleRemoveCurrentFile = async () => {
    if (!initialTopic?.file_id) return

    Alert.alert(
      'Remove Attachment',
      'Are you sure you want to remove the current attachment?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true)
              
              // Delete file from storage
              const buckets = await storage.buckets.listBuckets()
              const discussionBucket = buckets.find(b => b.name === 'discussion')
              if (discussionBucket) {
                await storage.files.deleteFile(discussionBucket.id, initialTopic.file_id!)
              }

              // Update topic in database to remove file_id
              await db
                .from('topics')
                .where('id', initialTopic.id)
                .update({ file_id: null })

              // Update local state
              const updatedTopic: Topic = {
                ...initialTopic,
                file_id: undefined
              }
              
              onTopicCreated(updatedTopic)
              setUploadedFileId(null)
              
              Alert.alert('Success', 'Attachment removed successfully')
            } catch (error) {
              console.error('Failed to remove file:', error)
              Alert.alert('Error', 'Failed to remove attachment. Please try again.')
            } finally {
              setLoading(false)
            }
          },
        },
      ]
    )
  }

  const handleDeleteTopic = async () => {
    if (!initialTopic) return

    try {
      setLoading(true)

      // Delete attached file if it exists
      if (initialTopic.file_id) {
        try {
          const buckets = await storage.buckets.listBuckets()
          const discussionBucket = buckets.find(b => b.name === 'discussion')
          if (discussionBucket) {
            await storage.files.deleteFile(discussionBucket.id, initialTopic.file_id)
          }
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

      // Navigate back
      if (onBack) {
        onBack()
      } else if (onCancel) {
        onCancel()
      } else {
        router.back()
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
      style={styles.container}
    >
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header with cancel button */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.cancelHeaderButton}
              onPress={onCancel}
              disabled={loading}
            >
              <Ionicons name="close" size={24} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.title}>{isEditMode ? 'Edit Topic' : 'Create New Topic'}</Text>
            {isEditMode ? (
              <TouchableOpacity
                style={styles.deleteHeaderButton}
                onPress={() => setShowDeleteDialog(true)}
                disabled={loading}
              >
                <Ionicons name="trash" size={24} color="#ff4757" />
              </TouchableOpacity>
            ) : (
              <View style={styles.placeholder} />
            )}
          </View>
          
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Topic title"
              placeholderTextColor="#666"
              value={title}
              onChangeText={setTitle}
              autoFocus
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What would you like to discuss?"
              placeholderTextColor="#666"
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            
            {!isAuthenticated && !isEditMode && (
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor="#666"
                value={authorName}
                onChangeText={setAuthorName}
              />
            )}

          {/* File Upload Section */}
          <View style={styles.fileSection}>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={pickMedia}
              disabled={loading}
            >
              <Text style={styles.uploadButtonText}>
                📷 {isEditMode && initialTopic?.file_id ? 'Replace Photo or Video' : 'Add Photo or Video'}
              </Text>
            </TouchableOpacity>

              {selectedFile && (
                <View style={styles.filePreview}>
                  <Image 
                    source={{ uri: selectedFile }} 
                    style={styles.previewImage}
                    contentFit="cover"
                  />
                  <TouchableOpacity
                    style={styles.removeFileButton}
                    onPress={removeFile}
                  >
                    <Text style={styles.removeFileText}>✕ Remove</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Show current file if editing and no new file selected */}
              {isEditMode && initialTopic?.file_id && !selectedFile && (
                <View style={styles.currentFilePreview}>
                  <View style={styles.currentFileHeader}>
                    <Text style={styles.currentFileText}>Current attachment:</Text>
                    <TouchableOpacity
                      style={styles.removeCurrentFileButton}
                      onPress={handleRemoveCurrentFile}
                      disabled={loading}
                    >
                      <Ionicons name="close-circle" size={20} color="#ff4757" />
                      <Text style={styles.removeCurrentFileText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                  <FilePreview fileId={initialTopic.file_id} style={styles.currentFileImage} />
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.createButton, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.createButtonText}>{isEditMode ? 'Update Topic' : 'Create Topic'}</Text>
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
          <View style={styles.deleteModalOverlay}>
            <View style={styles.deleteModalContent}>
              <Text style={styles.deleteModalTitle}>Delete Topic?</Text>
              <Text style={styles.deleteModalText}>
                This action cannot be undone. This will permanently delete the topic and all its comments.
              </Text>
              <View style={styles.deleteModalActions}>
                <TouchableOpacity
                  style={styles.deleteModalCancel}
                  onPress={() => setShowDeleteDialog(false)}
                >
                  <Text style={styles.deleteModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteModalConfirm}
                  onPress={handleDeleteTopic}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.deleteModalConfirmText}>Delete</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  form: {
    marginBottom: 30,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 120,
    paddingTop: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  cancelButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#007AFF',
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  fileSection: {
    marginBottom: 15,
  },
  uploadButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  uploadButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  filePreview: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 150,
    borderRadius: 6,
    marginBottom: 10,
  },
  removeFileButton: {
    backgroundColor: '#ff4757',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  removeFileText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cancelHeaderButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
  },
  placeholder: {
    width: 40, // Same width as cancel button to center title
  },
  // Current file preview styles
  currentFilePreview: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  currentFileText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  currentFileImage: {
    borderRadius: 6,
    minHeight: 150,
    maxHeight: 300,
  },
  // Delete button styles
  deleteHeaderButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
  },
  // Delete modal styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    minWidth: 300,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  deleteModalText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  deleteModalCancel: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  deleteModalCancelText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteModalConfirm: {
    backgroundColor: '#ff4757',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  deleteModalConfirmText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Current file styles
  currentFileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  removeCurrentFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff4757',
    padding: 8,
    borderRadius: 6,
  },
  removeCurrentFileText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 5,
  },
})
