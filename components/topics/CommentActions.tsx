import React, { useState } from 'react'
import {
  View,
  TouchableOpacity,
  Modal,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Comment } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { canModifyContent } from '@/lib/permissions'
import { CreateComment } from '@/components/topics/CreateComment'

interface CommentActionsProps {
  comment: Comment
  onCommentUpdated: (updatedComment: Comment) => void
  onCommentDeleted: (commentId: string) => void
}

export const CommentActions: React.FC<CommentActionsProps> = ({
  comment,
  onCommentUpdated,
  onCommentDeleted,
}) => {
  const { user } = useAuth()
  const [isEditingComment, setIsEditingComment] = useState(false)

  const canModify = canModifyContent(comment.user_id, user)

  if (!canModify) {
    return null
  }

  const handleCommentEdited = (updatedComment: Comment) => {
    onCommentUpdated(updatedComment)
    setIsEditingComment(false)
  }

  const handleCommentDeleted = () => {
    onCommentDeleted(comment.id.toString())
    setIsEditingComment(false)
  }

  return (
    <>
      {/* Three dots menu button */}
      <TouchableOpacity
        className="p-2 rounded-md bg-gray-50"
        onPress={() => setIsEditingComment(true)}
      >
        <Ionicons name="ellipsis-vertical" size={20} color="#666" />
      </TouchableOpacity>

      {/* Edit Comment Modal */}
      <Modal
        visible={isEditingComment}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEditingComment(false)}
      >
        <View className="flex-1 bg-gray-100">
          <CreateComment
            topicId={comment.topic_id.toString()}
            initialComment={comment}
            onCommentCreated={handleCommentEdited}
            onCancel={() => setIsEditingComment(false)}
            onEditComplete={() => setIsEditingComment(false)}
            onCommentDeleted={handleCommentDeleted}
            onCommentUpdated={() => {
              // This can trigger any additional updates if needed
            }}
          />
        </View>
      </Modal>
    </>
  )
}