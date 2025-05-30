import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/AuthContext'
import { db, realtime } from '@/services/selfdb'
import { Topic, Comment } from '@/types'
import { formatDate } from '@/lib/utils'
import { FilePreview } from '@/components/FilePreview'
import { canModifyContent } from '@/lib/permissions'
import { CreateTopic } from '@/components/topics/CreateTopic'
import { CreateComment } from '@/components/topics/CreateComment'
import { CommentActions } from '@/components/topics/CommentActions'

interface TopicDetailProps {
  topicId: string
  onBack?: () => void
  onTopicDeleted?: () => void
}

export const TopicDetail: React.FC<TopicDetailProps> = ({ topicId, onBack, onTopicDeleted }) => {
  const { user, isAuthenticated } = useAuth()
  const [topic, setTopic] = useState<Topic | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddComment, setShowAddComment] = useState(false)
  
  // Topic edit/delete state
  const [isEditingTopic, setIsEditingTopic] = useState(false)

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
                    if (onTopicDeleted) {
                      onTopicDeleted()
                    }
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
            // Note: This is now handled by the CommentActions component
            
            // If this comment is in delete dialog, close it
            // Note: This is now handled by the CommentActions component
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
      Alert.alert('Error', 'Failed to load topic. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const loadComments = async () => {
    try {
      if (!topic) return
      
      // Load comments for this topic using proper query builder API
      const commentsData = await db
        .from('comments')
        .where('topic_id', topic.id)
        .order('created_at', 'asc')
        .execute()
      
      setComments(commentsData as unknown as Comment[])
    } catch (error) {
      console.error('Failed to load comments:', error)
    }
  }

  const handleCommentCreated = (newComment: Comment) => {
    setComments(prev => [...prev, newComment])
    setShowAddComment(false)
  }

  const handleTopicEdited = (updatedTopic: Topic) => {
    setTopic(updatedTopic)
    setIsEditingTopic(false)
  }

  const handleCommentUpdated = (updatedComment: Comment) => {
    setComments(comments.map(comment => 
      comment.id === updatedComment.id ? updatedComment : comment
    ))
  }

  const handleCommentDeleted = (commentId: string) => {
    setComments(comments.filter(comment => comment.id.toString() !== commentId))
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
              <View style={styles.commentHeader}>
                <View style={styles.commentContentContainer}>
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
                <CommentActions
                  comment={comment}
                  onCommentUpdated={handleCommentUpdated}
                  onCommentDeleted={handleCommentDeleted}
                />
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
        <View style={styles.modalContainer}>
          <CreateComment
            topicId={topicId}
            onCommentCreated={handleCommentCreated}
            onCancel={() => setShowAddComment(false)}
          />
        </View>
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
            onTopicDeleted={() => {
              setIsEditingTopic(false)
              if (onTopicDeleted) {
                onTopicDeleted()
              }
              if (onBack) {
                onBack()
              }
            }}
            onTopicUpdated={() => {
              // Trigger refetch in parent TopicsList component
              if (onTopicDeleted) {
                onTopicDeleted()
              }
            }}
          />
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  topicContent: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    lineHeight: 20,
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
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  date: {
    fontSize: 12,
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
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  commentContentContainer: {
    flex: 1,
  },
  // Edit topic modal styles
  editTopicModal: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
})
