import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  StatusBar,
  StyleSheet,
  Platform, // For platform-specific adjustments if needed
} from 'react-native';
import { Image, ImageErrorEventData } from 'expo-image'; // Added ImageErrorEventData
import Video, { OnLoadData, OnProgressData, OnSeekData, VideoRef } from 'react-native-video';
import { Ionicons } from '@expo/vector-icons';
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

  const getMediaType = () => {
    return isLocalFile
      ? getMediaTypeFromUrl(localUri || '')
      : getMediaTypeFromUrl(file?.filename || publicUrl || '');
  };

  // --- Rendering Logic ---
  if (loading) {
    return (
      <View style={[styles.centeredBox, styles.fixedHeightContainer, styles.loadingBox, style]}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  }

  if (error || !publicUrl || (!file && !isLocalFile)) {
    return (
      <View style={[styles.centeredBox, styles.fixedHeightContainer, styles.errorBox, style]}>
        <Ionicons name="alert-circle-outline" size={24} color="#dc2626" />
        <Text style={styles.errorText}>Attachment unavailable</Text>
        {error && <Text style={[styles.errorText, styles.errorDetailText]}>{error}</Text>}
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
        style={isFS ? styles.fullscreenVideoPlayer : styles.inlineVideoPlayer}
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
          <View style={[styles.mediaContainer, styles.fixedHeightContainer, style]}>
            {renderVideoPlayerComponent(false)}
            {/* Inline Controls Overlay */}
            <View style={styles.controlsOverlay}>
              {(isBuffering && !isVideoPlaying) && ( // Show loader if buffering and not explicitly playing
                <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" />
              )}
              {!isVideoPlaying && !isBuffering && (
                <TouchableOpacity style={styles.playButtonContainer} onPress={togglePlayPause} activeOpacity={0.8}>
                  <View style={styles.playButton}>
                    <Ionicons name="play" size={28} color="white" style={styles.playIcon} />
                  </View>
                </TouchableOpacity>
              )}
              {isVideoPlaying && (
                <>
                  {/* Clickable overlay to pause */}
                  <TouchableOpacity style={StyleSheet.absoluteFill} onPress={togglePlayPause} activeOpacity={1} />
                  <TouchableOpacity style={styles.fullscreenButton} onPress={toggleFullscreen} activeOpacity={0.8}>
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
          supportedOrientations={['portrait', 'landscape']} // Allow orientation changes
          onRequestClose={toggleFullscreen} // For Android back button
        >
          <View style={styles.fullscreenContainer}>
            {renderVideoPlayerComponent(true)}
            {/* Fullscreen Controls Overlay */}
            <View style={styles.controlsOverlay}>
              {(isBuffering && !isVideoPlaying) && (
                <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" />
              )}
              <TouchableOpacity style={styles.closeButton} onPress={toggleFullscreen} activeOpacity={0.8}>
                <Ionicons name="close" size={28} color="white" />
              </TouchableOpacity>
              {!isVideoPlaying && !isBuffering && (
                <TouchableOpacity style={styles.playButtonContainer} onPress={togglePlayPause} activeOpacity={0.8}>
                  <View style={styles.fullscreenPlayButton}>
                    <Ionicons name="play" size={40} color="white" style={styles.playIcon} />
                  </View>
                </TouchableOpacity>
              )}
               {isVideoPlaying && (
                 <TouchableOpacity style={StyleSheet.absoluteFill} onPress={togglePlayPause} activeOpacity={1} />
              )}
            </View>
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
          <Image
            source={{ uri: publicUrl! }}
            style={styles.imageStyle}
            contentFit="cover" // Or "contain" depending on desired behavior
            cachePolicy="memory-disk" // From your original code
            recyclingKey={fileId || publicUrl!} // From your original code
            onError={(e: ImageErrorEventData) => console.error("Image load error:", e.error)}
          />
        );
      case 'audio':
        return (
          <View style={[styles.centeredBox, styles.placeholderBox, styles.fixedHeightContainer]}>
            <Ionicons name="musical-notes-outline" size={48} color="#4b5563" />
            <Text style={styles.placeholderText}>Audio</Text>
            <Text style={styles.placeholderFilename} numberOfLines={1}>{filename}</Text>
          </View>
        );
      case 'pdf':
        return (
          <View style={[styles.centeredBox, styles.placeholderBox, styles.fixedHeightContainer]}>
            <Ionicons name="document-text-outline" size={48} color="#4b5563" />
            <Text style={styles.placeholderText}>PDF Document</Text>
            <Text style={styles.placeholderFilename} numberOfLines={1}>{filename}</Text>
          </View>
        );
      default: // 'other'
        return (
          <View style={[styles.centeredBox, styles.placeholderBox, styles.fixedHeightContainer]}>
            <Ionicons name="document-attach-outline" size={48} color="#4b5563" />
            <Text style={styles.placeholderText}>File Attachment</Text>
            <Text style={styles.placeholderFilename} numberOfLines={1}>{filename}</Text>
          </View>
        );
    }
  };

  return (
    <ContainerComponent style={[styles.mediaContainer, styles.fixedHeightContainer, style]} onPress={onPress}>
      {renderNonVideoContent()}
    </ContainerComponent>
  );
};

// --- Styles ---
// These styles aim to replicate common UI patterns and your Tailwind-like class names.
// Adjust them to fit your application's theme.
const styles = StyleSheet.create({
  fixedHeightContainer: {
    height: 256, // Default height from your original code
  },
  centeredBox: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    width: '100%', // Max width
  },
  loadingBox: {
    backgroundColor: '#f3f4f6', // gray-100
  },
  errorBox: {
    backgroundColor: '#fef2f2', // red-50
    padding: 10,
  },
  errorText: {
    color: '#dc2626', // red-600
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  errorDetailText: {
    fontSize: 10,
    color: '#b91c1c', // red-700
    marginTop: 4,
  },
  mediaContainer: {
    borderRadius: 8, // rounded-lg
    overflow: 'hidden',
    backgroundColor: '#e5e7eb', // gray-200 (slightly darker for container)
    width: '100%', // max-w-full
    position: 'relative', // For absolute positioning of controls
  },
  // Video Player Styles
  inlineVideoPlayer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000', // Black background for video often looks better
  },
  fullscreenVideoPlayer: {
    width: '100%',
    height: '100%',
  },
  // Controls Styles
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1, // Ensure controls are on top
  },
  playButtonContainer: { // This can be the overlay itself for play
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)', // Semi-transparent overlay
  },
  playButton: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 32, // w-16 h-16 rounded-full
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: Platform.OS === 'ios' ? 0 : 2, // Border was in original, conditional for better look
    borderColor: 'white',
  },
  playIcon: {
    marginLeft: Platform.OS === 'ios' ? 3 : 2, // Slight adjustment for icon centering
  },
  fullscreenButton: {
    position: 'absolute',
    top: 10, // top-2.5
    right: 10, // right-2.5
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20, // w-10 h-10 rounded-full
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Fullscreen Modal Styles
  fullscreenContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    // Adjust top for status bar height, more robustly with react-native-safe-area-context if available
    top: Platform.OS === 'ios' ? (StatusBar.currentHeight || 20) + 10 : (StatusBar.currentHeight || 0) + 15,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 24, // w-12 h-12
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50, // Ensure it's above other potential controls
  },
  fullscreenPlayButton: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 48, // w-24 h-24
    width: 96,
    height: 96,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  // Non-Video Content Styles
  imageStyle: {
    width: '100%',
    height: '100%', // Fill the container
  },
  placeholderBox: {
    backgroundColor: '#f3f4f6', // gray-100
    borderWidth: 1,
    borderColor: '#d1d5db', // gray-300
    borderStyle: 'dashed',
    padding: 20,
  },
  placeholderText: {
    fontSize: 16, // text-sm
    fontWeight: '500', // font-medium
    color: '#4b5563', // text-gray-600
    marginTop: 12, // mb-1 (approx)
    marginBottom: 4,
  },
  placeholderFilename: {
    fontSize: 12, // text-xs
    color: '#6b7280', // text-gray-500
    textAlign: 'center',
    maxWidth: '90%', // Ensure it doesn't overflow too much
    paddingHorizontal: 10,
  },
});
