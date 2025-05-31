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

interface RegisterScreenProps {
  onSwitchToLogin: () => void
  onClose?: () => void
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ 
  onSwitchToLogin, 
  onClose 
}) => {
  const { register, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match')
      return
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters')
      return
    }

    try {
      console.log('Register form submission for:', email)
      await register(email, password)
      console.log('Registration and login successful')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      if (onClose) onClose()
    } catch (error) {
      console.error('Registration form error:', error)
      Alert.alert('Error', 'Registration failed. Email might already be in use.')
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-5">
          <ThemedText type="title" className="text-center mb-10">Register</ThemedText>
          
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
            
            <Input
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="none"
              passwordRules=""
              className="mb-4"
              onSubmitEditing={handleSubmit}
              returnKeyType="done"
            />
            
            {loading ? (
              <View className="bg-primary-500 rounded-lg py-4 items-center mt-2.5 opacity-60">
                <ActivityIndicator color="white" />
              </View>
            ) : (
              <Button
                title="Register"
                onPress={handleSubmit}
                className="mt-2.5"
              />
            )}
          </View>
          
          <Button
            title="Already have an account? Login here"
            variant="ghost"
            onPress={onSwitchToLogin}
            className="py-2.5"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
