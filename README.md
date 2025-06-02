# SelfDB Expo Integration

To use this app you must have a SelfDB instance running locally or remotely.  
Don’t have SelfDB yet? Grab a your self-hostable copy <https://selfdb.io> and follow the installation guide on our website.

## Project Overview
This Expo React Native application demonstrates how to use **SelfDB** as the backend while following mobile best-practices. It ships with:

- 🔐 **Authentication** (context provider, login / register screens, persistent session)
- 🗄️ **Database CRUD** (topics & comments with file upload)
- 📡 **Real-time ready** subscriptions
- 🏗️ **Modular project structure** (components, contexts, types, services)

## Prerequisites
- Node.js ≥ 18
- Expo CLI (`npm i -g expo-cli`)
- A running SelfDB instance (local or remote)

## Quick Start

1. **Clone the repo**
   ```bash
   git clone https://github.com/Selfdb-io/selfdb-expo-app
   cd selfdb-expo-app
   ```

2. **Configure the environment**
   ```bash
   cp .env.example .env
   # then open `.env` and set:
   ```
   ```env
   EXPO_PUBLIC_SELFDB_URL=http://localhost:8000
   EXPO_PUBLIC_SELFDB_STORAGE_URL=http://localhost:8001
   EXPO_PUBLIC_SELFDB_ANON_KEY=your_key_here
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Install additional tools (if needed)**
   ```bash
   # Install Watchman (improves file watching performance)
   brew update && brew install watchman
   
   # Install Expo Dev Client for better debugging
   npx expo install expo-dev-client
   ```

5. **Start the development server**
   ```bash
   npx expo start        # general development
   npx expo run:ios      # iOS simulator/device
   ```



## Database Setup
1. Create the required tables in SelfDB Dashboard:

```sql
-- Create topics table
CREATE TABLE IF NOT EXISTS topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author_name VARCHAR(100) NOT NULL,
    user_id UUID,
    file_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES topics(id),
    content TEXT NOT NULL,
    author_name VARCHAR(100) NOT NULL,
    user_id UUID,
    file_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_comments_topic_id ON comments(topic_id);
CREATE INDEX IF NOT EXISTS idx_topics_user_id ON topics(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_topics_created_at ON topics(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);
```

2. Create a **public** storage bucket named `discussion`.

## Next Steps
1. Update `.env` with your production SelfDB credentials.  
2. Test the authentication flow and data operations.  
3. Extend the UI or schemas as needed—the foundation is already wired up for you.
