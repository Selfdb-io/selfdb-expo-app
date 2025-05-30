import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Image } from 'expo-image'
import Video from 'react-native-video' // Your current video player
import { Ionicons } from '@expo/vector-icons'
import { storage } from '@/services/selfdb'
import { FileMetadata, MediaType } from '@/types'

/**
 * FilePreview Component
 * 
 * Displays media files (images, videos, audio, PDFs, etc.) with support for both:
 * - Remote files stored in SelfDB (using fileId)
 * - Local files from device camera/photo library (using localUri)
 * 
 * For videos, it provides:
 * - Play/pause controls with custom overlay
 * - Proper handling of both local and remote video sources
 * - Enhanced error handling and logging for debugging
 * 
 * Usage Examples:
 * 
 * // Remote file from SelfDB
 * <FilePreview fileId="123" style={styles.preview} />
 * 
 * // Local file from camera/photo library
 * <FilePreview localUri="file:///path/to/video.mp4" style={styles.preview} />
 * 
 * // With onPress handler
 * <FilePreview fileId="123" onPress={() => console.log('Pressed')} />
 */

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

// Helper function to detect if a URI is local
function isLocalUri(uri: string): boolean {
  return uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('/') || uri.includes('ExponentExperienceData')
}

interface FilePreviewProps {
  fileId?: string  // For remote files stored in SelfDB
  localUri?: string  // For local files (from camera/photo library)
  style?: object
  onPress?: () => void
  // Note: Provide either fileId OR localUri, not both
}

export const FilePreview: React.FC<FilePreviewProps> = ({ 
  fileId, 
  localUri,
  style,
  onPress 
}) => {
  const [file, setFile] = useState<FileMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [publicUrl, setPublicUrl] = useState<string | null>(null)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [isLocalFile, setIsLocalFile] = useState(false)
  // imageDimensions state is not strictly needed for auto-sizing,
  // but could be used for more advanced layout if desired.
  // Keeping it for now as it's not hurting.
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    // Validate that only one of fileId or localUri is provided
    if (fileId && localUri) {
      console.warn('FilePreview: Both fileId and localUri provided. Using localUri and ignoring fileId.')
    }

    if (localUri) {
      // Handle local file
      setIsLocalFile(true)
      setPublicUrl(localUri)
      setFile({
        filename: localUri.split('/').pop() || 'local_file',
        created_at: new Date().toISOString(),
        size: 0,
        content_type: ''
      } as FileMetadata)
      setLoading(false)
      setError(null)
      console.log('📱 Local file set:', localUri)
      return
    }

    if (!fileId) {
      setLoading(false)
      setError('No file provided')
      return
    }

    setIsLocalFile(false)
    loadFile()
  }, [fileId, localUri])

  const loadFile = async () => {
    if (!fileId) {
      setError('No file ID provided')
      setLoading(false)
      return
    }

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

  if (error || !publicUrl || (!file && !localUri)) {
    return (
      <View style={[styles.container, styles.errorContainer, style]}>
        <Text style={styles.errorText}>📎 Attachment unavailable</Text>
      </View>
    )
  }

  const mediaType = isLocalFile 
    ? getMediaTypeFromUrl(localUri || '') 
    : getMediaTypeFromUrl(file?.filename || publicUrl)

  const renderContent = () => {
    switch (mediaType) {
      case 'image':
        return (
          <Image
            source={{ uri: publicUrl }}
            // Apply base image style and any passed style.
            // styles.image will now correctly handle auto height.
            style={[styles.image, style]} 
            contentFit="contain" // Ensures the whole image is visible
            transition={200}
            placeholder="📷"
            // You can keep or remove onLoadEnd depending on if you need dimensions for other logic
            // onLoadEnd={(event) => {
            //   if (event.nativeEvent.width && event.nativeEvent.height) {
            //     setImageDimensions({
            //       width: event.nativeEvent.width,
            //       height: event.nativeEvent.height,
            //     });
            //   }
            // }}
          />
        )
      
      case 'video':
        return (
          // For video, you might want a fixed height for the container,
          // or dynamically set it if you can fetch video dimensions.
          // Your current setup uses `height: 300` in styles.videoContainer.
          <View style={[styles.videoContainer, style]}>
            <Video
              source={{ uri: publicUrl }}
              style={styles.video}
              controls={false}
              resizeMode="cover" // or 'contain' if you want black bars for aspect ratio
              paused={!isVideoPlaying}
              poster={undefined} // You might want a poster image for videos
              onLoad={(data) => {
                console.log('Video loaded:', data)
                // For local videos, you might want to handle this differently
                if (isLocalFile) {
                  console.log('Local video loaded successfully')
                }
              }}
              onError={(error) => {
                console.error('Video error:', error)
                // For local videos, provide more specific error handling
                if (isLocalFile) {
                  console.error('Local video playback error - check file format and permissions')
                }
              }}
              // Additional props that might help with local video playback
              onReadyForDisplay={() => {
                if (isLocalFile) {
                  console.log('Local video ready for display')
                }
              }}
              // Ensure proper handling for different video sources
              {...(isLocalFile ? {
                // Local video specific props if needed
                // You might need to adjust these based on react-native-video version
              } : {
                // Remote video specific props if needed
              })}
            />
            {!isVideoPlaying && (
              <TouchableOpacity
                style={styles.playButtonOverlay}
                onPress={() => {
                  console.log(`Starting ${isLocalFile ? 'local' : 'remote'} video playback`)
                  setIsVideoPlaying(true)
                }}
                activeOpacity={0.8}
              >
                <View style={styles.playButton}>
                  <Ionicons name="play" size={28} color="white" style={styles.playIcon} />
                </View>
              </TouchableOpacity>
            )}
            {isVideoPlaying && (
              <TouchableOpacity
                style={styles.videoTouchArea}
                onPress={() => {
                  console.log(`Pausing ${isLocalFile ? 'local' : 'remote'} video playback`)
                  setIsVideoPlaying(false)
                }}
                activeOpacity={1}
              />
            )}
          </View>
        )
      
      case 'audio':
        return (
          <View style={styles.mediaPlaceholder}>
            <Text style={styles.mediaIcon}>🎵</Text>
            <Text style={styles.mediaText}>Audio</Text>
            <Text style={styles.fileName}>{file?.filename || (localUri ? localUri.split('/').pop() : 'Audio file')}</Text>
          </View>
        )
      
      case 'pdf':
        return (
          <View style={styles.mediaPlaceholder}>
            <Text style={styles.mediaIcon}>📄</Text>
            <Text style={styles.mediaText}>PDF</Text>
            <Text style={styles.fileName}>{file?.filename || (localUri ? localUri.split('/').pop() : 'PDF file')}</Text>
          </View>
        )
      
      default:
        return (
          <View style={styles.mediaPlaceholder}>
            <Text style={styles.mediaIcon}>📎</Text>
            <Text style={styles.mediaText}>File</Text>
            <Text style={styles.fileName}>{file?.filename || (localUri ? localUri.split('/').pop() : 'File')}</Text>
          </View>
        )
    }
  }

  const Container = onPress ? TouchableOpacity : View

  return (
    // Pass the style prop directly to the main container.
    // Ensure the container using FilePreview doesn't impose a fixed height on it.
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
    // The height of this container will now be determined by its content (the image)
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 100, // This is for loading/error states, which is fine
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
    // REMOVED: aspectRatio: 1,
    // REMOVED: height: 200, // <--- THIS WAS THE PROBLEM! Removed to allow auto-sizing
    width: '100%', // Makes the image fill the width of its container
    height: 250, // Crucial: Allows height to be determined by contentFit and width
    backgroundColor: '#f0f0f0', // Fallback background if image fails to load or during transitions
    maxWidth: '100%', // Ensures it doesn't exceed parent's width (redundant with width: '100%' but harmless)
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  videoContainer: {
    position: 'relative',
    width: '100%',
    height: 300, // This height is still fixed for videos. You might want to make this dynamic too.
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 35,
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  playIcon: {
    marginLeft: 2, // Slight offset to center the triangle visually
  },
  videoTouchArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    // You might want to define a minHeight for placeholders to avoid them collapsing too much
    minHeight: 150, 
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