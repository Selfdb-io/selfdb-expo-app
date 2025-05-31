import React, { useState } from 'react'
import {
  View,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useAuth } from '@/contexts/AuthContext'
import { ThemedText } from '@/components/ThemedText'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

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
          <ThemedText type="title" className="text-center mb-10">Login</ThemedText>
          
          <View className="mb-5">
            <Input
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              className="mb-4"
            />
            
            <Input
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="none"
              passwordRules=""
              className="mb-4"
            />
            
            {loading ? (
              <View className="bg-primary-500 rounded-lg py-4 items-center mt-2.5 opacity-60">
                <ActivityIndicator color="white" />
              </View>
            ) : (
              <Button
                title="Login"
                onPress={handleSubmit}
                className="mt-2.5"
              />
            )}
          </View>
          
          <Button
            title="Don't have an account? Register here"
            variant="ghost"
            onPress={onSwitchToRegister}
            className="py-2.5"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
