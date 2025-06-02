import React from 'react'
import { View, TouchableOpacity, Text, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useImagePicker } from '@/lib/deviceUtils'

interface MediaPickerSelectorProps {
  onFileSelected: (uri: string) => void
  disabled?: boolean
}

export const MediaPickerSelector: React.FC<MediaPickerSelectorProps> = ({
  onFileSelected,
  disabled = false,
}) => {
  const { launchCamera, launchImageLibrary } = useImagePicker()

  const pickFromCamera = async () => {
    if (disabled) return
    
    try {
      const result = await launchCamera()
      if (result && !result.canceled && result.assets[0]) {
        onFileSelected(result.assets[0].uri)
      }
    } catch (error) {
      console.error('Camera error:', error)
      Alert.alert('Error', 'Failed to open camera')
    }
  }

  const pickFromLibrary = async () => {
    if (disabled) return
    
    try {
      const result = await launchImageLibrary()
      if (result && !result.canceled && result.assets[0]) {
        onFileSelected(result.assets[0].uri)
      }
    } catch (error) {
      console.error('Image library error:', error)
      Alert.alert('Error', 'Failed to open photo library')
    }
  }

  return (
    <View className="border border-gray-300 bg-transparent active:bg-gray-50 dark:border-gray-600 dark:active:bg-gray-700 rounded-lg px-4 py-2.5">
      <View className="flex-row justify-center items-center gap-6">
        <TouchableOpacity
          onPress={pickFromCamera}
          disabled={disabled}
          className={`items-center ${disabled ? 'opacity-60' : ''}`}
        >
          <Ionicons name="camera" size={20} color="#007AFF" />
          <Text className="text-gray-900 dark:text-gray-100 text-base font-medium mt-1">Camera</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={pickFromLibrary}
          disabled={disabled}
          className={`items-center ${disabled ? 'opacity-60' : ''}`}
        >
          <Ionicons name="image" size={20} color="#007AFF" />
          <Text className="text-gray-900 dark:text-gray-100 text-base font-medium mt-1">Photos</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
