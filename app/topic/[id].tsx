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
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/services/selfdb'
import { Topic, Comment } from '@/types'
import { formatDate } from '@/lib/utils'
import { FilePreview } from '@/components/FilePreview'

export default function TopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user, isAuthenticated } = useAuth()
  const [topic, setTopic] = useState<Topic | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (id) {
      loadTopicAndComments()
    }
  }, [id])

  const loadTopicAndComments = async () => {
    try {
      setLoading(true)
      
      // Load topic using proper query builder API
      const topicData = await db
        .from('topics')
        .where('id', id)
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
      const commentData = {
        topic_id: topic.id,
        content: commentText.trim(),
        author_name: isAuthenticated ? user!.email : authorName.trim(),
        user_id: isAuthenticated ? user!.id : undefined,
      }

      const newComment = await db.from('comments').insert(commentData) as unknown as Comment
      setComments(prev => [...prev, newComment])
      
      setCommentText('')
      setAuthorName('')
    } catch (error) {
      console.error('Failed to add comment:', error)
      Alert.alert('Error', 'Failed to add comment')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading topic...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!topic) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Topic not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Topic Header with Back Button and Title */}
        <View style={styles.topicContainer}>
          <View style={styles.topicHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
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

        {/* Add Comment Form */}
        <View style={styles.addCommentSection}>
          <Text style={styles.addCommentTitle}>Add a Comment</Text>
          
          <TextInput
            style={[styles.input, styles.commentInput]}
            placeholder="Write your comment..."
            placeholderTextColor="#666"
            value={commentText}
            onChangeText={setCommentText}
            multiline
            numberOfLines={3}
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
          
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.buttonDisabled]}
            onPress={handleAddComment}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Add Comment</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  errorText: {
    color: '#ff4757',
    fontSize: 18,
    marginBottom: 20,
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
  content: {
    flex: 1,
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
})
