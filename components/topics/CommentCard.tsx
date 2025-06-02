import React from 'react'
import { View, Text } from 'react-native'
import { Comment } from '@/types'
import { formatDate } from '@/lib/utils'
import { FilePreview } from '../FilePreview'
import { CommentActions } from './CommentActions'

interface CommentCardProps {
  comment: Comment
  onCommentUpdated: (c: Comment) => void
  onCommentDeleted: (id: string) => void
}

export const CommentCard: React.FC<CommentCardProps> = ({
  comment,
  onCommentUpdated,
  onCommentDeleted,
}) => (
  <View className="bg-white rounded-lg p-4 mb-3 shadow-sm border border-gray-200
                   dark:bg-gray-800 dark:border-gray-700">
    <View className="flex-row justify-between items-start gap-3">
      <View className="flex-1">
        <Text className="text-sm text-gray-600 dark:text-gray-300 leading-5 mb-3">
          {comment.content}
        </Text>
      </View>

      <CommentActions
        comment={comment}
        onCommentUpdated={onCommentUpdated}
        onCommentDeleted={onCommentDeleted}
      />
    </View>

    {comment.file_id && (
      <View className="my-3">
        <FilePreview fileId={comment.file_id} />
      </View>
    )}

    <View className="flex-row justify-between items-center">
      <Text className="text-xs text-primary-500 font-medium">
        {comment.author_name}
      </Text>
      <Text className="text-xs text-gray-400 dark:text-gray-500">
        {formatDate(comment.created_at)}
      </Text>
    </View>
  </View>
)
