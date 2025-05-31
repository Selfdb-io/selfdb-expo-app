import React from 'react';
import { Stack, useLocalSearchParams, router } from 'expo-router'; // Import router
import { TopicDetail } from '@/components/topics/TopicDetail';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Topic } from '@/types';

export default function TopicDetailScreen() {
  const { topicId, topicData } = useLocalSearchParams<{ topicId: string; topicData?: string }>();

  if (!topicId) {
    // This case should ideally be handled by routing or a not-found screen
    // For now, returning null or an error message
    return null;
  }

  // Parse topic data if provided
  let parsedTopic: Topic | undefined;
  try {
    if (topicData) {
      parsedTopic = JSON.parse(topicData);
    }
  } catch (error) {
    console.warn('Failed to parse topic data:', error);
    // Fall back to fetching the topic
  }

  // If we don't have topic data, we need to handle this case
  if (!parsedTopic) {
    // You might want to show a loading screen and fetch the topic
    // or redirect back to the topics list
    console.error('No topic data provided to TopicDetailScreen');
    return null; // or redirect back
  }

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback if cannot go back (e.g., deep link directly to this screen)
      // You might want to navigate to a specific screen like the topics list or home
      router.replace('/'); // Example: navigate to home or main topics list
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F6' /* bg-gray-100 */ }}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopicDetail
        topicId={topicId}
        topic={parsedTopic}
        onBack={handleBack}
        onTopicDeleted={handleBack} // Navigate back if the topic is deleted
      />
    </SafeAreaView>
  );
}
