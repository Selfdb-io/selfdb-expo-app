// Re-export types from SelfDB SDK
import type { User as SDKUser, FileMetadata } from '@selfdb/js-sdk'
export type User = SDKUser
export type { FileMetadata }

// Application-specific types
export type MediaType = 'image' | 'video' | 'audio' | 'pdf' | 'other'

export interface Topic {
  id: number
  title: string
  content: string
  author_name: string // For anonymous users
  user_id?: string // For authenticated users (matches SDK User.id type)
  file_id?: string // For media attachments (FilePreview expects string)
  comments?: Comment[] // Array of comments
  comment_count?: number // Count of comments for display
  created_at: string
  updated_at: string
}

export interface Comment {
  id: number
  topic_id: number
  content: string
  author_name: string // For anonymous users
  user_id?: string // For authenticated users (matches SDK User.id type)
  file_id?: string // For media attachments (FilePreview expects string)
  created_at: string
  updated_at: string
}

// Auth context types
export interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  loading: boolean
}
