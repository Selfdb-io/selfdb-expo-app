import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const CREDENTIALS_KEY = 'userCredentials';

async function saveCredentials(email: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(
    CREDENTIALS_KEY,
    JSON.stringify({ email, password })
  );
}

async function getSavedCredentials(): Promise<{ email: string; password: string } | null> {
  const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
}

/** Temporary stub – replace with real implementation or import */
async function doLogin(email: string, password: string): Promise<boolean> {
  // TODO: implement real network call
  return false;
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Load any stored credentials on mount
  useEffect(() => {
    (async () => {
      const creds = await getSavedCredentials();
      if (creds) {
        setEmail(creds.email);
        setPassword(creds.password);
        // Optionally trigger auto-login here
      }
    })();
  }, []);

  const handleLogin = async () => {
    // ...existing validation/network code...
    const success = await doLogin(email, password); // your existing call
    if (success) {
      await saveCredentials(email, password);
      // ...navigate to app...
    } else {
      await clearCredentials();
      // ...error handling...
    }
  };

  return (
    <View>
      <Text>Login</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
      />
      <Button title="Login" onPress={handleLogin} />
    </View>
  );
}