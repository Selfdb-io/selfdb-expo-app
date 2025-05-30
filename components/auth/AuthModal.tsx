import React, { useState } from 'react'
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
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
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
  },
})
