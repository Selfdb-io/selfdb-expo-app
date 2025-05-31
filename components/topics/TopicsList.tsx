
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
import { db, realtime } from '@/services/selfdb'
import { Topic } from '@/types'
import { formatDate } from '@/lib/utils'
import { FilePreview, preloadFileMetadata } from '../FilePreview'
import { TopicDetail } from './TopicDetail'
import { ThemedText } from '@/components/ThemedText'
import { ThemedView } from '@/components/ThemedView'
import SvgComponent from '@/assets/images/logo'

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
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [visibleTopics, setVisibleTopics] = useState<Set<string>>(new Set())

  const loadTopics = async () => {
    try {
      console.log('Loading topics...')
      // Fetch topics ordered by newest first
      const topicsData = await db
        .from('topics')
        .select('*')
        .order('created_at', 'desc')
        .execute()
      console.log('Topics loaded:', topicsData.length)
      setTopics(topicsData as unknown as Topic[])
      
      // Preload file metadata for all topics with files
      const preloadPromises = topicsData
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
        const topicIds = new Set(topicsData.map((topic: any) => topic.id.toString()))
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

    // Store subscription references
    let topicsSubscription: any = null

    // Set up realtime subscription for topics
    const setupRealtime = async () => {
      try {
        await realtime.connect()
        
        // Subscribe to topics changes
        topicsSubscription = realtime.subscribe('topics', (payload: any) => {
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
            
            // If the deleted topic is currently selected, go back to list
            if (selectedTopicId === deletedTopicId) {
              setSelectedTopicId(null)
            }
          } else if (payload.eventType === 'INSERT') {
            // Add new topic to the beginning of the list
            const newTopic = payload.new as Topic
            console.log('Adding new topic:', newTopic.id)
            
            setTopics(currentTopics => [newTopic, ...currentTopics])
            setVisibleTopics(currentVisible => {
              const newVisible = new Set(currentVisible)
              newVisible.add(newTopic.id.toString())
              return newVisible
            })
          } else if (payload.eventType === 'UPDATE') {
            // Update existing topic
            const updatedTopic = payload.new as Topic
            console.log('Updating topic:', updatedTopic.id)
            
            setTopics(currentTopics => 
              currentTopics.map(topic => 
                topic.id.toString() === updatedTopic.id.toString() ? updatedTopic : topic
              )
            )
          } else {
            // For any other changes, reload all topics
            console.log('Unknown event type, reloading topics:', payload.eventType)
            loadTopics()
          }
        })
        
        console.log('✅ Realtime subscription established for topics')
      } catch (error) {
        console.warn('Realtime features disabled for topics:', error)
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
        // Note: We don't disconnect realtime here as TopicDetail might be using it
      } catch (error) {
        console.warn('Error cleaning up realtime subscriptions:', error)
      }
    }
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    loadTopics()
  }

  const handleTopicPress = (topic: Topic) => {
    setSelectedTopicId(topic.id.toString())
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
      <TouchableOpacity
        className="bg-white rounded-lg p-4 mb-4 shadow-sm"
        onPress={() => handleTopicPress(item)}
      >
        <Text className="text-lg font-bold text-gray-800 mb-2">{item.title}</Text>
        <Text className="text-sm text-gray-600 mb-3 leading-5" numberOfLines={2}>
          {item.content}
        </Text>
        {item.file_id && (
          <View className="mb-3">
            <FilePreview 
              key={`topic-${item.id}-${item.file_id}`} 
              fileId={item.file_id} 
            />
          </View>
        )}
        <View className="flex-row justify-between items-center mb-1">
          <Text className="text-xs text-primary-500 font-medium">By {item.author_name}</Text>
          <Text className="text-xs text-gray-400">{formatDate(item.created_at)}</Text>
        </View>
        {item.comment_count !== undefined && (
          <Text className="text-xs text-gray-600 italic">
            {item.comment_count} comment{item.comment_count !== 1 ? 's' : ''}
          </Text>
        )}
      </TouchableOpacity>
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

  // Show topic detail if a topic is selected
  // Note: We now keep both components mounted to prevent image flashing
  return (
    <View className="flex-1 bg-gray-100">
      {/* Topics List - hide when detail is shown */}
      <View 
        className="flex-1" 
        style={{ 
          position: selectedTopicId ? 'absolute' : 'relative',
          opacity: selectedTopicId ? 0 : 1,
          zIndex: selectedTopicId ? -1 : 1,
          width: '100%',
          height: '100%'
        }}
        pointerEvents={selectedTopicId ? 'none' : 'auto'}
      >
        {/* Header - only show when showHeader is true */}
        {showHeader && (
          <ThemedView className="flex-row justify-between items-center px-5 py-4 bg-white border-b border-gray-200">
            <View className="flex-row items-center gap-3">
              <SvgComponent width={32} height={32} />
              <ThemedText type="semiBold">Open Discussion Board</ThemedText>
            </View>
            <View className="flex-row items-center">
              {isAuthenticated ? (
                <View className="flex-row items-center gap-3">
                  <View className="bg-primary-500 w-10 h-10 rounded-full justify-center items-center">
                    <Text className="text-white text-base font-semibold">
                      {user?.email?.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    className="bg-red-500 p-2 rounded-full justify-center items-center w-10 h-10"
                    onPress={onLogout}
                  >
                    <Ionicons name="log-out" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  className="bg-primary-500 p-2 rounded-full justify-center items-center w-10 h-10"
                  onPress={onShowAuthModal}
                >
                  <Ionicons name="person-circle" size={24} color="white" />
                </TouchableOpacity>
              )}
            </View>
          </ThemedView>
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

      {/* Topic Detail - show when a topic is selected */}
      {selectedTopicId && (
        <View 
          className="flex-1"
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 2
          }}
        >
          <TopicDetail 
            topicId={selectedTopicId} 
            onBack={() => setSelectedTopicId(null)}
            onTopicDeleted={() => {
              setSelectedTopicId(null)
              loadTopics() // Refetch topics after deletion
            }}
          />
        </View>
      )}
    </View>
  )
}
