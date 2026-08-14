/**
 * Tab navigation: Today, Calendar, Tasks, Routines, Money, Goals, Notes,
 * Insights. The universal Quick Add ("+") lives only on the Today (Home)
 * screen; every other screen has its own page-specific add action.
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../src/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; label: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', label: 'Today', icon: 'today-outline', iconActive: 'today' },
  { name: 'calendar', label: 'Calendar', icon: 'calendar-outline', iconActive: 'calendar' },
  { name: 'tasks', label: 'Tasks', icon: 'checkbox-outline', iconActive: 'checkbox' },
  { name: 'routines', label: 'Routines', icon: 'repeat-outline', iconActive: 'repeat' },
  { name: 'money', label: 'Money', icon: 'wallet-outline', iconActive: 'wallet' },
  { name: 'goals', label: 'Goals', icon: 'flag-outline', iconActive: 'flag' },
  { name: 'notes', label: 'Notes', icon: 'document-text-outline', iconActive: 'document-text' },
  { name: 'insights', label: 'Insights', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { paddingTop: 4 },
        tabBarLabelStyle: { fontSize: 9, fontWeight: '600' },
        tabBarItemStyle: { paddingVertical: 2 },
        // Edge-to-edge: offset every scene below the status bar / display
        // cutout using the real inset (never a hardcoded margin). The strip
        // shows the app background so the design is unchanged.
        sceneStyle: { paddingTop: insets.top, backgroundColor: colors.background },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.label,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? t.iconActive : t.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
