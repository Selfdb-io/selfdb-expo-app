import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Comment } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { db, storage } from '@/services/selfdb'
import { canModifyContent } from '@/lib/permissions'
import { FilePreview } from '@/components/FilePreview'
import { showMediaPickerOptions, safeLaunchCamera, safeLaunchImageLibrary } from '@/lib/deviceUtils'

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
  const { user, isAuthenticated } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [loading, setLoading] = useState(false)

  // Edit state
  const [editContent, setEditContent] = useState(comment.content)
  const [editAuthorName, setEditAuthorName] = useState(comment.author_name)
  const [editFile, setEditFile] = useState<string | null>(null)

  const canModify = canModifyContent(comment.user_id, user)

  if (!canModify) {
    return null
  }

  const handleStartEdit = () => {
    setIsEditing(true)
    setEditContent(comment.content)
    setEditAuthorName(comment.author_name)
    setEditFile(null)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditContent(comment.content)
    setEditAuthorName(comment.author_name)
    setEditFile(null)
  }

  const handleEditFileChange = async () => {
    try {
      const options = await showMediaPickerOptions(
        async () => {
          const result = await safeLaunchCamera()
          if (result && !result.canceled && result.assets[0]) {
            setEditFile(result.assets[0].uri)
          }
        },
        async () => {
          const result = await safeLaunchImageLibrary()
          if (result && !result.canceled && result.assets[0]) {
            setEditFile(result.assets[0].uri)
          }
        }
      )
      
      Alert.alert(
        'Select Media',
        'Choose how you want to add media',
        options
      )
    } catch (error) {
      console.error('Error showing media options:', error)
      Alert.alert('Error', 'Failed to show media options.')
    }
  }

  const handleRemoveCurrentFile = async () => {
    if (!comment.file_id) return

    Alert.alert(
      'Remove Attachment',
      'Are you sure you want to remove the current attachment?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true)
              
              // Delete file from storage
              await storage.files.deleteFile('discussion', comment.file_id!)

              // Update comment in database to remove file_id
              await db
                .from('comments')
                .where('id', comment.id)
                .update({ file_id: null })

              // Update parent component
              const updatedComment = { ...comment, file_id: undefined }
              onCommentUpdated(updatedComment)
              
              Alert.alert('Success', 'Attachment removed successfully')
            } catch (error) {
              console.error('Failed to remove comment file:', error)
              Alert.alert('Error', 'Failed to remove attachment. Please try again.')
            } finally {
              setLoading(false)
            }
          },
        },
      ]
    )
  }

  const handleSaveEdit = async () => {
    if (!editContent.trim()) {
      Alert.alert('Error', 'Please enter comment content')
      return
    }

    if (!isAuthenticated && !editAuthorName.trim()) {
      Alert.alert('Error', 'Please enter your name')
      return
    }

    try {
      setLoading(true)

      let newFileId = comment.file_id

      // Handle file upload if a new file is selected
      if (editFile) {
        try {
          // Create a File object from the URI
          const fileInfo = await fetch(editFile)
          const blob = await fileInfo.blob()
          const fileName = editFile.split('/').pop() || 'file'
          
          const file = new File([blob], fileName, {
            type: blob.type || 'application/octet-stream'
          })
          
          const uploadResult = await storage.upload('discussion', file)
          newFileId = uploadResult.file.id.toString()

          // Delete old file if it exists and is different
          if (comment.file_id && comment.file_id !== newFileId) {
            try {
              await storage.files.deleteFile('discussion', comment.file_id)
            } catch (deleteError) {
              console.warn('Could not delete old comment file:', deleteError)
            }
          }
        } catch (uploadError) {
          console.error('Failed to upload new comment file:', uploadError)
          Alert.alert('Error', 'Failed to upload new file. Please try again.')
          setLoading(false)
          return
        }
      }

      const updatedCommentData = {
        content: editContent.trim(),
        file_id: newFileId || null
      }

      // Update comment using query builder API
      await db
        .from('comments')
        .where('id', comment.id)
        .update(updatedCommentData)

      // Update parent component
      const updatedComment = { 
        ...comment, 
        ...updatedCommentData, 
        file_id: updatedCommentData.file_id || undefined 
      }
      onCommentUpdated(updatedComment)

      // Reset edit state
      setIsEditing(false)
      setEditContent(comment.content)
      setEditFile(null)
      setEditAuthorName(comment.author_name)
    } catch (error) {
      console.error('Failed to update comment:', error)
      Alert.alert('Error', 'Failed to update comment. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      setLoading(true)

      // Delete attached file if it exists
      if (comment.file_id) {
        try {
          await storage.files.deleteFile('discussion', comment.file_id)
        } catch (deleteError) {
          console.warn('Could not delete comment file:', deleteError)
        }
      }

      // Delete comment using query builder API
      await db
        .from('comments')
        .where('id', comment.id)
        .delete()

      // Update parent component
      onCommentDeleted(comment.id.toString())
      
      // Close dialogs
      setShowDeleteDialog(false)
    } catch (error) {
      console.error('Failed to delete comment:', error)
      Alert.alert('Error', 'Failed to delete comment. Please try again.')
    } finally {
      setLoading(false)
      setShowDeleteDialog(false)
    }
  }

  return (
    <>
      {/* Three dots menu trigger - directly opens edit modal */}
      <TouchableOpacity
        style={styles.menuButton}
        onPress={handleStartEdit}
      >
        <Ionicons name="ellipsis-vertical" size={20} color="#666" />
      </TouchableOpacity>

      {/* Edit Modal */}
      <Modal
        visible={isEditing}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCancelEdit}
      >
        <KeyboardAvoidingView 
          style={styles.editContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.editHeader}>
            <TouchableOpacity
              style={styles.editCancelButton}
              onPress={handleCancelEdit}
            >
              <Text style={styles.editCancelText}>Cancel</Text>
            </TouchableOpacity>
            
            <View style={styles.editHeaderCenter}>
              <Text style={styles.editTitle}>Edit Comment</Text>
              <TouchableOpacity
                style={styles.editDeleteButton}
                onPress={() => setShowDeleteDialog(true)}
              >
                <Ionicons name="trash" size={20} color="#ff4757" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[styles.editSaveButton, loading && styles.buttonDisabled]}
              onPress={handleSaveEdit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#007AFF" size="small" />
              ) : (
                <Text style={styles.editSaveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.editContent} keyboardShouldPersistTaps="handled">
            <TextInput
              style={[styles.input, styles.commentInput]}
              placeholder="Edit your comment..."
              placeholderTextColor="#666"
              value={editContent}
              onChangeText={setEditContent}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              autoFocus
            />
            
            {!isAuthenticated && (
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor="#666"
                value={editAuthorName}
                onChangeText={setEditAuthorName}
              />
            )}

            {/* File Upload Section */}
            <View style={styles.fileSection}>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={handleEditFileChange}
                disabled={loading}
              >
                <View style={styles.uploadButtonContent}>
                  <Ionicons name="camera" size={20} color="#007AFF" style={styles.uploadIcon} />
                  <Text style={styles.uploadButtonText}>
                    {editFile ? 'Replace Photo/Video' : (comment.file_id ? 'Replace Photo/Video' : 'Add Photo/Video')}
                  </Text>
                </View>
              </TouchableOpacity>

              {editFile && (
                <View style={styles.filePreview}>
                  <FilePreview 
                    localUri={editFile}
                    style={styles.previewImage}
                  />
                  <TouchableOpacity
                    style={styles.removeFileButton}
                    onPress={() => setEditFile(null)}
                  >
                    <Ionicons name="close-circle" size={20} color="white" />
                    <Text style={styles.removeFileText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}

              {comment.file_id && !editFile && (
                <View style={styles.currentFilePreview}>
                  <View style={styles.currentFileHeader}>
                    <Text style={styles.currentFileText}>Current attachment:</Text>
                    <TouchableOpacity
                      style={styles.removeCurrentFileButton}
                      onPress={handleRemoveCurrentFile}
                      disabled={loading}
                    >
                      <Ionicons name="close-circle" size={20} color="#ff4757" />
                      <Text style={styles.removeCurrentFileText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                  <FilePreview fileId={comment.file_id} style={styles.currentFileImage} />
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <Modal
        visible={showDeleteDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteDialog(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <Text style={styles.deleteModalTitle}>Delete Comment?</Text>
            <Text style={styles.deleteModalText}>
              This action cannot be undone. This will permanently delete this comment.
            </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={styles.deleteModalCancel}
                onPress={() => setShowDeleteDialog(false)}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteModalConfirm}
                onPress={handleDelete}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.deleteModalConfirmText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  menuButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
  },
  editContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  editHeaderCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editDeleteButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fff5f5',
  },
  editCancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  editCancelText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  editTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  editSaveButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  editSaveText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  editContent: {
    flex: 1,
    padding: 20,
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
    height: 120,
    paddingTop: 12,
  },
  fileSection: {
    marginBottom: 15,
  },
  uploadButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  uploadButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadIcon: {
    marginRight: 8,
  },
  uploadButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  filePreview: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 150,
    borderRadius: 6,
    marginBottom: 10,
  },
  removeFileButton: {
    backgroundColor: '#ff4757',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  removeFileText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  currentFilePreview: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
  },
  currentFileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  currentFileText: {
    fontSize: 12,
    color: '#666',
  },
  removeCurrentFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff4757',
    padding: 8,
    borderRadius: 6,
  },
  removeCurrentFileText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 5,
  },
  currentFileImage: {
    borderRadius: 6,
    minHeight: 100,
    maxHeight: 300,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    minWidth: 300,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  deleteModalText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  deleteModalCancel: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  deleteModalCancelText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteModalConfirm: {
    backgroundColor: '#ff4757',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  deleteModalConfirmText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})
