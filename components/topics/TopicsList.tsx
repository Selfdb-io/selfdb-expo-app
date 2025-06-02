import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { db, realtime } from '@/services/selfdb'
import { Topic } from '@/types'
import { FilePreview, preloadFileMetadata } from '../FilePreview'
import SvgComponent from '@/assets/images/logo'
import { TopicCard } from './TopicCard'

interface TopicsListProps {
  onCreateTopic?: () => void
  showHeader?: boolean
  onShowAuthModal?: () => void
  onLogout?: () => void
  user?: any
  isAuthenticated?: boolean
}

export const TopicsList: React.FC<TopicsListProps> = ({ 
  onCreateTopic, 
  showHeader = false,
  onShowAuthModal,
  onLogout,
  user,
  isAuthenticated
}) => {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [visibleTopics, setVisibleTopics] = useState<Set<string>>(new Set())

  // Move declaration up so it’s visible in cleanup
  let topicsSubscription: any = null
  let commentsSubscription: any = null

  const loadTopics = async () => {
    try {
      console.log('Loading topics...')
      
      // 1) fetch all topics
      const topicsData = await db
        .from('topics')
        .select('*')
        .order('created_at', 'desc')
        .execute()

      // 2) For each topic, fetch its comment count using the exact same method as TopicDetail
      const topicsWithCounts = await Promise.all(
        (topicsData as any[]).map(async (topic) => {
          // Load comments for this topic using proper query builder API (same as TopicDetail)
          const commentsData = await db
            .from('comments')
            .where('topic_id', topic.id)
            .order('created_at', 'asc')
            .execute()
          
          return {
            ...topic,
            comment_count: (commentsData as any[]).length
          }
        })
      )

      setTopics(topicsWithCounts as Topic[])
      
      // Preload file metadata for all topics with files
      const preloadPromises = topicsWithCounts
        .filter((topic: any) => topic.file_id)
        .map((topic: any) => preloadFileMetadata(topic.file_id))
      
      // Don't wait for preloading to complete, just start it
      Promise.all(preloadPromises).catch(error => 
        console.warn('Some files failed to preload:', error)
      )
      
      // Clear visible topics and gradually show them with 100ms delay
      setVisibleTopics(new Set())
      
      // Add 100ms delay to ensure media loads with text content, then hide loading
      setTimeout(() => {
        const topicIds = new Set(topicsWithCounts.map((topic: any) => topic.id.toString()))
        setVisibleTopics(topicIds)
        setLoading(false)
        setRefreshing(false)
      }, 100)
    } catch (error) {
      console.error('Failed to load topics:', error)
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadTopics()

    const setupRealtime = async () => {
      try {
        await realtime.connect()
        
        // Subscribe to topics changes
        topicsSubscription = realtime.subscribe('topics', async (payload: any) => {
          console.log('Topics realtime update:', payload)
          
          // Handle different types of realtime events
          if (payload.eventType === 'DELETE') {
            // Remove deleted topic from the list
            const deletedTopicId = payload.old?.id?.toString()
            console.log('Removing deleted topic:', deletedTopicId)
            
            setTopics(currentTopics => 
              currentTopics.filter(topic => topic.id.toString() !== deletedTopicId)
            )
            setVisibleTopics(currentVisible => {
              const newVisible = new Set(currentVisible)
              newVisible.delete(deletedTopicId)
              return newVisible
            })
          } else if (payload.eventType === 'INSERT') {
            // Add new topic to the beginning of the list
            const newTopic = {
              ...(payload.new as Topic),
              comment_count: 0,          // new topics start with zero comments
            }
            console.log('Adding new topic:', newTopic.id)
            
            setTopics(currentTopics => [newTopic, ...currentTopics])
            setVisibleTopics(currentVisible => {
              const newVisible = new Set(currentVisible)
              newVisible.add(newTopic.id.toString())
              return newVisible
            })
          } else if (payload.eventType === 'UPDATE') {
            // Update existing topic and refetch comment count
            const updatedTopic = payload.new as Topic
            console.log('Updating topic:', updatedTopic.id)
            
            // Fetch comments for this specific topic to get accurate count
            const topicComments = await db
              .from('comments')
              .where('topic_id', updatedTopic.id)
              .execute()
            
            const commentCount = (topicComments as any[]).length
            
            setTopics(currentTopics => 
              currentTopics.map(topic => 
                topic.id.toString() === updatedTopic.id.toString()
                  ? { ...updatedTopic, comment_count: commentCount }
                  : topic
              )
            )
          } else {
            // For any other changes, reload all topics
            console.log('Unknown event type, reloading topics:', payload.eventType)
            loadTopics()
          }
        })
        
        // keep comment_count up-to-date
        commentsSubscription = realtime.subscribe('comments', (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const topicId = payload.new.topic_id.toString()
            setTopics(t =>
              t.map(tp =>
                tp.id.toString() === topicId
                  ? { ...tp, comment_count: (tp.comment_count ?? 0) + 1 }
                  : tp
              )
            )
          } else if (payload.eventType === 'DELETE') {
            const topicId = payload.old.topic_id.toString()
            setTopics(t =>
              t.map(tp =>
                tp.id.toString() === topicId
                  ? {
                      ...tp,
                      comment_count: Math.max((tp.comment_count ?? 1) - 1, 0),
                    }
                  : tp
              )
            )
          }
        })

        console.log('✅ Realtime subscription established for topics')
      } catch (error) {
        console.warn('Realtime features disabled for topics:', error)
      }
    }

    setupRealtime()

    return () => {
      try {
        if (topicsSubscription?.unsubscribe) topicsSubscription.unsubscribe()
        if (commentsSubscription?.unsubscribe) commentsSubscription.unsubscribe()   // ← no TS error
      } catch (error) {
        console.warn('Error cleaning up realtime subscriptions:', error)
      }
    }
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    // loadTopics() will fetch fresh topics AND count comments properly
    loadTopics()
  }

  const handleTopicPress = (topic: Topic) => {
    router.push({
      pathname: "/topic/[topicId]",
      params: { 
        topicId: topic.id.toString(),
        topicData: JSON.stringify(topic) 
      }
    })
  }

  const renderTopic = ({ item }: { item: Topic }) => {
    const isVisible = visibleTopics.has(item.id.toString())

    if (!isVisible) {
      // Show loading skeleton while waiting for content to be synchronized
      return (
        <View className="bg-gray-50 rounded-lg p-4 mb-4">
          <View className="h-5 bg-gray-300 rounded mb-2 w-3/4" />
          <View className="h-4 bg-gray-300 rounded mb-1.5 w-full" />
          <View className="h-4 bg-gray-300 rounded mb-1.5 w-full" />
          {item.file_id && <View className="h-50 bg-gray-300 rounded mb-3" />}
          <View className="flex-row justify-between items-center mb-1">
            <View className="h-3 bg-gray-300 rounded w-15" />
            <View className="h-3 bg-gray-300 rounded w-20" />
          </View>
        </View>
      )
    }

    return (
      <TopicCard
        topic={item}
        commentsCount={item.comment_count}
        contentNumberOfLines={2}
        onPress={() => handleTopicPress(item)}
      />
    )
  }

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#007AFF" />
        <Text className="mt-3 text-gray-600 text-base">Loading topics...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-gray-100">
      {/* Header - only show when showHeader is true */}
      {showHeader && (
        <View className="flex-row justify-between items-center px-5 pb-2 border-b border-gray-200">
          <View className="flex-row items-center gap-3">
            <SvgComponent width={40} height={40} />
            <Text className="text-black text-lg font-semibold">Open Discussion Board</Text>
          </View>
          <View className="flex-row items-center">
            {isAuthenticated ? (
              <View className="flex-row items-center gap-2">
                {/* subtle bordered avatar */}
                <View className="w-9 h-9 rounded-full border border-primary-500 justify-center items-center">
                  <Text className="text-primary-500 font-semibold">
                    {user?.email?.charAt(0).toUpperCase()}
                  </Text>
                </View>

                {/* lightweight logout icon */}
                <TouchableOpacity
                  onPress={onLogout}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="log-out-outline" size={22} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ) : (
              /* lightweight login icon */
              <TouchableOpacity
                onPress={onShowAuthModal}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name="person-circle-outline"
                  size={28}
                  color="#007AFF"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      
      {/* Topics List */}
      <FlatList
        data={topics}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderTopic}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={{ padding: 15 }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={10}
      />
      
      {/* Floating Action Button */}
      {onCreateTopic && (
        <TouchableOpacity
          className="absolute w-14 h-14 items-center justify-center right-5 bottom-5 bg-primary-500 rounded-full shadow-lg"
          onPress={onCreateTopic}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      )}
    </View>
  )
}
