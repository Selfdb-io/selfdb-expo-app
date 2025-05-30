import React, { useState } from 'react'
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
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '@/contexts/AuthContext'
import { db, storage } from '@/services/selfdb'
import { Topic } from '@/types'

interface CreateTopicProps {
  onTopicCreated: (topic: Topic) => void
  onCancel: () => void
}

export const CreateTopic: React.FC<CreateTopicProps> = ({ 
  onTopicCreated, 
  onCancel 
}) => {
  const { user, isAuthenticated } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null)

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

      // Upload file if one is selected but not yet uploaded
      if (selectedFile && !uploadedFileId) {
        // Create a File object from the URI
        const fileInfo = await fetch(selectedFile)
        const blob = await fileInfo.blob()
        const fileName = selectedFile.split('/').pop() || 'file'
        
        const file = new File([blob], fileName, {
          type: blob.type || 'application/octet-stream'
        })
        
        const uploadResult = await storage.upload('discussion', file)
        fileId = uploadResult.file.id.toString()
      }

      const topicData = {
        title: title.trim(),
        content: content.trim(),
        author_name: isAuthenticated ? user!.email : authorName.trim(),
        user_id: isAuthenticated ? user!.id : undefined,
        file_id: fileId
      }

      console.log('Creating topic with data:', topicData)
      const newTopic = await db.from('topics').insert(topicData) as unknown as Topic
      console.log('Topic created:', newTopic)
      
      onTopicCreated(newTopic)
      
      // Reset form
      setTitle('')
      setContent('')
      setAuthorName('')
      setSelectedFile(null)
      setUploadedFileId(null)
    } catch (error) {
      console.error('Failed to create topic:', error)
      Alert.alert('Error', 'Failed to create topic. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const pickMedia = async () => {
    try {
      Alert.alert(
        'Select Media',
        'Choose how you want to add media',
        [
          {
            text: 'Camera',
            onPress: () => openCamera(),
          },
          {
            text: 'Photo Library',
            onPress: () => openLibrary(),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      )
    } catch (error) {
      console.error('Error showing media options:', error)
      Alert.alert('Error', 'Failed to show media options.')
    }
  }

  const openCamera = async () => {
    try {
      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access the camera.')
        return
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        setSelectedFile(asset.uri)
        setUploadedFileId(null)
      }
    } catch (error) {
      console.error('Error opening camera:', error)
      Alert.alert('Error', 'Failed to open camera.')
    }
  }

  const openLibrary = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library.')
        return
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All, // Allows both images and videos
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: false,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        setSelectedFile(asset.uri)
        setUploadedFileId(null) // Reset uploaded file ID
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.title}>Create New Topic</Text>
          
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
            
            {!isAuthenticated && (

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
                📷 Add Photo or Video
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
                <Text style={styles.createButtonText}>Create Topic</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
})
