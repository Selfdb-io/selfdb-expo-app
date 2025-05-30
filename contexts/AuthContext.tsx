import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User, AuthContextType } from '@/types'
import { auth } from '@/services/selfdb'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      try {
        console.log('Checking auth state...')
        const isAuthenticated = auth.isAuthenticated()
        console.log('Auth.isAuthenticated():', isAuthenticated)
        
        if (isAuthenticated) {
          const currentUser = auth.getCurrentUser()
          console.log('Current user from memory:', currentUser)
          
          if (currentUser) {
            setUser(currentUser)
            console.log('User set from memory:', currentUser.email)
          } else {
            // Try to fetch user info if not available in memory
            console.log('Fetching user from API...')
            const fetchedUser = await auth.getUser()
            console.log('User fetched from API:', fetchedUser)
            setUser(fetchedUser)
          }
        } else {
          console.log('User not authenticated')
          setUser(null)
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        // Clear any invalid auth state
        setUser(null)
        try {
          await auth.logout()
        } catch (logoutError) {
          console.error('Logout failed during auth check:', logoutError)
        }
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      setLoading(true)
      console.log('Attempting login for:', email)
      const response = await auth.login({ email, password })
      console.log('Login response:', response)
      
      // Verify the user is set in the auth client
      const currentUser = auth.getCurrentUser()
      console.log('User after login:', currentUser)
      
      // Use the user object from the response (now added by the SDK)
      setUser(response.user)
      console.log('User set in context:', response.user.email)
    } catch (error) {
      console.error('Login failed:', error)
      setUser(null)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const register = async (email: string, password: string) => {
    try {
      setLoading(true)
      console.log('Attempting registration for:', email)
      const registeredUser = await auth.register({ email, password })
      console.log('Registration successful:', registeredUser)
      
      // After registration, automatically log in
      console.log('Auto-logging in after registration...')
      await login(email, password)
    } catch (error) {
      console.error('Registration failed:', error)
      setUser(null)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      setLoading(true)
      console.log('Attempting logout...')
      await auth.logout()
      console.log('Logout successful')
      setUser(null)
      console.log('User cleared from context')
    } catch (error) {
      console.error('Logout failed:', error)
      // Even if logout fails, clear the local state
      setUser(null)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
