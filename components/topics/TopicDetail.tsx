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
import { FilePreview, preloadFileMetadata } from '../FilePreview'
import { CreateComment } from './CreateComment'
import { CreateTopic } from './CreateTopic'
import { CommentActions } from './CommentActions'
import { canModifyContent } from '@/lib/permissions'

interface TopicDetailProps {
  topicId: string
  topic: Topic // Topic is now required since we always pass it from TopicsList
  onBack?: () => void
  onTopicDeleted?: () => void
}

export const TopicDetail: React.FC<TopicDetailProps> = ({ topicId, topic, onBack, onTopicDeleted }) => {
  const { user, isAuthenticated } = useAuth()
  const [currentTopic, setCurrentTopic] = useState<Topic>(topic)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [showAddComment, setShowAddComment] = useState(false)
  
  // Topic edit/delete state
  const [isEditingTopic, setIsEditingTopic] = useState(false)

  // Calculate canEdit directly without memoization to prevent header render delays
  const canEdit = canModifyContent(currentTopic?.user_id, user)

  // Header component - render directly without memoization to prevent delays
  const HeaderComponent = (
    <View className="flex-row justify-between items-center px-5 pb-2 border-b border-gray-200">
      <TouchableOpacity 
        className="p-2 rounded-full justify-center items-center w-10 h-10"
         onPress={() => onBack ? onBack() : router.replace('/')}
      >
        <Ionicons name="arrow-back" size={20} color="#007AFF" />
      </TouchableOpacity>
      
      {/* Always have a center element for layout consistency */}
      <View className="flex-1" />
      
      {/* Edit Button - only show if user can modify content, otherwise show placeholder */}
      {canEdit ? (
        <TouchableOpacity
          className="p-2 rounded-full justify-center items-center w-10 h-10"
          onPress={() => setIsEditingTopic(true)}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#007AFF" />
        </TouchableOpacity>
      ) : (
        <View className="w-10 h-10" />
      )}
    </View>
  )

  useEffect(() => {
    if (topicId && topic) {
      // We should always have a topic passed in, just load comments
      loadComments()
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
            setCurrentTopic(updatedTopic)
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
  }, [topicId]) // Simplified dependency array - only topicId needed

  const loadComments = async () => {
    try {
      setCommentsLoading(true)
      
      if (!currentTopic) return
      
      // Load comments for this topic using proper query builder API
      const commentsData = await db
        .from('comments')
        .where('topic_id', currentTopic.id)
        .order('created_at', 'asc')
        .execute()
      
      setComments(commentsData as unknown as Comment[])
      
      // Preload file metadata for topic and comments with files
      const preloadPromises = []
      
      // Preload topic file if it exists (in case it wasn't preloaded already)
      if (currentTopic.file_id) {
        preloadPromises.push(preloadFileMetadata(currentTopic.file_id))
      }
      
      // Preload comment files if they exist
      preloadPromises.push(
        ...commentsData
          .filter((comment: any) => comment.file_id)
          .map((comment: any) => preloadFileMetadata(comment.file_id))
      )
      
      // Don't wait for preloading to complete, just start it
      Promise.all(preloadPromises).catch(error => 
        console.warn('Some files failed to preload:', error)
      )
    } catch (error) {
      console.error('Failed to load comments:', error)
    } finally {
      setCommentsLoading(false)
    }
  }

  const handleCommentCreated = (newComment: Comment) => {
    setComments(prev => [...prev, newComment])
    setShowAddComment(false)
  }

  const handleTopicEdited = (updatedTopic: Topic) => {
    setCurrentTopic(updatedTopic)
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

  if (!currentTopic) {
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
      {/* Back Button Header */}
      {HeaderComponent}
      
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Topic Content Area */}
        <View className="px-4 pt-4 pb-0">
          <View className="bg-white rounded-lg p-4 mb-4 shadow-sm">
            <Text className="text-lg font-bold text-gray-800 mb-2">{currentTopic.title}</Text>
            <Text className="text-sm text-gray-600 mb-3 leading-5">{currentTopic.content}</Text>
            {currentTopic.file_id && (
              <View className="mb-3">
                <FilePreview fileId={currentTopic.file_id}/>
              </View>
            )}
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-xs text-primary-500 font-medium">By {currentTopic.author_name}</Text>
              <Text className="text-xs text-gray-400">{formatDate(currentTopic.created_at)}</Text>
            </View>
            {comments.length > 0 && (
              <Text className="text-xs text-gray-600 italic">
                {comments.length} comment{comments.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>

        {/* Comments */}
        <View className="px-4 mb-4">
          <Text className="text-lg font-bold text-gray-800 mb-4">
            Comments ({comments.length})
          </Text>
          
          {commentsLoading ? (
            <View className="flex-row justify-center items-center py-8">
              <ActivityIndicator size="small" color="#007AFF" />
              <Text className="ml-2 text-gray-600">Loading comments...</Text>
            </View>
          ) : (
            comments.map((comment) => (
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
            ))
          )}
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
            initialTopic={currentTopic}
            onTopicCreated={handleTopicEdited}
            onCancel={() => setIsEditingTopic(false)}
            onEditComplete={() => setIsEditingTopic(false)}
            onTopicDeleted={() => {
              setIsEditingTopic(false)
              if (onTopicDeleted) {
                onTopicDeleted()
              }
              // router.back() should be called by the screen if the topic is deleted
              // to ensure proper navigation stack handling.
              if (onBack) { // This onBack might be redundant if router.back() is used by the screen
                onBack()
              } else {
                router.back() // Fallback if onBack is not provided
              }
            }}
            onTopicUpdated={() => {
              // Trigger refetch in parent TopicsList component
              if (onTopicDeleted) { // This prop seems misused here, consider renaming or clarifying its purpose
                onTopicDeleted() // This likely should be a different callback, e.g., onTopicDataStale
              }
            }}
          />
        </View>
      </Modal>


    </>
  )
}
