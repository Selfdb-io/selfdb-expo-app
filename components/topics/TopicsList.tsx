
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { db, realtime } from '@/services/selfdb'
import { Topic } from '@/types'
import { formatDate } from '@/lib/utils'
import { FilePreview } from '../FilePreview'
import { TopicDetail } from './TopicDetail'
import { ThemedText } from '@/components/ThemedText'
import { ThemedView } from '@/components/ThemedView'

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
        <View style={[styles.topicCard, styles.loadingSkeleton]}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonContent} />
          <View style={styles.skeletonContent} />
          {item.file_id && <View style={styles.skeletonImage} />}
          <View style={styles.skeletonMeta}>
            <View style={styles.skeletonAuthor} />
            <View style={styles.skeletonDate} />
          </View>
        </View>
      )
    }
    
    return (
      <TouchableOpacity
        style={styles.topicCard}
        onPress={() => handleTopicPress(item)}
      >
        <Text style={styles.topicTitle}>{item.title}</Text>
        <Text style={styles.topicContent} numberOfLines={2}>
          {item.content}
        </Text>
        {item.file_id && (
          <View style={styles.imageContainer}>
            <FilePreview fileId={item.file_id} style={styles.topicImage} />
          </View>
        )}
        <View style={styles.topicMeta}>
          <Text style={styles.author}>By {item.author_name}</Text>
          <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        </View>
        {item.comment_count !== undefined && (
          <Text style={styles.commentCount}>
            {item.comment_count} comment{item.comment_count !== 1 ? 's' : ''}
          </Text>
        )}
      </TouchableOpacity>
    )
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading topics...</Text>
      </View>
    )
  }

  // Show topic detail if a topic is selected
  if (selectedTopicId) {
    return (
      <TopicDetail 
        topicId={selectedTopicId} 
        onBack={() => setSelectedTopicId(null)} 
      />
    )
  }

  return (
    <View style={styles.container}>
      {/* Header - only show when showHeader is true */}
      {showHeader && (
        <ThemedView style={styles.header}>
          <ThemedText type="subtitle">Open Discussion Board</ThemedText>
          <View style={styles.headerActions}>
            {isAuthenticated ? (
              <View style={styles.userSection}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {user?.email?.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.logoutButton}
                  onPress={onLogout}
                >
                  <Ionicons name="log-out" size={20} color="white" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.loginButton}
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
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
      
      {/* Floating Action Button */}
      {onCreateTopic && (
        <TouchableOpacity
          style={styles.fab}
          onPress={onCreateTopic}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  list: {
    padding: 15,
  },
  topicCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
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
  imageContainer: {
    marginBottom: 10,
  },
  topicImage: {
    borderRadius: 6,
    minHeight: 150,
    maxHeight: 400,
  },
  topicMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
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
  commentCount: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  loadingSkeleton: {
    backgroundColor: '#f9f9f9',
  },
  skeletonTitle: {
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 8,
    width: '70%',
  },
  skeletonContent: {
    height: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 6,
    width: '100%',
  },
  skeletonImage: {
    height: 200,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    marginBottom: 10,
  },
  skeletonMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  skeletonAuthor: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    width: 60,
  },
  skeletonDate: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    width: 80,
  },
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userAvatar: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#ff4757',
    padding: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
  },
  loginButton: {
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
  },
})
