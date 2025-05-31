import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, StatusBar } from 'react-native'
import { Image } from 'expo-image'
import Video from 'react-native-video' // Your current video player
import { Ionicons } from '@expo/vector-icons'
import { storage } from '@/services/selfdb'
import { FileMetadata, MediaType } from '@/types'

// Metadata cache to prevent redundant API calls
const metadataCache = new Map<string, {
  file: FileMetadata
  publicUrl: string
  timestamp: number
}>()

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000

// Clean up expired cache entries
const cleanupCache = () => {
  const now = Date.now()
  for (const [key, value] of metadataCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      metadataCache.delete(key)
    }
  }
}

// Run cleanup every 2 minutes
setInterval(cleanupCache, 2 * 60 * 1000)

// Global function to preload image metadata (can be called from parent components)
export const preloadFileMetadata = async (fileId: string): Promise<void> => {
  if (!fileId || metadataCache.has(fileId)) return
  
  try {
    console.log('🔄 Preloading metadata for file:', fileId)
    const viewResponse = await storage.files.getPublicFileViewInfo(fileId).catch(() => 
      storage.files.getFileViewInfo(fileId)
    )
    
    if (viewResponse?.data?.file_metadata && viewResponse?.data?.view_url) {
      metadataCache.set(fileId, {
        file: viewResponse.data.file_metadata,
        publicUrl: viewResponse.data.view_url,
        timestamp: Date.now()
      })
      console.log('✅ Preloaded metadata for file:', fileId)
    }
  } catch (error) {
    console.warn('Failed to preload metadata for file:', fileId, error)
  }
}

/**
 * FilePreview Component
 * 
 * Displays media files (images, videos, audio, PDFs, etc.) with support for both:
 * - Remote files stored in SelfDB (using fileId)
 * - Local files from device camera/photo library (using localUri)
 * 
 * Features:
 * - Native image caching with 'memory-disk' policy for optimal performance
 * - Metadata caching (5-minute TTL) to prevent redundant API calls
 * - Automatic cache cleanup to prevent memory leaks
 * - Play/pause controls for videos with fullscreen support
 * - Proper handling of both local and remote media sources
 * - Enhanced error handling and logging for debugging
 * 
 * Performance Optimizations:
 * - Images are cached using expo-image's memory-disk caching
 * - File metadata is cached in memory to avoid API calls on navigation
 * - Cache is automatically cleaned up every 2 minutes
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
  const [isFullscreen, setIsFullscreen] = useState(false)
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

      // Check cache first
      const cachedData = metadataCache.get(fileId)
      const now = Date.now()
      
      if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
        console.log('📋 Using cached metadata for file:', fileId)
        setFile(cachedData.file)
        setPublicUrl(cachedData.publicUrl)
        setLoading(false)
        return
      }

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
      
      const fileMetadata = viewResponse.data.file_metadata
      const viewUrl = viewResponse.data.view_url
      
      // Cache the metadata
      metadataCache.set(fileId, {
        file: fileMetadata,
        publicUrl: viewUrl,
        timestamp: now
      })
      
      setFile(fileMetadata)
      setPublicUrl(viewUrl)
      
      console.log('📁 File metadata cached:', fileMetadata)
      console.log('🔗 View URL cached:', viewUrl)
    } catch (err) {
      console.error('Failed to load file:', err)
      setError('Failed to load file')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View className="rounded-lg overflow-hidden bg-gray-100 max-w-full justify-center items-center" style={[{ height: 256 }, style]}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    )
  }

  if (error || !publicUrl || (!file && !localUri)) {
    return (
      <View className="rounded-lg overflow-hidden bg-red-50 max-w-full justify-center items-center p-2.5" style={[{ height: 256 }, style]}>
        <Text className="text-red-600 text-xs">📎 Attachment unavailable</Text>
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
            style={{ width: '100%', height: 256 }}
            contentFit="cover"
            transition={0} // Disable transition for cached images
            placeholder="📷"
            cachePolicy="memory-disk"
            recyclingKey={fileId || publicUrl} // Help with component recycling
            priority="high" // High priority for loading
            onError={(error) => {
              console.error('Image load error:', error)
            }}
            onLoad={() => {
              // Only log if not from cache to reduce noise
              if (!metadataCache.has(fileId || '')) {
                console.log('Image loaded successfully:', publicUrl)
              }
            }}
          />
        )
      
      case 'video':
        return (
          <View style={{ position: 'relative', width: '100%', height: 256 }}>
            <Video
              source={{ uri: publicUrl }}
              style={{ width: '100%', height: '100%', backgroundColor: '#f3f4f6' }}
              controls={false}
              resizeMode="cover"
              paused={!isVideoPlaying}
              poster={undefined}
              onLoad={(data) => {
                console.log('Video loaded:', data)
                if (isLocalFile) {
                  console.log('Local video loaded successfully')
                }
              }}
              onError={(error) => {
                console.error('Video error:', error)
                if (isLocalFile) {
                  console.error('Local video playback error - check file format and permissions')
                }
              }}
              onReadyForDisplay={() => {
                if (isLocalFile) {
                  console.log('Local video ready for display')
                }
              }}
              {...(isLocalFile ? {} : {})}
            />
            {!isVideoPlaying && (
              <TouchableOpacity
                className="absolute top-0 left-0 right-0 bottom-0 justify-center items-center bg-black/30"
                onPress={() => {
                  console.log(`Starting ${isLocalFile ? 'local' : 'remote'} video playback`)
                  setIsVideoPlaying(true)
                }}
                activeOpacity={0.8}
              >
                <View className="bg-black/70 rounded-full w-16 h-16 justify-center items-center border-2 border-white">
                  <Ionicons name="play" size={28} color="white" style={{ marginLeft: 2 }} />
                </View>
              </TouchableOpacity>
            )}
            {isVideoPlaying && (
              <TouchableOpacity
                className="absolute top-0 left-0 right-0 bottom-0"
                onPress={() => {
                  console.log(`Pausing ${isLocalFile ? 'local' : 'remote'} video playback`)
                  setIsVideoPlaying(false)
                }}
                activeOpacity={1}
              />
            )}
            {isVideoPlaying && (
              <TouchableOpacity
                className="absolute top-2.5 right-2.5 bg-black/70 rounded-full w-10 h-10 justify-center items-center"
                onPress={() => setIsFullscreen(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="expand" size={20} color="white" />
              </TouchableOpacity>
            )}
          </View>
        )
      
      case 'audio':
        return (
          <View className="justify-center items-center p-5 bg-gray-100 border border-gray-300 border-dashed max-w-full" style={{ height: 256 }}>
            <Text className="text-4xl mb-2">🎵</Text>
            <Text className="text-sm font-medium text-gray-600 mb-1">Audio</Text>
            <Text className="text-xs text-gray-400 text-center max-w-full">
              {file?.filename || (localUri ? localUri.split('/').pop() : 'Audio file')}
            </Text>
          </View>
        )
      
      case 'pdf':
        return (
          <View className="justify-center items-center p-5 bg-gray-100 border border-gray-300 border-dashed max-w-full" style={{ height: 256 }}>
            <Text className="text-4xl mb-2">📄</Text>
            <Text className="text-sm font-medium text-gray-600 mb-1">PDF</Text>
            <Text className="text-xs text-gray-400 text-center max-w-full">
              {file?.filename || (localUri ? localUri.split('/').pop() : 'PDF file')}
            </Text>
          </View>
        )
      
      default:
        return (
          <View className="justify-center items-center p-5 bg-gray-100 border border-gray-300 border-dashed max-w-full" style={{ height: 256 }}>
            <Text className="text-4xl mb-2">📎</Text>
            <Text className="text-sm font-medium text-gray-600 mb-1">File</Text>
            <Text className="text-xs text-gray-400 text-center max-w-full">
              {file?.filename || (localUri ? localUri.split('/').pop() : 'File')}
            </Text>
          </View>
        )
    }
  }

  const Container = onPress ? TouchableOpacity : View

  // Fullscreen Video Modal
  const renderFullscreenVideo = () => (
    <Modal
      visible={isFullscreen}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => setIsFullscreen(false)}
    >
      <StatusBar hidden />
      <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
        <Video
          source={{ uri: publicUrl! }}
          style={{ width: '100%', height: '100%' }}
          controls={false}
          resizeMode="contain"
          paused={!isVideoPlaying}
          onLoad={(data) => {
            console.log('Fullscreen video loaded:', data)
          }}
          onError={(error) => {
            console.error('Fullscreen video error:', error)
          }}
        />
        
        {/* Fullscreen Controls */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          {/* Close button */}
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 48,
              right: 20,
              backgroundColor: 'rgba(0,0,0,0.7)',
              borderRadius: 24,
              width: 48,
              height: 48,
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 50
            }}
            onPress={() => setIsFullscreen(false)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          
          {/* Play/Pause overlay */}
          {!isVideoPlaying && (
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'rgba(0,0,0,0.3)'
              }}
              onPress={() => setIsVideoPlaying(true)}
              activeOpacity={0.8}
            >
              <View style={{
                backgroundColor: 'rgba(0,0,0,0.8)',
                borderRadius: 48,
                width: 96,
                height: 96,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 2,
                borderColor: 'white'
              }}>
                <Ionicons name="play" size={40} color="white" style={{ marginLeft: 2 }} />
              </View>
            </TouchableOpacity>
          )}
          
          {/* Touch area to pause */}
          {isVideoPlaying && (
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
              }}
              onPress={() => setIsVideoPlaying(false)}
              activeOpacity={1}
            />
          )}
        </View>
      </View>
    </Modal>
  )

  return (
    <>
      {/* Fullscreen Modal */}
      {mediaType === 'video' && renderFullscreenVideo()}
      
      {/* Main Container */}
      <Container className="rounded-lg overflow-hidden bg-gray-100 max-w-full" style={style} onPress={onPress}> 
        {renderContent()}
      </Container>
    </>
  )
}