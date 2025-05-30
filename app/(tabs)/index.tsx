import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
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
      <ThemedView style={styles.header}>
        <ThemedText type="title">SelfDB Forum</ThemedText>
        <View style={styles.headerActions}>
          {isAuthenticated ? (
            <View style={styles.userSection}>
              <ThemedText style={styles.userEmail}>{user?.email}</ThemedText>
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
              >
                <Text style={styles.logoutButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => setShowAuthModal(true)}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>
          )}
        </View>
      </ThemedView>

      <View style={styles.content}>
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowCreateTopic(true)}
          >
            <Text style={styles.createButtonText}>+ Create Topic</Text>
          </TouchableOpacity>
        </View>

        <TopicsList />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  logoutButton: {
    backgroundColor: '#ff4757',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
