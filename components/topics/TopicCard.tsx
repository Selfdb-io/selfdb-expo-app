import React from 'react'
import { TouchableOpacity, View, Text } from 'react-native'
import { Topic } from '@/types'
import { formatDate } from '@/lib/utils'
import { FilePreview } from '../FilePreview'

interface TopicCardProps {
  topic: Topic
  onPress?: () => void
  commentsCount?: number
  /** truncate the content to x lines (omit for full text) */
  contentNumberOfLines?: number
}

export const TopicCard: React.FC<TopicCardProps> = ({
  topic,
  onPress,
  commentsCount,
  contentNumberOfLines,
}) => {
  const Container: any = onPress ? TouchableOpacity : View

  return (
    <Container
      className="bg-white rounded-lg p-4 mb-4 shadow-sm"
      {...(onPress ? { onPress, activeOpacity: 0.8 } : {})}
    >
      {/* Title first */}
      <Text className="text font-semibold text-gray-800 mb-2">
        {topic.title}
      </Text>

      {/* File preview next (optional) */}
      {topic.file_id && (
        <View className="mb-3">
          <FilePreview fileId={topic.file_id} />
        </View>
      )}

      {/* Description / content */}
      <Text
        className="text-sm text-gray-600 mb-3 leading-5"
        numberOfLines={contentNumberOfLines}
      >
        {topic.content}
      </Text>

      {/* Author & date */}
      <View className="flex-row justify-between items-center mb-1">
        <Text className="text-xs text-primary-500 font-medium">
          By {topic.author_name}
        </Text>
        <Text className="text-xs text-gray-400">
          {formatDate(topic.created_at)}
        </Text>
      </View>

      {/* Comments count (when provided) */}
      {commentsCount !== undefined && (
        <Text className="text-xs text-gray-600 italic">
          {commentsCount} comment{commentsCount !== 1 ? 's' : ''}
        </Text>
      )}
    </Container>
  )
}
