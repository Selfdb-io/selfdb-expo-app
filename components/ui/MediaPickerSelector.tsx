import React from 'react'
import { View, TouchableOpacity, Text } from 'react-native'
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
    const result = await launchCamera()
    if (result && !result.canceled && result.assets[0]) {
      onFileSelected(result.assets[0].uri)
    }
  }

  const pickFromLibrary = async () => {
    if (disabled) return
    const result = await launchImageLibrary()
    if (result && !result.canceled && result.assets[0]) {
      onFileSelected(result.assets[0].uri)
    }
  }

  return (
    <View className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-1 mb-3">
      <View className="flex-row justify-center items-center gap-6">
        <TouchableOpacity
          onPress={pickFromCamera}
          disabled={disabled}
          className={`items-center ${disabled ? 'opacity-50' : ''}`}
        >
          <Ionicons name="camera" size={24} color="#007AFF" />
          <Text className="text-blue-600 dark:text-blue-400 text-xs mt-1">Camera</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={pickFromLibrary}
          disabled={disabled}
          className={`items-center ${disabled ? 'opacity-50' : ''}`}
        >
          <Ionicons name="image" size={24} color="#007AFF" />
          <Text className="text-blue-600 dark:text-blue-400 text-xs mt-1">Photos</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
