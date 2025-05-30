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
import { db, storage, realtime } from '@/services/selfdb'
import { Topic, Comment } from '@/types'
import { formatDate } from '@/lib/utils'
import { FilePreview } from '@/components/FilePreview'
import { showMediaPickerOptions, safeLaunchCamera, safeLaunchImageLibrary } from '@/lib/deviceUtils'
import { canModifyContent } from '@/lib/permissions'
import { CreateTopic } from '@/components/topics/CreateTopic'

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
  
  // Topic edit/delete state
  const [isEditingTopic, setIsEditingTopic] = useState(false)
  
  // Comment edit/delete state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentContent, setEditCommentContent] = useState('')
  const [editCommentFile, setEditCommentFile] = useState<string | null>(null)
  const [editCommentAuthorName, setEditCommentAuthorName] = useState('')
  const [showDeleteCommentDialog, setShowDeleteCommentDialog] = useState(false)
  const [commentToDelete, setCommentToDelete] = useState<Comment | null>(null)

  useEffect(() => {
    if (topicId) {
      loadTopicAndComments()
    }

    // Store subscription references
    let topicsSubscription: any = null
    let commentsSubscription: any = null

    // Set up realtime subscriptions
    const setupRealtime = async () => {
      try {
        await realtime.connect()
        
        // Subscribe to topics changes
        topicsSubscription = realtime.subscribe('topics', (payload: any) => {
          console.log('Topic realtime update:', payload)
          
          if (payload.eventType === 'DELETE' && payload.old?.id?.toString() === topicId) {
            // Topic was deleted, navigate back
            console.log('Topic deleted, navigating back')
            Alert.alert(
              'Topic Deleted',
              'This topic has been deleted.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    if (onBack) {
                      onBack()
                    } else {
                      router.back()
                    }
                  }
                }
              ]
            )
          } else if (payload.eventType === 'UPDATE' && payload.new?.id?.toString() === topicId) {
            // Topic was updated
            const updatedTopic = payload.new as Topic
            console.log('Topic updated:', updatedTopic.id)
            setTopic(updatedTopic)
          }
        })
        
        // Subscribe to comments changes
        commentsSubscription = realtime.subscribe('comments', (payload: any) => {
          console.log('Comments realtime update:', payload)
          
          if (payload.eventType === 'DELETE') {
            // Remove deleted comment from the list
            const deletedCommentId = payload.old?.id?.toString()
            console.log('Removing deleted comment:', deletedCommentId)
            
            setComments(currentComments => 
              currentComments.filter(comment => comment.id.toString() !== deletedCommentId)
            )
            
            // If we're editing this comment, stop editing
            if (editingCommentId === deletedCommentId) {
              setEditingCommentId(null)
              setEditCommentContent('')
              setEditCommentFile(null)
              setEditCommentAuthorName('')
            }
            
            // If this comment is in delete dialog, close it
            if (commentToDelete?.id.toString() === deletedCommentId) {
              setShowDeleteCommentDialog(false)
              setCommentToDelete(null)
            }
          } else if (payload.eventType === 'INSERT') {
            // Add new comment if it belongs to current topic
            const newComment = payload.new as Comment
            if (newComment.topic_id.toString() === topicId) {
              console.log('Adding new comment:', newComment.id)
              setComments(currentComments => [...currentComments, newComment])
            }
          } else if (payload.eventType === 'UPDATE') {
            // Update existing comment if it belongs to current topic
            const updatedComment = payload.new as Comment
            if (updatedComment.topic_id.toString() === topicId) {
              console.log('Updating comment:', updatedComment.id)
              setComments(currentComments => 
                currentComments.map(comment => 
                  comment.id.toString() === updatedComment.id.toString() ? updatedComment : comment
                )
              )
            }
          }
        })
        
        console.log('✅ Realtime subscriptions established for topic detail')
      } catch (error) {
        console.warn('Realtime features disabled for topic detail:', error)
        // Realtime is optional, continue without it
      }
    }

    setupRealtime()

    return () => {
      try {
        // Unsubscribe from topics if subscription exists
        if (topicsSubscription && typeof topicsSubscription.unsubscribe === 'function') {
          topicsSubscription.unsubscribe()
        }
        // Unsubscribe from comments if subscription exists
        if (commentsSubscription && typeof commentsSubscription.unsubscribe === 'function') {
          commentsSubscription.unsubscribe()
        }
        // Note: We don't disconnect realtime here as other components might be using it
      } catch (error) {
        console.warn('Error cleaning up realtime subscriptions:', error)
      }
    }
  }, [topicId, editingCommentId, commentToDelete])

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
      Alert.alert('Error', 'Failed to load topic. Please check your connection and try again.')
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
          console.error('Failed to upload comment file:', uploadError)
          Alert.alert('Error', 'Failed to upload file. Please try again.')
          setSubmitting(false)
          return
        }
      }

      const commentData = {
        topic_id: topic.id,
        content: commentText.trim(),
        author_name: isAuthenticated ? user!.email : authorName.trim(),
        user_id: isAuthenticated ? user!.id : undefined,
        file_id: fileId || null,
      }

      const newComment = await db.from('comments').insert(commentData) as unknown as Comment
      setComments(prev => [...prev, newComment])
      
      setCommentText('')
      setAuthorName('')
      setSelectedFile(null)
      setShowAddComment(false)
    } catch (error) {
      console.error('Failed to add comment:', error)
      Alert.alert('Error', 'Failed to add comment. Please try again.')
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


  const handleStartEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id)
    setEditCommentContent(comment.content)
    setEditCommentAuthorName(comment.author_name)
    setEditCommentFile(null)
  }

  const handleRemoveCommentFile = async () => {
    if (!editingCommentId) return

    const currentComment = comments.find(c => c.id === editingCommentId)
    if (!currentComment?.file_id) return

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
              setSubmitting(true)
              
              // Delete file from storage
              const buckets = await storage.buckets.listBuckets()
              const discussionBucket = buckets.find(b => b.name === 'discussion')
              if (discussionBucket) {
                await storage.files.deleteFile(discussionBucket.id, currentComment.file_id!)
              }

              // Update comment in database to remove file_id
              await db
                .from('comments')
                .where('id', editingCommentId)
                .update({ file_id: null })

              // Update local state
              setComments(comments.map(comment => 
                comment.id === editingCommentId 
                  ? { ...comment, file_id: undefined } 
                  : comment
              ))
              
              Alert.alert('Success', 'Attachment removed successfully')
            } catch (error) {
              console.error('Failed to remove comment file:', error)
              Alert.alert('Error', 'Failed to remove attachment. Please try again.')
            } finally {
              setSubmitting(false)
            }
          },
        },
      ]
    )
  }

  const handleUpdateComment = async () => {
    if (!editingCommentId || !editCommentContent.trim()) {
      Alert.alert('Error', 'Please enter comment content')
      return
    }

    if (!isAuthenticated && !editCommentAuthorName.trim()) {
      Alert.alert('Error', 'Please enter your name')
      return
    }

    try {
      setSubmitting(true)

      // Find the current comment to get its file_id
      const currentComment = comments.find(c => c.id === editingCommentId)
      let newFileId: string | undefined = currentComment?.file_id

      // Handle file replacement
      if (editCommentFile) {
        // Delete old file if it exists
        if (currentComment?.file_id) {
          try {
            const buckets = await storage.buckets.listBuckets()
            const discussionBucket = buckets.find(b => b.name === 'discussion')
            if (discussionBucket) {
              await storage.files.deleteFile(discussionBucket.id, currentComment.file_id)
            }
          } catch (deleteError) {
            console.warn('Could not delete old comment file:', deleteError)
          }
        }

        // Upload new file
        try {
          const fileInfo = await fetch(editCommentFile)
          const blob = await fileInfo.blob()
          const fileName = editCommentFile.split('/').pop() || 'file'
          
          const file = new File([blob], fileName, {
            type: blob.type || 'application/octet-stream'
          })
          
          const uploadResult = await storage.upload('discussion', file)
          newFileId = uploadResult.file.id.toString()
        } catch (uploadError) {
          console.error('Failed to upload new comment file:', uploadError)
          Alert.alert('Error', 'Failed to upload new file. Please try again.')
          setSubmitting(false)
          return
        }
      }

      const updatedCommentData = {
        content: editCommentContent.trim(),
        file_id: newFileId || null
      }

      // Update comment using query builder API
      await db
        .from('comments')
        .where('id', editingCommentId)
        .update(updatedCommentData)

      // Update the local state
      setComments(comments.map(comment => 
        comment.id === editingCommentId 
          ? { ...comment, ...updatedCommentData, file_id: updatedCommentData.file_id || undefined } 
          : comment
      ))

      // Reset edit state
      setEditingCommentId(null)
      setEditCommentContent('')
      setEditCommentFile(null)
      setEditCommentAuthorName('')
    } catch (error) {
      console.error('Failed to update comment:', error)
      Alert.alert('Error', 'Failed to update comment. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteComment = async () => {
    if (!commentToDelete) return

    try {
      setSubmitting(true)

      // Delete attached file if it exists
      if (commentToDelete.file_id) {
        try {
          const buckets = await storage.buckets.listBuckets()
          const discussionBucket = buckets.find(b => b.name === 'discussion')
          if (discussionBucket) {
            await storage.files.deleteFile(discussionBucket.id, (commentToDelete.file_id))
          }
        } catch (deleteError) {
          console.warn('Could not delete comment file:', deleteError)
        }
      }

      // Delete comment using query builder API
      await db
        .from('comments')
        .where('id', commentToDelete.id)
        .delete()

      // Update the local state
      setComments(comments.filter(comment => comment.id !== commentToDelete.id))
      
      // Close the delete dialog
      setShowDeleteCommentDialog(false)
      setCommentToDelete(null)
    } catch (error) {
      console.error('Failed to delete comment:', error)
      Alert.alert('Error', 'Failed to delete comment. Please try again.')
    } finally {
      setSubmitting(false)
      setShowDeleteCommentDialog(false)
      setCommentToDelete(null)
    }
  }

  const handleTopicEdited = (updatedTopic: Topic) => {
    setTopic(updatedTopic)
    setIsEditingTopic(false)
  }

  const handleEditCommentFileChange = async () => {
    try {
      const options = await showMediaPickerOptions(
        async () => {
          const result = await safeLaunchCamera()
          if (result && !result.canceled && result.assets[0]) {
            setEditCommentFile(result.assets[0].uri)
          }
        },
        async () => {
          const result = await safeLaunchImageLibrary()
          if (result && !result.canceled && result.assets[0]) {
            setEditCommentFile(result.assets[0].uri)
          }
        }
      )
      
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
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => onBack ? onBack() : router.back()}
              >
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
              
              {canModifyContent(topic.user_id, user) && (
                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={() => setIsEditingTopic(true)}
                >
                  <Ionicons name="ellipsis-vertical" size={24} color="#007AFF" />
                </TouchableOpacity>
              )}
            </View>
            
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
              {editingCommentId === comment.id ? (
                <View style={styles.editCommentForm}>
                  <TextInput
                    style={[styles.input, styles.commentInput]}
                    placeholder="Edit your comment..."
                    placeholderTextColor="#666"
                    value={editCommentContent}
                    onChangeText={setEditCommentContent}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                  
                  {!isAuthenticated && (
                    <TextInput
                      style={styles.input}
                      placeholder="Your name"
                      placeholderTextColor="#666"
                      value={editCommentAuthorName}
                      onChangeText={setEditCommentAuthorName}
                    />
                  )}

                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={handleEditCommentFileChange}
                    disabled={submitting}
                  >
                    <View style={styles.uploadButtonContent}>
                      <Ionicons name="camera" size={20} color="#007AFF" style={styles.uploadIcon} />
                      <Text style={styles.uploadButtonText}>
                        {editCommentFile ? 'Replace Photo/Video' : (comment.file_id ? 'Replace Photo/Video' : 'Add Photo/Video')}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {editCommentFile && (
                    <View style={styles.filePreview}>
                      <Image 
                        source={{ uri: editCommentFile }} 
                        style={styles.previewImage}
                        contentFit="cover"
                      />
                      <TouchableOpacity
                        style={styles.removeFileButton}
                        onPress={() => setEditCommentFile(null)}
                      >
                        <Ionicons name="close-circle" size={20} color="white" />
                        <Text style={styles.removeFileText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {comment.file_id && !editCommentFile && (
                    <View style={styles.currentFilePreview}>
                      <View style={styles.currentFileHeader}>
                        <Text style={styles.currentFileText}>Current attachment:</Text>
                        <TouchableOpacity
                          style={styles.removeCurrentFileButton}
                          onPress={handleRemoveCommentFile}
                          disabled={submitting}
                        >
                          <Ionicons name="close-circle" size={20} color="#ff4757" />
                          <Text style={styles.removeCurrentFileText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                      <FilePreview fileId={comment.file_id} style={styles.commentImage} />
                    </View>
                  )}

                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={[styles.saveButton, submitting && styles.buttonDisabled]}
                      onPress={handleUpdateComment}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : (
                        <Text style={styles.saveButtonText}>Save</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelEditButton}
                      onPress={() => {
                        setEditingCommentId(null)
                        setEditCommentContent('')
                        setEditCommentFile(null)
                        setEditCommentAuthorName('')
                      }}
                    >
                      <Text style={styles.cancelEditButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentContent}>{comment.content}</Text>
                    {canModifyContent(comment.user_id, user) && (
                      <View style={styles.commentActions}>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleStartEditComment(comment)}
                        >
                          <Ionicons name="pencil" size={16} color="#007AFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => {
                            setCommentToDelete(comment)
                            setShowDeleteCommentDialog(true)
                          }}
                        >
                          <Ionicons name="trash" size={16} color="#ff4757" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
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
                </>
              )}
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

      {/* Edit Topic Modal */}
      <Modal
        visible={isEditingTopic}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEditingTopic(false)}
      >
        <View style={styles.editTopicModal}>
          <CreateTopic
            initialTopic={topic}
            onTopicCreated={handleTopicEdited}
            onCancel={() => setIsEditingTopic(false)}
            onEditComplete={() => setIsEditingTopic(false)}
          />
        </View>
      </Modal>


      {/* Delete Comment Confirmation */}
      <Modal
        visible={showDeleteCommentDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteCommentDialog(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <Text style={styles.deleteModalTitle}>Delete Comment?</Text>
            <Text style={styles.deleteModalText}>
              This action cannot be undone. This will permanently delete this comment.
            </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={styles.deleteModalCancel}
                onPress={() => {
                  setShowDeleteCommentDialog(false)
                  setCommentToDelete(null)
                }}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteModalConfirm}
                onPress={handleDeleteComment}
              >
                <Text style={styles.deleteModalConfirmText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    fontWeight: 'semibold',
    color: '#333',
    marginBottom: 15,
    lineHeight: 34,
    marginTop: 0,
  },
  topicContent: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 20,
  },
  topicImageContainer: {
    marginBottom: 10,
  },
  topicImage: {
    borderRadius: 8,
    minHeight: 150,
    maxHeight: 400,
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
    borderRadius: 6,
    minHeight: 100,
    maxHeight: 300,
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
  // Header styles
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  menuButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
  },
  // Comment actions styles
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  // Edit comment styles
  editCommentForm: {
    gap: 10,
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelEditButton: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelEditButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  currentFilePreview: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
  },
  currentFileText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  currentFileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  // Edit topic modal styles
  editTopicModal: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
})
