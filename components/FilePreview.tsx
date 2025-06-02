import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  StatusBar,
  StyleSheet,               // 🆕 bring StyleSheet back
} from 'react-native';           // ⬅️ removed StyleSheet & Platform
import { Image, ImageErrorEventData } from 'expo-image'; // Added ImageErrorEventData
import Video, { OnLoadData, OnProgressData, OnSeekData, VideoRef } from 'react-native-video';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // 🆕
// Assuming these are your actual paths and types
import { storage } from '@/services/selfdb';
import { FileMetadata, MediaType } from '@/types';

// --- METADATA CACHE (Your existing cache logic - retained) ---
const metadataCache = new Map<string, {
  file: FileMetadata;
  publicUrl: string;
  timestamp: number;
}>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cleanupCache = () => {
  const now = Date.now();
  for (const [key, value] of metadataCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      metadataCache.delete(key);
    }
  }
};
const cacheCleanupInterval = setInterval(cleanupCache, 2 * 60 * 1000); // Run every 2 minutes
// --- END METADATA CACHE ---

// --- PRELOAD FUNCTION (Your existing preload logic - retained) ---
export const preloadFileMetadata = async (fileId: string): Promise<void> => {
  if (!fileId || metadataCache.has(fileId)) return;
  try {
    console.log('🔄 Preloading metadata for file:', fileId);
    // Prioritize public view, then authenticated view
    const viewResponse = await storage.files.getPublicFileViewInfo(fileId).catch(() =>
      storage.files.getFileViewInfo(fileId)
    );
    if (viewResponse?.data?.file_metadata && viewResponse?.data?.view_url) {
      metadataCache.set(fileId, {
        file: viewResponse.data.file_metadata,
        publicUrl: viewResponse.data.view_url,
        timestamp: Date.now()
      });
      console.log('✅ Preloaded metadata for file:', fileId);
    }
  } catch (error) {
    console.warn('Failed to preload metadata for file:', fileId, error);
  }
};
// --- END PRELOAD FUNCTION ---

// Simple file extension to media type mapping
const EXTENSION_MAP: Record<string, MediaType> = {
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image',
  mp4: 'video', webm: 'video', mov: 'video', avi: 'video', mkv: 'video', // Added mkv
  mp3: 'audio', wav: 'audio', ogg: 'audio', aac: 'audio', // Added aac
  pdf: 'pdf',
  doc: 'other', docx: 'other', txt: 'other', xls: 'other', xlsx: 'other', ppt: 'other', pptx: 'other', // Added more doc types
};

function getMediaTypeFromUrl(urlOrFilename: string): MediaType {
  if (!urlOrFilename) return 'other';
  const extension = urlOrFilename.split('.').pop()?.toLowerCase();
  return extension ? EXTENSION_MAP[extension] || 'other' : 'other';
}

// Helper function to detect if a URI is local
function isLocalUri(uri: string): boolean {
  if (!uri) return false;
  return uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('/') || uri.includes('ExponentExperienceData');
}

interface FilePreviewProps {
  fileId?: string;  // For remote files stored in SelfDB
  localUri?: string; // For local files (from camera/photo library)
  style?: object;    // Custom styles for the main container
  onPress?: () => void; // Action when non-video content is pressed
  // Note: Provide either fileId OR localUri, not both
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  fileId,
  localUri,
  style,
  onPress
}) => {
  const insets = useSafeAreaInsets();                               // 🆕
  const [file, setFile] = useState<FileMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [isLocalFile, setIsLocalFile] = useState(false);

  // Video specific states
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false); // For showing loader during buffer

  const videoPlayerRef = useRef<VideoRef>(null); // Typed VideoRef for better control

  // New state for image fullscreen
  const [isImageFullscreen, setIsImageFullscreen] = useState(false);

  useEffect(() => {
    // Validate that only one of fileId or localUri is provided
    if (fileId && localUri) {
      console.warn('FilePreview: Both fileId and localUri provided. Using localUri and ignoring fileId.');
    }

    // Reset video states when fileId or localUri changes
    setIsVideoPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsFullscreen(false); // Exit fullscreen if the source changes

    if (localUri) {
      setIsLocalFile(true);
      setPublicUrl(localUri);
      // Create a mock FileMetadata for local files
      setFile({
        filename: localUri.split('/').pop() || 'local_file',
        created_at: new Date().toISOString(),
        size: 0, // Size might not be available/relevant for local URI like this
        content_type: '' // Content type might need to be inferred if needed
      } as FileMetadata);
      setLoading(false);
      setError(null);
      console.log('📱 Local file set:', localUri);
      return;
    }

    if (!fileId) {
      setLoading(false);
      setError('No file ID or local URI provided.');
      return;
    }

    setIsLocalFile(false);
    loadFileMetadata(); // Renamed for clarity

    // Cleanup interval on unmount
    return () => {
        // clearInterval(cacheCleanupInterval); // Moved to global scope to persist across component instances
    };

  }, [fileId, localUri]);

  // Effect to manage StatusBar visibility for fullscreen video
  useEffect(() => {
    const mediaType = getMediaType();
    if (mediaType === 'video') {
      StatusBar.setHidden(isFullscreen, 'slide');
    }
    // Cleanup: ensure status bar is visible if unmounted while fullscreen
    return () => {
      if (isFullscreen && mediaType === 'video') {
        StatusBar.setHidden(false, 'slide');
      }
    };
  }, [isFullscreen, file, publicUrl, localUri]);


  const loadFileMetadata = async () => {
    if (!fileId) {
      setError('No file ID provided for remote file.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const cachedData = metadataCache.get(fileId);
      const now = Date.now();

      if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
        console.log('📋 Using cached metadata for file:', fileId);
        setFile(cachedData.file);
        setPublicUrl(cachedData.publicUrl);
        setLoading(false);
        return;
      }

      console.log('☁️ Fetching metadata for file:', fileId);
      let viewResponse;
      try {
        viewResponse = await storage.files.getPublicFileViewInfo(fileId);
      } catch (publicErr) {
        console.warn('⚠️ Public view failed, trying authenticated:', publicErr);
        viewResponse = await storage.files.getFileViewInfo(fileId);
      }

      if (!viewResponse || !viewResponse.data || !viewResponse.data.file_metadata || !viewResponse.data.view_url) {
        throw new Error('Invalid response from file endpoint or file not found.');
      }

      const fileMetadata = viewResponse.data.file_metadata;
      const viewUrl = viewResponse.data.view_url;

      metadataCache.set(fileId, { file: fileMetadata, publicUrl: viewUrl, timestamp: now });
      setFile(fileMetadata);
      setPublicUrl(viewUrl);
      console.log('📁 File metadata loaded and cached:', fileMetadata.filename);
    } catch (err: any) {
      console.error('❌ Failed to load file metadata:', err);
      setError(err.message || 'Failed to load file metadata.');
    } finally {
      setLoading(false);
    }
  };

  // --- Video Player Event Handlers ---
  const handleVideoLoad = (data: OnLoadData) => {
    console.log(`🎥 Video loaded. Duration: ${data.duration}s. Current time before seek: ${currentTime}s`);
    setDuration(data.duration);
    setIsBuffering(false); // Video has loaded, stop buffering indicator
    // Seek to current time if it's a valid position (e.g., after returning from fullscreen)
    if (videoPlayerRef.current && currentTime > 0 && currentTime < data.duration) {
      videoPlayerRef.current.seek(currentTime);
      console.log(`Video seeked to: ${currentTime}s`);
    }
  };

  const handleVideoProgress = (data: OnProgressData) => {
    if (!isBuffering && data.playableDuration > data.currentTime) { // Basic check to ensure content is playable
        setCurrentTime(data.currentTime);
    }
  };

  const handleVideoSeek = (data: OnSeekData) => {
    console.log(`🖐️ Video seeked by user/event to: ${data.seekTime}s`);
    setCurrentTime(data.seekTime);
  };

  const handleVideoError = (error: any) => {
    console.error('❌ Video error:', error);
    setError(isLocalFile ? 'Local video playback error. Check format/permissions.' : 'Video playback error.');
    setIsBuffering(false);
  };

  const handleVideoBuffer = (bufferData: { isBuffering: boolean }) => {
    console.log(bufferData.isBuffering ? '⏳ Video buffering...' : '✅ Video buffer complete.');
    setIsBuffering(bufferData.isBuffering);
  };

  const handleVideoEnd = () => {
    console.log('🏁 Video ended.');
    setIsVideoPlaying(false);
    setCurrentTime(0); // Reset to beginning
    if (videoPlayerRef.current) {
      videoPlayerRef.current.seek(0); // Seek to beginning
    }
  };

  // --- Control Functions ---
  const togglePlayPause = () => {
    setIsVideoPlaying(!isVideoPlaying);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    // When entering fullscreen, ensure video continues playing if it was
    // When exiting, it will re-render and use the isVideoPlaying state
  };

  const closeImageFullscreen = () => setIsImageFullscreen(false);   // 🆕 always close
  const toggleImageFullscreen = () => setIsImageFullscreen(v => !v);

  const getMediaType = () => {
    return isLocalFile
      ? getMediaTypeFromUrl(localUri || '')
      : getMediaTypeFromUrl(file?.filename || publicUrl || '');
  };

  // --- Rendering Logic ---
  if (loading) {
    return (
      <View className="h-64 w-full justify-center items-center overflow-hidden bg-gray-100" style={style}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  }

  if (error || !publicUrl || (!file && !isLocalFile)) {
    return (
      <View className="h-64 w-full justify-center items-center overflow-hidden bg-red-50 p-2" style={style}>
        <Ionicons name="alert-circle-outline" size={24} color="#dc2626" />
        <Text className="text-red-600 text-sm mt-2">Attachment unavailable</Text>
        {error && <Text className="text-red-700 text-[10px] mt-1">{error}</Text>}
      </View>
    );
  }

  const resolvedMediaType = getMediaType();


  const renderVideoPlayerComponent = (isFS: boolean) => {
    if (!publicUrl) return null;
    return (
      <Video
        ref={videoPlayerRef}
        source={{ uri: publicUrl }}
        style={{ width: '100%', height: '100%' }}          // ✅ StyleProp<ViewStyle>
        controls={false} // We use custom controls
        resizeMode={isFS ? "contain" : "cover"}
        paused={!isVideoPlaying}
        onLoad={handleVideoLoad}
        onProgress={handleVideoProgress}
        onSeek={handleVideoSeek} // Important for tracking user seeks
        onError={handleVideoError}
        onBuffer={handleVideoBuffer}
        onEnd={handleVideoEnd}
        onReadyForDisplay={() => {
          console.log('✅ Video ready for display.');
          setIsBuffering(false);
        }}
        playInBackground={false} // Typically false for UI video players
        playWhenInactive={false} // Also typically false
        progressUpdateInterval={250} // How often onProgress fires (ms)
      />
    );
  };

  const ContainerComponent = onPress && resolvedMediaType !== 'video' ? TouchableOpacity : View;

  if (resolvedMediaType === 'video') {
    return (
      <>
        {/* Inline Player */}
        {!isFullscreen && (
          <View className={`h-64 w-full rounded-lg overflow-hidden bg-gray-200 relative ${style ? '' : ''}`}>
            {renderVideoPlayerComponent(false)}
            {/* Inline Controls Overlay */}
            <View className="absolute inset-0 justify-center items-center z-10">
              {(isBuffering && !isVideoPlaying) && (
                <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" />
              )}
              {!isVideoPlaying && !isBuffering && (
                <TouchableOpacity
                  className="absolute inset-0 justify-center items-center bg-black/30"
                  onPress={togglePlayPause}
                  activeOpacity={0.8}
                >
                  <View className="bg-black/70 rounded-full w-16 h-16 justify-center items-center border-2 border-white">
                    <Ionicons name="play" size={28} color="white" />
                  </View>
                </TouchableOpacity>
              )}
              {isVideoPlaying && (
                <>
                  <TouchableOpacity className="absolute inset-0" onPress={togglePlayPause} activeOpacity={1} />
                  <TouchableOpacity
                    className="absolute top-2.5 right-2.5 bg-black/70 rounded-full w-10 h-10 justify-center items-center"
                    onPress={toggleFullscreen}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="expand" size={20} color="white" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}

        {/* Fullscreen Modal */}
        <Modal
          visible={isFullscreen}
          animationType="slide"
          supportedOrientations={['portrait', 'landscape']}
          onRequestClose={toggleFullscreen}
        >
          <View className="flex-1 bg-black justify-center items-center">
            {renderVideoPlayerComponent(true)}

            {/* Controls overlay (play / loader) */}
            <View
              pointerEvents="box-none"
              className="absolute inset-0 justify-center items-center"
            >
              {(isBuffering && !isVideoPlaying) && (
                <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" />
              )}

              {/* Large play button */}
              {!isVideoPlaying && !isBuffering && (
                <TouchableOpacity
                  className="absolute inset-0 justify-center items-center"
                  onPress={togglePlayPause}
                  activeOpacity={0.8}
                >
                  <View className="bg-black/80 rounded-full w-24 h-24 justify-center items-center border-2 border-white">
                    <Ionicons name="play" size={40} color="white" />
                  </View>
                </TouchableOpacity>
              )}

              {/* Pause overlay */}
              {isVideoPlaying && (
                <TouchableOpacity
                  className="absolute inset-0"
                  onPress={togglePlayPause}
                  activeOpacity={1}
                />
              )}
            </View>

            {/* ➜ CLOSE BUTTON – rendered last so it’s always on top */}
            <TouchableOpacity
              className="absolute right-4 z-50 bg-black/70 rounded-full w-12 h-12 justify-center items-center"
              onPress={toggleFullscreen}
              activeOpacity={0.8}
              style={[{ top: insets.top + 4, elevation: 40 }]} // ↰ respect safe-area like image modal
            >
              <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>
          </View>
        </Modal>
      </>
    );
  }

  // Fallback for other media types (Image, Audio, PDF, Other)
  const renderNonVideoContent = () => {
    const filename = file?.filename || (localUri ? localUri.split('/').pop() : 'File');
    switch (resolvedMediaType) {
      case 'image':
        return (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={toggleImageFullscreen}
            style={{ flex: 1 }}                          // 🟢 style instead of className
          >
            <Image
              source={{ uri: publicUrl! }}
              style={{ width: '100%', height: '100%' }}  // 🟢 width / height defined
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={fileId || publicUrl!}
              onError={(e: ImageErrorEventData) =>
                console.error('Image load error:', e.error)
              }
            />
          </TouchableOpacity>
        );
      case 'audio':
        return (
          <View className="h-64 w-full justify-center items-center bg-gray-100 border border-gray-300 border-dashed p-5">
            <Ionicons name="musical-notes-outline" size={48} color="#4b5563" />
            <Text className="text-base font-medium text-gray-600 mt-3 mb-1">Audio</Text>
            <Text className="text-xs text-gray-500 text-center max-w-[90%] px-2" numberOfLines={1}>{filename}</Text>
          </View>
        );
      case 'pdf':
        return (
          <View className="h-64 w-full justify-center items-center bg-gray-100 border border-gray-300 border-dashed p-5">
            <Ionicons name="document-text-outline" size={48} color="#4b5563" />
            <Text className="text-base font-medium text-gray-600 mt-3 mb-1">PDF Document</Text>
            <Text className="text-xs text-gray-500 text-center max-w-[90%] px-2" numberOfLines={1}>{filename}</Text>
          </View>
        );
      default:
        return (
          <View className="h-64 w-full justify-center items-center bg-gray-100 border border-gray-300 border-dashed p-5">
            <Ionicons name="document-attach-outline" size={48} color="#4b5563" />
            <Text className="text-base font-medium text-gray-600 mt-3 mb-1">File Attachment</Text>
            <Text className="text-xs text-gray-500 text-center max-w-[90%] px-2" numberOfLines={1}>{filename}</Text>
          </View>
        );
    }
  };

  return (
    <ContainerComponent
      className="h-64 w-full rounded-lg overflow-hidden bg-gray-200"
      style={style}
      onPress={onPress}
    >
      {renderNonVideoContent()}

      {/* Full-screen IMAGE MODAL */}
      {
        resolvedMediaType === 'image' && (
          <Modal
            visible={isImageFullscreen}
            animationType="fade"
            onRequestClose={closeImageFullscreen}          // ✅ use close helper
            supportedOrientations={['portrait', 'landscape']}
            statusBarTranslucent
            transparent={false}
          >
            {/* Root container – allow children to handle touches */}
            <View pointerEvents="box-none" className="flex-1 bg-black">
              {/* Image itself (does NOT block touches) */}
              <Image
                pointerEvents="none"
                source={{ uri: publicUrl! }}
                style={{ flex: 1 }}
                contentFit="contain"
                recyclingKey={fileId || publicUrl!}
              />

              {/* Tap-anywhere overlay ‑ captures close taps only */}
              <TouchableOpacity
                style={styles.imageOverlay}             // 🆕 use StyleSheet
                onPress={closeImageFullscreen}
                activeOpacity={1}
              />

              {/* Close button – highest z-order with safe-area offset */}
              <TouchableOpacity
                onPress={closeImageFullscreen}
                activeOpacity={0.8}
                className="absolute right-4 bg-black/70 rounded-full w-12 h-12 justify-center items-center"
                style={[                                            // 🆕 array style to merge safely
                  { top: insets.top + 4, elevation: 40 },           //    4px extra padding
                ]}
              >
                <Ionicons name="close" size={28} color="white" />
              </TouchableOpacity>
            </View>
          </Modal>
        )
      }
    </ContainerComponent>
  );
};

const styles = StyleSheet.create({
  // absolute-fill overlay used in fullscreen image
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
