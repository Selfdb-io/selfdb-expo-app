import React, { useState } from 'react'
import {
  Modal,
  View,
  TouchableOpacity,
  Text,
} from 'react-native'
import { LoginScreen } from './LoginScreen'
import { RegisterScreen } from './RegisterScreen'

interface AuthModalProps {
  visible: boolean
  onClose: () => void
  initialMode?: 'login' | 'register'
}

export const AuthModal: React.FC<AuthModalProps> = ({ 
  visible, 
  onClose, 
  initialMode = 'login' 
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)

  const handleSwitchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-gray-100 dark:bg-gray-900">
        <View className="flex-row justify-end px-5 pt-5 pb-2.5">
          <TouchableOpacity
            className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700 justify-center items-center"
            onPress={onClose}
          >
            <Text className="text-lg text-gray-600 dark:text-gray-200 font-bold">✕</Text>
          </TouchableOpacity>
        </View>
        
        {mode === 'login' ? (
          <LoginScreen 
            onSwitchToRegister={handleSwitchMode}
            onClose={onClose}
          />
        ) : (
          <RegisterScreen 
            onSwitchToLogin={handleSwitchMode}
            onClose={onClose}
          />
        )}
      </View>
    </Modal>
  )
}
