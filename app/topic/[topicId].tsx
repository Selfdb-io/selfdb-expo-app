import React, { useState, useEffect } from 'react';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { TopicDetail } from '@/components/topics/TopicDetail';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Topic } from '@/types';
import { Ionicons } from '@expo/vector-icons';

export default function TopicDetailScreen() {
  const { topicId, topicData } = useLocalSearchParams<{ topicId: string; topicData?: string }>();
  const [parsedTopic, setParsedTopic] = useState<Topic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!topicId) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    // Parse topic data immediately if available
    if (topicData) {
      try {
        const parsed = JSON.parse(topicData);
        if (parsed && typeof parsed === 'object' && parsed.id) {
          setParsedTopic(parsed);
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.warn('Failed to parse topic data:', error);
      }
    }
    
    // If we get here, we don't have valid topic data
    setHasError(true);
    setIsLoading(false);
  }, [topicId, topicData]);

  if (!topicId || hasError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView className="flex-1 bg-gray-100 dark:bg-gray-900">
          <View className="flex-1 justify-center items-center">
            <Text className="text-red-500 text-lg mb-5">
              {!topicId ? 'Invalid topic ID' : 'Failed to load topic'}
            </Text>
            <TouchableOpacity
              className="bg-primary-500 py-3 px-6 rounded-lg"
              onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
            >
              <Text className="text-white text-base font-medium">Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </>
    );
  }

  // Show loading with the same header structure to prevent layout shift
  if (isLoading || !parsedTopic) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView className="flex-1 bg-gray-100 dark:bg-gray-900">
          {/* Header with same structure as TopicDetail to prevent layout shift */}
          <View className="flex-row justify-between items-center px-5 pb-2 border-b border-gray-200 dark:border-gray-700">
            <TouchableOpacity
              className="p-2 rounded-full justify-center items-center w-10 h-10"
              onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
            >
              <Ionicons name="arrow-back" size={20} color="#007AFF" />
            </TouchableOpacity>
            
            {/* Always have a center element for layout consistency */}
            <View className="flex-1" />
            
            {/* Placeholder for the right side to match TopicDetail structure */}
            <View className="w-10 h-10" />
          </View>
          
          {/* Loading content */}
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#007AFF" />
            <Text className="text-gray-600 dark:text-gray-300 text-base mt-4">Loading topic...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const handleBack = () => {
    // Always navigate to the topics list (index screen) to ensure consistent navigation
    router.replace('/');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1 bg-gray-100 dark:bg-gray-900">
        <TopicDetail
          topicId={topicId}
          topic={parsedTopic}
          onBack={handleBack}
          onTopicDeleted={handleBack} // Navigate back if the topic is deleted
        />
      </SafeAreaView>
    </>
  );
}
