import { Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Storage keys for permissions
const PERMISSION_KEYS = {
  CAMERA: '@app/permissions/camera',
  MEDIA_LIBRARY: '@app/permissions/media_library',
  PERMISSION_CACHE_TIMESTAMP: '@app/permissions/timestamp',
} as const

// Permission cache duration (24 hours in milliseconds)
const PERMISSION_CACHE_DURATION = 24 * 60 * 60 * 1000

/**
 * Permission storage utilities
 */
export class PermissionStorage {
  /**
   * Save permission status to storage
   */
  static async savePermissionStatus(
    type: 'camera' | 'mediaLibrary',
    status: string,
    canAskAgain: boolean
  ): Promise<void> {
    try {
      const key = type === 'camera' ? PERMISSION_KEYS.CAMERA : PERMISSION_KEYS.MEDIA_LIBRARY
      const permissionData = {
        status,
        canAskAgain,
        timestamp: Date.now(),
      }
      await AsyncStorage.setItem(key, JSON.stringify(permissionData))
      await AsyncStorage.setItem(PERMISSION_KEYS.PERMISSION_CACHE_TIMESTAMP, Date.now().toString())
    } catch (error) {
      console.warn('Failed to save permission status:', error)
    }
  }

  /**
   * Get cached permission status from storage
   */
  static async getCachedPermissionStatus(
    type: 'camera' | 'mediaLibrary'
  ): Promise<{ status: string; canAskAgain: boolean } | null> {
    try {
      const key = type === 'camera' ? PERMISSION_KEYS.CAMERA : PERMISSION_KEYS.MEDIA_LIBRARY
      const cachedData = await AsyncStorage.getItem(key)
      
      if (!cachedData) return null

      const permissionData = JSON.parse(cachedData)
      const now = Date.now()
      
      // Check if cache is still valid (not older than 24 hours)
      if (now - permissionData.timestamp > PERMISSION_CACHE_DURATION) {
        await this.clearPermissionCache(type)
        return null
      }

      return {
        status: permissionData.status,
        canAskAgain: permissionData.canAskAgain,
      }
    } catch (error) {
      console.warn('Failed to get cached permission status:', error)
      return null
    }
  }

  /**
   * Clear permission cache for a specific type
   */
  static async clearPermissionCache(type: 'camera' | 'mediaLibrary'): Promise<void> {
    try {
      const key = type === 'camera' ? PERMISSION_KEYS.CAMERA : PERMISSION_KEYS.MEDIA_LIBRARY
      await AsyncStorage.removeItem(key)
    } catch (error) {
      console.warn('Failed to clear permission cache:', error)
    }
  }

  /**
   * Clear all permission caches
   */
  static async clearAllPermissionCaches(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        PERMISSION_KEYS.CAMERA,
        PERMISSION_KEYS.MEDIA_LIBRARY,
        PERMISSION_KEYS.PERMISSION_CACHE_TIMESTAMP,
      ])
    } catch (error) {
      console.warn('Failed to clear all permission caches:', error)
    }
  }

  /**
   * Check if permission should be re-requested based on cache
   */
  static async shouldRequestPermission(
    type: 'camera' | 'mediaLibrary',
    currentStatus: string
  ): Promise<boolean> {
    const cached = await this.getCachedPermissionStatus(type)
    
    if (!cached) {
      // No cache, should request
      return currentStatus === ImagePicker.PermissionStatus.UNDETERMINED
    }

    // If status changed from cache, clear cache and re-evaluate
    if (cached.status !== currentStatus) {
      await this.clearPermissionCache(type)
      return currentStatus === ImagePicker.PermissionStatus.UNDETERMINED
    }

    // If denied and can't ask again, don't request
    if (currentStatus === ImagePicker.PermissionStatus.DENIED && !cached.canAskAgain) {
      return false
    }

    // If denied but can ask again, allow request
    if (currentStatus === ImagePicker.PermissionStatus.DENIED && cached.canAskAgain) {
      return true
    }

    // If granted, don't need to request
    return false
  }
}

/**
 * Check if the current device is likely an iOS simulator
 */
export const isIOSSimulator = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    return false
  }
  
  try {
    const cameraPermissions = await ImagePicker.getCameraPermissionsAsync()
    return !cameraPermissions.canAskAgain && cameraPermissions.status === 'denied'
  } catch (error) {
    return true
  }
}

/**
 * Enhanced custom hook for camera functionality with intelligent permission handling and storage
 */
export const useCameraLauncher = () => {
  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions()

  const launchCamera = async (): Promise<ImagePicker.ImagePickerResult | null> => {
    try {
      // Check if we're on a simulator
      const isSimulator = await isIOSSimulator()
      if (isSimulator) {
        throw new Error('Camera not available on simulator')
      }

      if (!cameraPermission) {
        throw new Error('Camera permission status not available')
      }

      // Check if we should request permission based on cache
      const shouldRequest = await PermissionStorage.shouldRequestPermission(
        'camera',
        cameraPermission.status
      )

      let currentPermission = cameraPermission

      if (shouldRequest || cameraPermission.status === ImagePicker.PermissionStatus.UNDETERMINED) {
        const newPermission = await requestCameraPermission()
        currentPermission = newPermission
        
        // Save the new permission status to cache
        await PermissionStorage.savePermissionStatus(
          'camera',
          newPermission.status,
          newPermission.canAskAgain
        )
      }

      if (currentPermission.status !== ImagePicker.PermissionStatus.GRANTED) {
        if (currentPermission.status === ImagePicker.PermissionStatus.DENIED && !currentPermission.canAskAgain) {
          throw new Error('Camera permission permanently denied. Please enable it in Settings.')
        } else {
          throw new Error('Camera permission not granted')
        }
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images', 'videos', 'livePhotos'],
        allowsEditing: false,
        quality: 0.8,
      })

      return result
    } catch (error) {
      console.error('Camera launch error:', error)
      return null
    }
  }

  return {
    launchCamera,
    cameraPermission,
    requestCameraPermission,
  }
}

/**
 * Enhanced custom hook for image library functionality with intelligent permission handling and storage
 */
export const useImageLibraryLauncher = () => {
  const [mediaLibraryPermission, requestMediaLibraryPermission] = ImagePicker.useMediaLibraryPermissions()

  const launchImageLibrary = async (): Promise<ImagePicker.ImagePickerResult | null> => {
    try {
      if (!mediaLibraryPermission) {
        throw new Error('Media library permission status not available')
      }

      // Check if we should request permission based on cache
      const shouldRequest = await PermissionStorage.shouldRequestPermission(
        'mediaLibrary',
        mediaLibraryPermission.status
      )

      let currentPermission = mediaLibraryPermission

      if (shouldRequest || mediaLibraryPermission.status === ImagePicker.PermissionStatus.UNDETERMINED) {
        const newPermission = await requestMediaLibraryPermission()
        currentPermission = newPermission
        
        // Save the new permission status to cache
        await PermissionStorage.savePermissionStatus(
          'mediaLibrary',
          newPermission.status,
          newPermission.canAskAgain
        )
      }

      if (currentPermission.status !== ImagePicker.PermissionStatus.GRANTED) {
        if (currentPermission.status === ImagePicker.PermissionStatus.DENIED && !currentPermission.canAskAgain) {
          throw new Error('Media library permission permanently denied. Please enable it in Settings.')
        } else {
          throw new Error('Media library permission not granted')
        }
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos', 'livePhotos'],
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: false,
      })

      return result
    } catch (error) {
      console.error('Image library launch error:', error)
      return null
    }
  }

  return {
    launchImageLibrary,
    mediaLibraryPermission,
    requestMediaLibraryPermission,
  }
}

/**
 * Combined hook for both camera and image library functionality with enhanced caching
 */
export const useImagePicker = () => {
  const camera = useCameraLauncher()
  const library = useImageLibraryLauncher()

  const showMediaPickerOptions = async (
    openCamera: () => void,
    openLibrary: () => void
  ) => {
    const isSimulator = await isIOSSimulator()
    
    const options: Array<{
      text: string
      onPress?: () => void
      style?: 'default' | 'cancel' | 'destructive'
    }> = [
      {
        text: 'Photo Library',
        onPress: openLibrary,
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]

    if (!isSimulator) {
      options.unshift({
        text: 'Camera',
        onPress: openCamera,
      })
    }

    return options
  }

  /**
   * Clear all permission caches (useful for debugging or user requested reset)
   */
  const clearPermissionCaches = async (): Promise<void> => {
    await PermissionStorage.clearAllPermissionCaches()
  }

  return {
    ...camera,
    ...library,
    showMediaPickerOptions,
    clearPermissionCaches,
    PermissionStorage, // Export for advanced usage
  }
}