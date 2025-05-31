import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useAuth } from '@/contexts/AuthContext'

interface LoginScreenProps {
  onSwitchToRegister: () => void
  onClose?: () => void
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ 
  onSwitchToRegister, 
  onClose 
}) => {
  const { login, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }

    try {
      console.log('Login form submission for:', email)
      await login(email, password)
      console.log('Login successful')
      setEmail('')
      setPassword('')
      if (onClose) onClose()
    } catch (error) {
      console.error('Login form error:', error)
      Alert.alert('Error', 'Invalid email or password')
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-5">
          <Text className="text-3xl font-bold text-center mb-10 text-gray-800">Login</Text>
          
          <View className="mb-5">
            <TextInput
              className="bg-white border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base text-gray-800"
              placeholder="Email"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            <TextInput
              className="bg-white border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base text-gray-800"
              placeholder="Password"
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="none"
              passwordRules=""
            />
            
            <TouchableOpacity
              className={`bg-primary-500 rounded-lg py-4 items-center mt-2.5 ${loading ? 'opacity-60' : ''}`}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-base font-semibold">Login</Text>
              )}
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            className="py-2.5"
            onPress={onSwitchToRegister}
          >
            <Text className="text-primary-500 text-center text-sm">
              Don&apos;t have an account? Register here
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
