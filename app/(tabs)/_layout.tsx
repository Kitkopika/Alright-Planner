/**
 * Tab navigation: Today, Calendar, Tasks, Routines, Money, Goals, Notes,
 * Reminders. The universal Quick Add ("+") lives only on the Today (Home)
 * screen; every other screen has its own page-specific add action.
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../src/theme';
import { TKey, useT } from '../../src/i18n';
import { TabBar } from '../../src/components/tabBar';
import { useSettings } from '../../src/data/settings';

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; tKey: TKey; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', tKey: 'today', icon: 'today-outline', iconActive: 'today' },
  { name: 'calendar', tKey: 'calendar', icon: 'calendar-outline', iconActive: 'calendar' },
  { name: 'tasks', tKey: 'tasks', icon: 'checkbox-outline', iconActive: 'checkbox' },
  { name: 'routines', tKey: 'routines', icon: 'repeat-outline', iconActive: 'repeat' },
  { name: 'money', tKey: 'money', icon: 'wallet-outline', iconActive: 'wallet' },
  { name: 'goals', tKey: 'goals', icon: 'flag-outline', iconActive: 'flag' },
  { name: 'notes', tKey: 'notes', icon: 'document-text-outline', iconActive: 'document-text' },
  { name: 'reminders', tKey: 'tabReminders', icon: 'notifications-outline', iconActive: 'notifications' },
];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tt = useT();
  const animFx = useSettings((s) => s.visualFx.animations);

  return (
    <Tabs
      tabBar={(props) => <TabBar {...(props as any)} />}
      // Keep every scene attached: detaching + re-attaching on focus makes
      // the incoming screen repaint its content mid-transition, which shows
      // up as direction-dependent stutter/black frames.
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        // Fade between tabs: the old slide repainted the whole scene every
        // frame; a fade only animates opacity, so switching is smooth in
        // both directions (per the nav-lag analysis).
        animation: animFx ? 'fade' : 'none',
        // Pre-mount every tab so switching is instant (no blank/lag on first
        // visit to a screen).
        lazy: false,
        // Edge-to-edge: offset every scene below the status bar / display
        // cutout using the real inset (never a hardcoded margin). The strip
        // shows the app background so the design is unchanged.
        sceneStyle: { paddingTop: insets.top, backgroundColor: colors.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tt(tab.tKey),
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? tab.iconActive : tab.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
