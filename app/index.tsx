import React, { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { TopicsList } from '@/components/topics/TopicsList';
import { CreateTopic } from '@/components/topics/CreateTopic';
import { Topic } from '@/types';

export default function HomeScreen() {
  const { user, isAuthenticated, logout, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);

  const handleTopicCreated = (newTopic: Topic) => {
    setTopics(prev => [newTopic, ...prev]);
    setShowCreateTopic(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-100 dark:bg-gray-900">
        <ThemedView className="flex-1 justify-center items-center">
          <ThemedText>Loading...</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (showCreateTopic) {
    return (
      <SafeAreaView className="flex-1 bg-gray-100 dark:bg-gray-900">
        <CreateTopic
          onTopicCreated={handleTopicCreated}
          onCancel={() => setShowCreateTopic(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-100 dark:bg-gray-900">
      <View className="flex-1">
        <TopicsList 
          onCreateTopic={() => setShowCreateTopic(true)} 
          showHeader={true}
          onShowAuthModal={() => setShowAuthModal(true)}
          onLogout={handleLogout}
          user={user}
          isAuthenticated={isAuthenticated}
        />
      </View>

      <AuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </SafeAreaView>
  );
}
