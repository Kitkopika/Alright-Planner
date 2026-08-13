/**
 * Tab navigation: Today, Calendar, Tasks, Routines, Money, Goals, Notes,
 * Insights — plus the universal Quick Add ("+") floating button.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../src/theme';
import { QuickAddModal } from '../../src/components/quickAdd';

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
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { paddingTop: 4 },
          tabBarLabelStyle: { fontSize: 9, fontWeight: '600' },
          tabBarItemStyle: { paddingVertical: 2 },
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

      {/* Universal Quick Add */}
      <Pressable
        onPress={() => setQuickAddOpen(true)}
        style={[styles.fab, { bottom: insets.bottom + 64 }]}
        accessibilityLabel="Quick add"
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </Pressable>

      <QuickAddModal visible={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    zIndex: 10,
  },
});
