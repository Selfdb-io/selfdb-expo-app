import { Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'

/**
 * Check if the current device is likely an iOS simulator
 * iOS simulators don't have cameras, so camera operations will fail
 */
export const isIOSSimulator = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    return false
  }
  
  try {
    // Check if camera permissions can be requested
    // On simulator, this might behave differently
    const cameraPermissions = await ImagePicker.getCameraPermissionsAsync()
    
    // If we can't ask again and status is denied, it might be a simulator
    // This is a heuristic, not 100% reliable
    return !cameraPermissions.canAskAgain && cameraPermissions.status === 'denied'
  } catch (error) {
    // If there's an error getting camera permissions, assume it's a simulator
    return true
  }
}

/**
 * Show media picker options with intelligent camera detection
 * Automatically hides camera option on iOS simulator
 */
export const showMediaPickerOptions = async (
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

  // Only add camera option if not on simulator
  if (!isSimulator) {
    options.unshift({
      text: 'Camera',
      onPress: openCamera,
    })
  }

  return options
}

/**
 * Safe camera launcher that handles simulator issues gracefully
 */
export const safeLaunchCamera = async (): Promise<ImagePicker.ImagePickerResult | null> => {
  try {
    // Check if we're on a simulator
    const isSimulator = await isIOSSimulator()
    
    if (isSimulator) {
      throw new Error('Camera not available on simulator')
    }

    // Request camera permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    
    if (status !== 'granted') {
      throw new Error('Camera permission not granted')
    }

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images','videos','livePhotos'],
      allowsEditing: false,
      quality: 0.8,
    })

    return result
  } catch (error) {
    console.error('Camera launch error:', error)
    return null
  }
}

/**
 * Safe media library launcher
 */
export const safeLaunchImageLibrary = async (): Promise<ImagePicker.ImagePickerResult | null> => {
  try {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    
    if (status !== 'granted') {
      throw new Error('Media library permission not granted')
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images','videos','livePhotos'],
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
