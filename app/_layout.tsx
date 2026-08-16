/**
 * Root layout: hydrates the app + settings stores once, applies the theme,
 * and renders the tab group plus the modal Settings and Data screens.
 * The tree is remounted (key) whenever the palette changes so every screen
 * re-reads the updated `colors` (dark/light + custom accent).
 */

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { useLifeOS } from '../src/data/store';
import { useSettings } from '../src/data/settings';
import { applyTheme, colors, isDarkMode, themeVersion } from '../src/theme';
import { useT } from '../src/i18n';
import { blurTargetRef } from '../src/components/blurTarget';

export default function RootLayout() {
  const hydrate = useLifeOS((s) => s.hydrate);
  const hydrated = useLifeOS((s) => s.hydrated);
  const settings = useSettings();
  const t = useT();

  const [themeKey, setThemeKey] = useState(0);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!settings.hydrated) settings.hydrate();
  }, [settings.hydrated, settings]);

  // Apply the theme + remount the tree on any appearance/language change.
  useEffect(() => {
    applyTheme(settings.theme, settings.accent);
    setThemeKey(themeVersion());
  }, [settings.theme, settings.accent]);

  return (
    <View key={themeKey} style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDarkMode() ? 'light' : 'dark'} />
      {/* The blur target: sheet/glass BlurViews blur this subtree's content. */}
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="settings"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('settings'),
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { color: colors.text },
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="data"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('dataBackup'),
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { color: colors.text },
            headerShadowVisible: false,
          }}
        />
      </Stack>
      </BlurTargetView>
    </View>
  );
}
