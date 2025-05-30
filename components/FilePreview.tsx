import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Image } from 'expo-image'
import { storage } from '@/services/selfdb'
import { FileMetadata, MediaType } from '@/types'

// Simple file extension to media type mapping for quick lookups
const EXTENSION_MAP: Record<string, MediaType> = {
  // Images
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image',
  // Videos
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  avi: 'video',
  // Audio
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  // Documents
  pdf: 'pdf',
  doc: 'other',
  docx: 'other',
  txt: 'other',
}

function getMediaTypeFromUrl(url: string): MediaType {
  if (!url) return 'other'
  
  const extension = url.split('.').pop()?.toLowerCase()
  return extension ? EXTENSION_MAP[extension] || 'other' : 'other'
}

interface FilePreviewProps {
  fileId: string
  style?: object
  onPress?: () => void
}

export const FilePreview: React.FC<FilePreviewProps> = ({ 
  fileId, 
  style,
  onPress 
}) => {
  const [file, setFile] = useState<FileMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [publicUrl, setPublicUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!fileId) {
      setLoading(false)
      return
    }

    loadFile()
  }, [fileId])

  const loadFile = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('Loading file with ID:', fileId)
      
      // Try public view endpoint first (for anonymous access)
      let viewResponse
      try {
        console.log('Trying public view endpoint...')
        viewResponse = await storage.files.getPublicFileViewInfo(fileId)
        console.log('✅ Public view endpoint success:', viewResponse)
      } catch (publicErr) {
        console.log('❌ Public view failed, trying authenticated:', publicErr)
        try {
          viewResponse = await storage.files.getFileViewInfo(fileId)
          console.log('✅ Authenticated view endpoint success:', viewResponse)
        } catch (authErr) {
          console.error('❌ Both view endpoints failed:', authErr)
          throw authErr
        }
      }
      
      if (!viewResponse || !viewResponse.data || !viewResponse.data.file_metadata || !viewResponse.data.view_url) {
        throw new Error('Invalid response from file endpoint')
      }
      
      setFile(viewResponse.data.file_metadata)
      setPublicUrl(viewResponse.data.view_url)
      
      console.log('📁 File metadata:', viewResponse.data.file_metadata)
      console.log('🔗 View URL set to:', viewResponse.data.view_url)
    } catch (err) {
      console.error('Failed to load file:', err)
      setError('Failed to load file')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, style]}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    )
  }

  if (error || !file || !publicUrl) {
    return (
      <View style={[styles.container, styles.errorContainer, style]}>
        <Text style={styles.errorText}>📎 Attachment unavailable</Text>
      </View>
    )
  }

  const mediaType = getMediaTypeFromUrl(file.filename || publicUrl)

  const renderContent = () => {
    switch (mediaType) {
      case 'image':
        return (
          <Image
            source={{ uri: publicUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            placeholder="📷"
          />
        )
      
      case 'video':
        return (
          <View style={styles.mediaPlaceholder}>
            <Text style={styles.mediaIcon}>🎬</Text>
            <Text style={styles.mediaText}>Video</Text>
            <Text style={styles.fileName}>{file.filename}</Text>
          </View>
        )
      
      case 'audio':
        return (
          <View style={styles.mediaPlaceholder}>
            <Text style={styles.mediaIcon}>🎵</Text>
            <Text style={styles.mediaText}>Audio</Text>
            <Text style={styles.fileName}>{file.filename}</Text>
          </View>
        )
      
      case 'pdf':
        return (
          <View style={styles.mediaPlaceholder}>
            <Text style={styles.mediaIcon}>📄</Text>
            <Text style={styles.mediaText}>PDF</Text>
            <Text style={styles.fileName}>{file.filename}</Text>
          </View>
        )
      
      default:
        return (
          <View style={styles.mediaPlaceholder}>
            <Text style={styles.mediaIcon}>📎</Text>
            <Text style={styles.mediaText}>File</Text>
            <Text style={styles.fileName}>{file.filename}</Text>
          </View>
        )
    }
  }

  const Container = onPress ? TouchableOpacity : View

  return (
    <Container style={[styles.container, style]} onPress={onPress}>
      {renderContent()}
    </Container>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    maxWidth: '100%',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 100,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fee',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 12,
  },
  image: {
    width: '100%',
    height: 180,
    backgroundColor: '#f0f0f0',
    maxWidth: '100%',
  },
  mediaPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    maxWidth: '100%',
  },
  mediaIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  mediaText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
  },
  fileName: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    maxWidth: '100%',
  },
})