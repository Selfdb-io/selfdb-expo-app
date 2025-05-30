import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, User, Calendar, MessageSquare, Send, Upload, X, 
  Edit, Trash2, MoreVertical 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAuth } from '@/contexts/AuthContext'
import { db, storage, realtime } from '@/services/selfdb'
import { Topic, Comment } from '@/types'
import { formatDate } from '@/lib/utils'
import { canModifyContent } from '@/lib/permissions'
import { FilePreview } from './FilePreview'

export const TopicDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const [topic, setTopic] = useState<Topic | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [commenting, setCommenting] = useState(false)
  const [commentContent, setCommentContent] = useState('')
  const [commentAuthorName, setCommentAuthorName] = useState('')
  const [commentFile, setCommentFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  
  // Topic edit state
  const [isEditingTopic, setIsEditingTopic] = useState(false)
  const [editTopicTitle, setEditTopicTitle] = useState('')
  const [editTopicContent, setEditTopicContent] = useState('')
  const [editTopicFile, setEditTopicFile] = useState<File | null>(null)
  const [isDeleteTopicDialogOpen, setIsDeleteTopicDialogOpen] = useState(false)
  
  // Comment edit state
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null)
  const [editCommentContent, setEditCommentContent] = useState('')
  const [editCommentFile, setEditCommentFile] = useState<File | null>(null)
  const [isUpdatingComment, setIsUpdatingComment] = useState(false)
  const [commentToDeleteId, setCommentToDeleteId] = useState<number | null>(null)

  const loadTopic = async () => {
    if (!id) return

    try {
      setLoading(true)
      
      // Get topic data using new query builder API
      const topicData = await db
        .from('topics')
        .where('id', id)
        .single()
      
      if (topicData) {
        const loadedTopic = topicData as unknown as Topic
        setTopic(loadedTopic)
        // Load initial values for editing
        setEditTopicTitle(loadedTopic.title)
        setEditTopicContent(loadedTopic.content)
        
        // Load comments for this topic
        const commentsData = await db
          .from('comments')
          .where('topic_id', loadedTopic.id)
          .order('created_at', 'asc')
          .execute()
        
        setComments(commentsData as unknown as Comment[])
      }
    } catch (error) {
      console.error('Failed to load topic:', error)
      setError('Failed to load topic')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateTopic = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic) return

    try {
      setLoading(true)
      setError('')
      setSuccessMessage('')

      let newFileId: string | undefined = topic.file_id

      // Handle file replacement
      if (editTopicFile) {
        // Delete old file if it exists
        if (topic.file_id) {
          try {
            // Get bucket ID for 'discussion' bucket
            const buckets = await storage.buckets.listBuckets()
            const discussionBucket = buckets.find(b => b.name === 'discussion')
            if (discussionBucket) {
              await storage.files.deleteFile(discussionBucket.id, parseInt(topic.file_id))
            }
          } catch (deleteError) {
            console.warn('Could not delete old file:', deleteError)
            // Continue anyway - the new file upload is more important
          }
        }

        // Upload new file
        const uploadResult = await storage.upload('discussion', editTopicFile)
        newFileId = uploadResult.file.id.toString()
      }

      const updatedTopicData = {
        title: editTopicTitle,
        content: editTopicContent,
        file_id: newFileId
      }

      // Update topic using query builder API
      await db
        .from('topics')
        .where('id', topic.id)
        .update(updatedTopicData)

      // Update the local state
      setTopic({
        ...topic,
        ...updatedTopicData
      })

      // Exit editing mode and reset form
      setIsEditingTopic(false)
      setEditTopicFile(null)
      setSuccessMessage('Topic updated successfully')
      
      // Clear success message after a delay
      setTimeout(() => {
        setSuccessMessage('')
      }, 3000)
    } catch (error) {
      console.error('Failed to update topic:', error)
      setError('Failed to update topic. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTopic = async () => {
    if (!topic) return

    try {
      setLoading(true)
      setError('')
      setSuccessMessage('')

      // Delete attached file if it exists
      if (topic.file_id) {
        try {
          const buckets = await storage.buckets.listBuckets()
          const discussionBucket = buckets.find(b => b.name === 'discussion')
          if (discussionBucket) {
            await storage.files.deleteFile(discussionBucket.id, parseInt(topic.file_id))
          }
        } catch (deleteError) {
          console.warn('Could not delete topic file:', deleteError)
          // Continue anyway - the topic deletion is more important
        }
      }

      // Delete topic using query builder API
      await db
        .from('topics')
        .where('id', topic.id)
        .delete()

      // Redirect back to topics list
      navigate('/')
    } catch (error) {
      console.error('Failed to delete topic:', error)
      setError('Failed to delete topic. Please try again.')
      setLoading(false)
      setIsDeleteTopicDialogOpen(false)
    }
  }

  const handleStartEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id)
    setEditCommentContent(comment.content)
    setEditCommentFile(null)
    setError('') // Clear any previous errors
  }

  const handleUpdateComment = async (commentId: number) => {
    if (!topic) return

    try {
      setIsUpdatingComment(true)
      setError('')
      setSuccessMessage('')

      // Find the current comment to get its file_id
      const currentComment = comments.find(c => c.id === commentId)
      let newFileId: string | undefined = currentComment?.file_id

      // Handle file replacement
      if (editCommentFile) {
        // Delete old file if it exists
        if (currentComment?.file_id) {
          try {
            const buckets = await storage.buckets.listBuckets()
            const discussionBucket = buckets.find(b => b.name === 'discussion')
            if (discussionBucket) {
              await storage.files.deleteFile(discussionBucket.id, parseInt(currentComment.file_id))
            }
          } catch (deleteError) {
            console.warn('Could not delete old comment file:', deleteError)
            // Continue anyway - the new file upload is more important
          }
        }

        // Upload new file
        const uploadResult = await storage.upload('discussion', editCommentFile)
        newFileId = uploadResult.file.id.toString()
      }

      const updatedCommentData = {
        content: editCommentContent,
        file_id: newFileId
      }

      // Update comment using query builder API
      await db
        .from('comments')
        .where('id', commentId)
        .update(updatedCommentData)

      // Update the local state
      setComments(comments.map(comment => 
        comment.id === commentId 
          ? { ...comment, ...updatedCommentData } 
          : comment
      ))

      // Exit editing mode and reset form
      setEditingCommentId(null)
      setEditCommentContent('')
      setEditCommentFile(null)
      setSuccessMessage('Comment updated successfully')
      
      // Clear success message after a delay
      setTimeout(() => {
        setSuccessMessage('')
      }, 3000)
    } catch (error) {
      console.error('Failed to update comment:', error)
      setError('Failed to update comment. Please try again.')
    } finally {
      setIsUpdatingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: number) => {
    try {
      setError('')
      setSuccessMessage('')
      
      // Find the comment to get its file_id
      const commentToDelete = comments.find(c => c.id === commentId)
      
      // Delete attached file if it exists
      if (commentToDelete?.file_id) {
        try {
          const buckets = await storage.buckets.listBuckets()
          const discussionBucket = buckets.find(b => b.name === 'discussion')
          if (discussionBucket) {
            await storage.files.deleteFile(discussionBucket.id, parseInt(commentToDelete.file_id))
          }
        } catch (deleteError) {
          console.warn('Could not delete comment file:', deleteError)
          // Continue anyway - the comment deletion is more important
        }
      }
      
      // Delete comment using query builder API
      await db
        .from('comments')
        .where('id', commentId)
        .delete()

      // Update the local state
      setComments(comments.filter(comment => comment.id !== commentId))
      
      // Close the delete dialog
      setCommentToDeleteId(null)
      
      setSuccessMessage('Comment deleted successfully')
      
      // Clear success message after a delay
      setTimeout(() => {
        setSuccessMessage('')
      }, 3000)
    } catch (error) {
      console.error('Failed to delete comment:', error)
      setError('Failed to delete comment. Please try again.')
      setCommentToDeleteId(null)
    }
  }

  useEffect(() => {
    loadTopic()

    // Set up real-time subscription for comments
    const setupRealtime = async () => {
      try {
        await realtime.connect()
        
        // Subscribe to comments changes
        realtime.subscribe('comments', (payload) => {
          console.log('Comments updated:', payload)
          loadTopic() // Reload topic and comments when changes occur
        })
        
        // Also subscribe to topics changes to catch topic updates or deletion
        realtime.subscribe('topics', (payload) => {
          console.log('Topic updated:', payload)
          loadTopic() // Reload topic data when changes occur
        })
        
        console.log('✅ Real-time connections established')
      } catch (error) {
        console.warn('Real-time features disabled:', error)
        // Real-time is optional, continue without it
      }
    }

    setupRealtime()

    return () => {
      try {
        realtime.disconnect()
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }, [id])

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic) return

    setError('')
    setCommenting(true)

    try {
      let fileId: string | undefined

      // Upload file if selected
      if (commentFile) {
        // Upload to the discussion bucket using new simplified API
        const uploadResult = await storage.upload('discussion', commentFile)
        fileId = uploadResult.file.id.toString()
      }

      const commentData = {
        topic_id: topic.id,
        content: commentContent,
        author_name: isAuthenticated ? user!.email : commentAuthorName,
        user_id: isAuthenticated ? user!.id : undefined,
        file_id: fileId
      }

      const newComment = await db.from('comments').insert(commentData) as unknown as Comment
      setComments(prev => [...prev, newComment])

      // Reset form
      setCommentContent('')
      setCommentAuthorName('')
      setCommentFile(null)
    } catch (error) {
      console.error('Failed to create comment:', error)
      setError('Failed to add comment. Please try again.')
    } finally {
      setCommenting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setCommentFile(selectedFile)
      setError('')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500">Loading topic...</div>
      </div>
    )
  }

  if (!topic) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">Topic not found</div>
          <Link to="/" className="text-blue-600 hover:text-blue-800">
            Back to topics
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link 
          to="/" 
          className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to topics</span>
        </Link>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          <p>{error}</p>
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
          <p>{successMessage}</p>
        </div>
      )}

      {/* Topic */}
      <Card className="mb-8">
        <CardHeader>
          {isEditingTopic ? (
            <form onSubmit={handleUpdateTopic} className="space-y-4">
              <Input
                value={editTopicTitle}
                onChange={(e) => setEditTopicTitle(e.target.value)}
                placeholder="Topic title"
                className="text-xl font-bold"
                required
              />
              <div className="flex space-x-2 mt-2">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Updating...' : 'Save changes'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditingTopic(false)
                    setEditTopicTitle(topic.title)
                    setEditTopicContent(topic.content)
                    setEditTopicFile(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">{topic.title}</h1>
                
                {/* Topic actions dropdown for edit/delete */}
                {canModifyContent(topic.user_id, user) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setIsEditingTopic(true)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit topic
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setIsDeleteTopicDialogOpen(true)}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete topic
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <User className="h-4 w-4" />
                  <span>{topic.author_name}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(topic.created_at)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <MessageSquare className="h-4 w-4" />
                  <span>{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</span>
                </div>
              </div>
            </>
          )}
        </CardHeader>
        <CardContent>
          {isEditingTopic ? (
            <div className="space-y-4">
              <Textarea
                value={editTopicContent}
                onChange={(e) => setEditTopicContent(e.target.value)}
                placeholder="What would you like to discuss?"
                rows={6}
                required
              />
              
              {/* File upload section */}
              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <Upload className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-700">
                    {editTopicFile ? editTopicFile.name : 'Replace or add file (optional)'}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => setEditTopicFile(e.target.files?.[0] || null)}
                    accept="image/*,video/*,audio/*,.pdf"
                  />
                </label>
                {editTopicFile && (
                  <div className="mt-2 flex items-center space-x-2">
                    <span className="text-xs text-gray-500">{editTopicFile.name}</span>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setEditTopicFile(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Show current file if no new file selected */}
              {topic.file_id && !editTopicFile && (
                <div className="border rounded-lg p-3 bg-gray-50">
                  <p className="text-sm text-gray-600 mb-2">Current attachment:</p>
                  <FilePreview 
                    fileId={topic.file_id} 
                    loadImmediately={true}
                    useIntersectionObserver={false}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-700 whitespace-pre-wrap mb-4">
              {topic.content}
            </div>
          )}
          {topic.file_id && !isEditingTopic && (
            <FilePreview 
              fileId={topic.file_id} 
              loadImmediately={true}
              useIntersectionObserver={false}
            />
          )}
        </CardContent>
      </Card>

      {/* Delete Topic Confirmation Dialog */}
      <AlertDialog 
        open={isDeleteTopicDialogOpen} 
        onOpenChange={setIsDeleteTopicDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the topic
              and all its comments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteTopic}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Comments */}
      <div className="space-y-4 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">
          Comments ({comments.length})
        </h2>
        
        {comments.map((comment) => (
          <Card key={comment.id}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <User className="h-4 w-4" />
                    <span>{comment.author_name}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(comment.created_at)}</span>
                  </div>
                </div>

                {/* Comment actions dropdown for edit/delete */}
                {canModifyContent(comment.user_id, user) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => handleStartEditComment(comment)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit comment
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setCommentToDeleteId(comment.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete comment
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {editingCommentId === comment.id ? (
                <div className="space-y-3">
                  <Textarea
                    value={editCommentContent}
                    onChange={(e) => setEditCommentContent(e.target.value)}
                    rows={3}
                    required
                  />
                  
                  {/* File upload section */}
                  <div>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <Upload className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700">
                        {editCommentFile ? editCommentFile.name : 'Replace or add file (optional)'}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => setEditCommentFile(e.target.files?.[0] || null)}
                        accept="image/*,video/*,audio/*,.pdf"
                      />
                    </label>
                    {editCommentFile && (
                      <div className="mt-2 flex items-center space-x-2">
                        <span className="text-xs text-gray-500">{editCommentFile.name}</span>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setEditCommentFile(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {/* Show current file if no new file selected */}
                  {comment.file_id && !editCommentFile && (
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <p className="text-sm text-gray-600 mb-2">Current attachment:</p>
                      <FilePreview 
                        fileId={comment.file_id} 
                        loadImmediately={true}
                        useIntersectionObserver={false}
                      />
                    </div>
                  )}
                  
                  <div className="flex space-x-2">
                    <Button 
                      onClick={() => handleUpdateComment(comment.id)}
                      disabled={isUpdatingComment}
                    >
                      {isUpdatingComment ? 'Saving...' : 'Save changes'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setEditingCommentId(null)
                        setEditCommentContent('')
                        setEditCommentFile(null)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-gray-700 whitespace-pre-wrap mb-3">
                    {comment.content}
                  </div>
                  {comment.file_id && (
                    <FilePreview 
                      fileId={comment.file_id} 
                      loadImmediately={true}
                      useIntersectionObserver={false}
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}

        {comments.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No comments yet. Be the first to comment!
          </div>
        )}
      </div>

      {/* Delete Comment Confirmation Dialog */}
      <AlertDialog 
        open={commentToDeleteId !== null} 
        onOpenChange={(isOpen) => {
          if (!isOpen) setCommentToDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this comment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => commentToDeleteId && handleDeleteComment(commentToDeleteId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Comment Form */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Add a Comment</h3>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitComment} className="space-y-4">
            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                {error}
              </div>
            )}

            <div>
              <Textarea
                placeholder="Share your thoughts..."
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                required
                rows={3}
              />
            </div>

            {!isAuthenticated && (
              <div>
                <Input
                  placeholder="Your name"
                  value={commentAuthorName}
                  onChange={(e) => setCommentAuthorName(e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <Upload className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">
                  {commentFile ? commentFile.name : 'Attach file (optional)'}
                </span>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  accept="image/*,video/*,audio/*,.pdf"
                />
              </label>
              {commentFile && (
                <div className="mt-2 flex items-center space-x-2">
                  <span className="text-xs text-gray-500">{commentFile.name}</span>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setCommentFile(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            <Button type="submit" disabled={commenting || !commentContent.trim()}>
              <Send className="h-4 w-4 mr-2" />
              {commenting ? 'Adding...' : 'Add Comment'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}


import React, { useState, useEffect } from 'react'
import { Plus, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { db, storage } from '@/services/selfdb'
import { Topic } from '@/types'

interface CreateTopicProps {
  onTopicCreated: (topic: Topic) => void
  initialTopic?: Topic // Optional topic for editing mode
  onEditComplete?: () => void // Optional callback for when editing is complete
}

export const CreateTopic: React.FC<CreateTopicProps> = ({ 
  onTopicCreated, 
  initialTopic = null, 
  onEditComplete = null 
}) => {
  const { user, isAuthenticated } = useAuth()
  const [isOpen, setIsOpen] = useState(!!initialTopic) // Open by default if editing
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEditMode = !!initialTopic

  // Load initial data if in edit mode
  useEffect(() => {
    if (initialTopic) {
      setTitle(initialTopic.title)
      setContent(initialTopic.content)
      setAuthorName(initialTopic.author_name)
    }
  }, [initialTopic])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let fileId: string | undefined = initialTopic?.file_id

      // Handle file replacement in edit mode
      if (file && isEditMode && initialTopic?.file_id) {
        // Delete old file if it exists and we're uploading a new one
        try {
          const buckets = await storage.buckets.listBuckets()
          const discussionBucket = buckets.find(b => b.name === 'discussion')
          if (discussionBucket) {
            await storage.files.deleteFile(discussionBucket.id, parseInt(initialTopic.file_id))
          }
        } catch (deleteError) {
          console.warn('Could not delete old file:', deleteError)
          // Continue anyway - the new file upload is more important
        }
      }

      // Upload file if selected
      if (file) {
        // Upload to the discussion bucket using new simplified API
        const uploadResult = await storage.upload('discussion', file)
        fileId = uploadResult.file.id.toString()
      }

      if (isEditMode) {
        // Update topic using query builder API
        const updatedTopicData = {
          title,
          content,
          file_id: fileId
        }

        await db
          .from('topics')
          .where('id', initialTopic.id)
          .update(updatedTopicData)

        // Update the local state
        const updatedTopic = {
          ...initialTopic,
          ...updatedTopicData
        }

        onTopicCreated(updatedTopic)

        // Call the edit complete callback if provided
        if (onEditComplete) {
          onEditComplete()
        }
      } else {
        // Create topic using new query builder API
        const topicData = {
          title,
          content,
          author_name: isAuthenticated ? user!.email : authorName,
          user_id: isAuthenticated ? user!.id : undefined,
          file_id: fileId
        }

        const newTopic = await db.from('topics').insert(topicData) as unknown as Topic
        onTopicCreated(newTopic)
      }

      // Reset form
      setTitle('')
      setContent('')
      setAuthorName('')
      setFile(null)
      setIsOpen(false)
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} topic:`, error)
      setError(`Failed to ${isEditMode ? 'update' : 'create'} topic. Please try again.`)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError('')
    }
  }

  // If component is not in editing mode and create button has not been clicked
  if (!isOpen && !isEditMode) {
    return (
      <div className="mb-6">
        <Button 
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Create New Topic</span>
        </Button>
      </div>
    )
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>{isEditMode ? 'Edit Topic' : 'Create New Topic'}</CardTitle>
          {!isEditMode && (
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
              {error}
            </div>
          )}

          <div>
            <Input
              placeholder="Topic title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <Textarea
              placeholder="What would you like to discuss?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={4}
            />
          </div>

          {!isAuthenticated && !isEditMode && (
            <div>
              <Input
                placeholder="Your name"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <Upload className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-700">
                {file ? file.name : (initialTopic?.file_id ? 'Replace file' : 'Attach file (optional)')}
              </span>
              <input
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept="image/*,video/*,audio/*,.pdf"
              />
            </label>
            {file && (
              <div className="mt-2 flex items-center space-x-2">
                <span className="text-xs text-gray-500">{file.name}</span>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setFile(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex space-x-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Topic' : 'Create Topic')}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                if (isEditMode && onEditComplete) {
                  onEditComplete()
                } else {
                  setIsOpen(false)
                }
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}