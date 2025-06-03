import { createClient } from '@selfdb/js-sdk'
import Constants from 'expo-constants'

// Get configuration from environment variables
const SELFDB_URL = Constants.expoConfig?.extra?.SELFDB_URL || 
  process.env.EXPO_PUBLIC_SELFDB_URL || 
  'http://localhost:8000'

const SELFDB_STORAGE_URL = Constants.expoConfig?.extra?.SELFDB_STORAGE_URL || 
  process.env.EXPO_PUBLIC_SELFDB_STORAGE_URL || 
  'http://localhost:8001'

const SELFDB_ANON_KEY = Constants.expoConfig?.extra?.SELFDB_ANON_KEY || 
  process.env.EXPO_PUBLIC_SELFDB_ANON_KEY

if (!SELFDB_ANON_KEY) {
  throw new Error('EXPO_PUBLIC_SELFDB_ANON_KEY is required. Please check your .env file.')
}

// Create and export the SelfDB client with simplified configuration
export const selfdb = createClient({
  baseUrl: SELFDB_URL,
  storageUrl: SELFDB_STORAGE_URL,
  anonKey: SELFDB_ANON_KEY
})

// Export individual clients for convenience
export const auth = selfdb.auth
export const db = selfdb.db
export const storage = selfdb.storage
export const realtime = selfdb.realtime
export const functions = selfdb.functions
export const files = selfdb.files


