
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
import { db } from '@/services/selfdb'
import { Topic } from '@/types'
import { formatDate } from '@/lib/utils'
import { FilePreview } from '../FilePreview'
import { TopicDetail } from './TopicDetail'

export const TopicsList: React.FC = () => {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)

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
    } catch (error) {
      console.error('Failed to load topics:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadTopics()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    loadTopics()
  }

  const handleTopicPress = (topic: Topic) => {
    setSelectedTopicId(topic.id.toString())
  }

  const renderTopic = ({ item }: { item: Topic }) => (
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
    height: 150,
    borderRadius: 6,
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
})
