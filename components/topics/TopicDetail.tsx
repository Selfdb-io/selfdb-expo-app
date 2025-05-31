import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native'
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
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#007AFF" />
        <Text className="mt-3 text-gray-600 text-base">Loading topic...</Text>
      </View>
    )
  }

  if (!topic) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-red-500 text-lg mb-5">Topic not found</Text>
        <TouchableOpacity
          className="bg-primary-500 py-3 px-6 rounded-lg"
          onPress={() => onBack ? onBack() : router.back()}
        >
          <Text className="text-white text-base font-medium">Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Topic Header with Back Button and Title */}
        <View className="bg-white p-5 mb-5">
          <View className="mb-4">
            <View className="flex-row justify-between items-center mb-4">
              <TouchableOpacity
                className="py-1"
                onPress={() => onBack ? onBack() : router.back()}
              >
                <Text className="text-primary-500 text-base font-medium">← Back</Text>
              </TouchableOpacity>
              
              {canModifyContent(topic.user_id, user) && (
                <TouchableOpacity
                  className="p-2 rounded-md bg-gray-50"
                  onPress={() => setIsEditingTopic(true)}
                >
                  <Ionicons name="ellipsis-vertical" size={24} color="#007AFF" />
                </TouchableOpacity>
              )}
            </View>
            
            <Text className="text-lg font-bold text-gray-800 mb-2">{topic.title}</Text>
          </View>
          <Text className="text-sm text-gray-600 mb-3 leading-5">{topic.content}</Text>
          {topic.file_id && (
            <View className="mb-3">
              <FilePreview fileId={topic.file_id}/>
            </View>
          )}
          <View className="flex-row justify-between items-center">
            <Text className="text-xs text-primary-500 font-medium">By {topic.author_name}</Text>
            <Text className="text-xs text-gray-400">{formatDate(topic.created_at)}</Text>
          </View>
        </View>

        {/* Comments */}
        <View className="px-5 mb-5">
          <Text className="text-lg font-bold text-gray-800 mb-4">
            Comments ({comments.length})
          </Text>
          
          {comments.map((comment) => (
            <View key={comment.id} className="bg-white p-4 rounded-lg mb-3">
              <View className="flex-row justify-between items-start gap-3">
                <View className="flex-1">
                  <Text className="text-sm text-gray-600 leading-5 mb-3">{comment.content}</Text>
                  {!comment.file_id && (
                    <View className="flex-row justify-between items-center">
                      <Text className="text-xs text-primary-500 font-medium">{comment.author_name}</Text>
                      <Text className="text-xs text-gray-400">
                        {formatDate(comment.created_at)}
                      </Text>
                    </View>
                  )}
                </View>
                <CommentActions
                  comment={comment}
                  onCommentUpdated={handleCommentUpdated}
                  onCommentDeleted={handleCommentDeleted}
                />
              </View>
              {comment.file_id && (
                <>
                  <View className="mt-3 mb-3">
                    <FilePreview fileId={comment.file_id}/>
                  </View>
                  <View className="flex-row justify-between items-center mt-3">
                    <Text className="text-xs text-primary-500 font-medium">{comment.author_name}</Text>
                    <Text className="text-xs text-gray-400">
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
        className="absolute w-14 h-14 items-center justify-center right-5 bottom-5 bg-primary-500 rounded-full shadow-lg"
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
        <View className="flex-1 bg-gray-100">
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
        <View className="flex-1 bg-gray-100">
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
