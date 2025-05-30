import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

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
      <SafeAreaView style={styles.container}>
        <ThemedView style={styles.centered}>
          <ThemedText>Loading...</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (showCreateTopic) {
    return (
      <SafeAreaView style={styles.container}>
        <CreateTopic
          onTopicCreated={handleTopicCreated}
          onCancel={() => setShowCreateTopic(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
});
