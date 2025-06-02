# SelfDB Expo Integration

> To use this app you must have a SelfDB instance running locally or remotely.  
> Don’t have SelfDB yet? Grab a license at <https://selfdb.io> and follow the installation guide on our website.

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
1. Clone the repo  
   ```bash
   git clone https://github.com/Selfdb-io/selfdb-expo-app
   cd selfdb-expo-app
   ```
2. Copy the environment template  
   ```bash
   cp .env.example .env
   ```
3. Install dependencies  
   ```bash
   npm install
   ```
4. Start the development server  
   ```bash
   npx expo start
   ```
5. Open the project in the Expo Go app (or run it on an emulator)

## Environment Setup
Edit `.env` and point it to your SelfDB instance:
```env
EXPO_PUBLIC_SELFDB_URL=http://localhost:8000
EXPO_PUBLIC_SELFDB_STORAGE_URL=http://localhost:8001
EXPO_PUBLIC_SELFDB_ANON_KEY=your_key_here
```

## Database Setup
1. Create the required tables in SelfDB:
   ```sql
   -- topics table
   CREATE TABLE "topics" (
     "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     "title"        varchar(255) NOT NULL,
     "content"      text         NOT NULL,
     "author_name"  varchar(100) NOT NULL,
     "user_id"      uuid,
     "file_id"      uuid,
     "created_at"   timestamptz DEFAULT now(),
     "updated_at"   timestamptz DEFAULT now()
   );

   -- comments table
   CREATE TABLE "comments" (
     "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     "topic_id"    uuid        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
     "content"     text        NOT NULL,
     "author_name" varchar(100) NOT NULL,
     "user_id"     uuid,
     "created_at"  timestamptz DEFAULT now()
   );
   ```
2. Create a **public** storage bucket named `discussion`.

## Next Steps
1. Update `.env` with your production SelfDB credentials.  
2. Test the authentication flow and data operations.  
3. Extend the UI or schemas as needed—the foundation is already wired up for you.
