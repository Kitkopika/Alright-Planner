/**
 * Root layout: hydrates the store once, then renders the tab group plus the
 * modal Data (export/import) screen.
 */

import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useLifeOS } from '../src/data/store';

export default function RootLayout() {
  const hydrate = useLifeOS((s) => s.hydrate);
  const hydrated = useLifeOS((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="data" options={{ presentation: 'modal', headerShown: true, title: 'Data & Backup' }} />
      </Stack>
    </>
  );
}
