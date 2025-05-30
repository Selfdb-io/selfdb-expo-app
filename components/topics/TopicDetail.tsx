import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/AuthContext'
import { db, storage } from '@/services/selfdb'
import { Topic, Comment } from '@/types'
import { formatDate } from '@/lib/utils'
import { FilePreview } from '@/components/FilePreview'
import { showMediaPickerOptions, safeLaunchCamera, safeLaunchImageLibrary } from '@/lib/deviceUtils'

interface TopicDetailProps {
  topicId: string
  onBack?: () => void
}

export const TopicDetail: React.FC<TopicDetailProps> = ({ topicId, onBack }) => {
  const { user, isAuthenticated } = useAuth()
  const [topic, setTopic] = useState<Topic | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [showAddComment, setShowAddComment] = useState(false)

  useEffect(() => {
    if (topicId) {
      loadTopicAndComments()
    }
  }, [topicId])

  const loadTopicAndComments = async () => {
    try {
      setLoading(true)
      
      // Load topic using proper query builder API
      const topicData = await db
        .from('topics')
        .where('id', topicId)
        .single()
      
      if (!topicData) {
        throw new Error('Topic not found')
      }
      
      const loadedTopic = topicData as unknown as Topic
      setTopic(loadedTopic)

      // Load comments for this topic using proper query builder API
      const commentsData = await db
        .from('comments')
        .where('topic_id', loadedTopic.id)
        .order('created_at', 'asc')
        .execute()
      
      setComments(commentsData as unknown as Comment[])
    } catch (error) {
      console.error('Failed to load topic and comments:', error)
      Alert.alert('Error', 'Failed to load topic')
    } finally {
      setLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!commentText.trim()) {
      Alert.alert('Error', 'Please enter a comment')
      return
    }

    if (!isAuthenticated && !authorName.trim()) {
      Alert.alert('Error', 'Please enter your name')
      return
    }

    if (!topic) return

    setSubmitting(true)

    try {
      let fileId: string | undefined

      // Upload file if one is selected
      if (selectedFile) {
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

      const commentData = {
        topic_id: topic.id,
        content: commentText.trim(),
        author_name: isAuthenticated ? user!.email : authorName.trim(),
        user_id: isAuthenticated ? user!.id : undefined,
        file_id: fileId,
      }

      const newComment = await db.from('comments').insert(commentData) as unknown as Comment
      setComments(prev => [...prev, newComment])
      
      setCommentText('')
      setAuthorName('')
      setSelectedFile(null)
      setShowAddComment(false)
    } catch (error) {
      console.error('Failed to add comment:', error)
      Alert.alert('Error', 'Failed to add comment')
    } finally {
      setSubmitting(false)
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
      }
    } catch (error) {
      console.error('Error picking from library:', error)
      Alert.alert('Error', 'Failed to pick media file.')
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading topic...</Text>
      </View>
    )
  }

  if (!topic) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Topic not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => onBack ? onBack() : router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Topic Header with Back Button and Title */}
        <View style={styles.topicContainer}>
          <View style={styles.topicHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => onBack ? onBack() : router.back()}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.topicTitle}>{topic.title}</Text>
          </View>
          <Text style={styles.topicContent}>{topic.content}</Text>
          {topic.file_id && (
            <View style={styles.topicImageContainer}>
              <FilePreview fileId={topic.file_id} style={styles.topicImage} />
            </View>
          )}
          <View style={styles.topicMeta}>
            <Text style={styles.author}>By {topic.author_name}</Text>
            <Text style={styles.date}>{formatDate(topic.created_at)}</Text>
          </View>
        </View>

        {/* Comments */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>
            Comments ({comments.length})
          </Text>
          
          {comments.map((comment) => (
            <View key={comment.id} style={styles.commentCard}>
              <Text style={styles.commentContent}>{comment.content}</Text>
              {comment.file_id && (
                <View style={styles.commentImageContainer}>
                  <FilePreview fileId={comment.file_id} style={styles.commentImage} />
                </View>
              )}
              <View style={styles.commentMeta}>
                <Text style={styles.commentAuthor}>{comment.author_name}</Text>
                <Text style={styles.commentDate}>
                  {formatDate(comment.created_at)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Floating Add Comment Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddComment(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="chatbubble-ellipses" size={28} color="white" />
      </TouchableOpacity>

      {/* Add Comment Modal */}
      <Modal
        visible={showAddComment}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddComment(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowAddComment(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Comment</Text>
            <TouchableOpacity
              style={[styles.modalSubmitButton, submitting && styles.buttonDisabled]}
              onPress={handleAddComment}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#007AFF" size="small" />
              ) : (
                <Text style={styles.modalSubmitText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <TextInput
              style={[styles.input, styles.commentInput]}
              placeholder="Write your comment..."
              placeholderTextColor="#666"
              value={commentText}
              onChangeText={setCommentText}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              autoFocus
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
                disabled={submitting}
              >
                <View style={styles.uploadButtonContent}>
                  <Ionicons name="camera" size={20} color="#007AFF" style={styles.uploadIcon} />
                  <Text style={styles.uploadButtonText}>Add Photo or Video</Text>
                </View>
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
                    <Ionicons name="close-circle" size={20} color="white" />
                    <Text style={styles.removeFileText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  errorText: {
    color: '#ff4757',
    fontSize: 18,
    marginBottom: 20,
  },
  topicHeader: {
    marginBottom: 15,
  },
  backButton: {
    paddingVertical: 5,
    marginBottom: 15,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  topicContainer: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 20,
  },
  topicTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    lineHeight: 34,
  },
  topicContent: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 20,
  },
  topicImageContainer: {
    marginBottom: 20,
  },
  topicImage: {
    height: 250,
    borderRadius: 8,
  },
  topicMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  author: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  date: {
    fontSize: 14,
    color: '#999',
  },
  commentsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  commentCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  commentContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 10,
  },
  commentImageContainer: {
    marginBottom: 10,
  },
  commentImage: {
    height: 150,
    borderRadius: 6,
  },
  commentMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commentAuthor: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  commentDate: {
    fontSize: 12,
    color: '#999',
  },
  addCommentSection: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 20,
  },
  addCommentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
  },
  commentInput: {
    height: 80,
    paddingTop: 12,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
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
  uploadButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  removeFileText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  // Floating Action Button styles
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    right: 20,
    bottom: 20,
    backgroundColor: '#007AFF',
    borderRadius: 28,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    zIndex: 1000,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalCancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalCancelText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalSubmitButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalSubmitText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  uploadIcon: {
    marginRight: 8,
  },
})
