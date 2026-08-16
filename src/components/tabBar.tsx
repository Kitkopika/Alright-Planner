/**
 * Custom tab bar with a sliding spotlight — the glow springs between tabs as
 * the user switches, and the active icon pops with a spring.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import { Spotlight } from './motion';
import { useSettings } from '../data/settings';

interface TabBarState {
  index: number;
  routes: { key: string; name: string }[];
}
interface TabDescriptor {
  options: {
    title?: string;
    tabBarLabel?: string;
    tabBarIcon?: (p: { focused: boolean; color: string; size: number }) => React.ReactNode;
  };
}
interface TabBarProps {
  state: TabBarState;
  descriptors: Record<string, TabDescriptor>;
  navigation: {
    emit: (e: { type: string; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

const SPOT = 48;

export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const fx = useSettings((s) => s.visualFx.lighting);
  const n = Math.max(1, state.routes.length);
  const tabWidth = width / n;

  const spot = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!fx) {
      spot.setValue(0);
      return;
    }
    const center = tabWidth * state.index + tabWidth / 2 - SPOT / 2;
    Animated.timing(spot, { toValue: center, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [state.index, tabWidth, spot, fx]);

  // Gentle breathing glow.
  useEffect(() => {
    if (!fx) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, fx]);

  return (
    <View
      style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border }, { paddingBottom: Math.max(insets.bottom, 6) }]}
    >
      {/* Sliding spotlight glow */}
      {fx && (
        <Animated.View
          pointerEvents="none"
          style={[styles.spot, { transform: [{ translateX: spot }], opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }]}
        >
          <Spotlight size={SPOT} opacity={0.55} />
        </Animated.View>
      )}

      {state.routes.map((route, i) => {
        const focused = i === state.index;
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel || options.title || route.name;
        const icon = options.tabBarIcon;
        const color = focused ? colors.accent : colors.textMuted;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable key={route.key} onPress={onPress} style={styles.tab}>
            <TabIcon focused={focused}>
              {icon ? icon({ focused, color, size: 24 }) : <Ionicons name="ellipse" size={24} color={color} />}
            </TabIcon>
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TabIcon({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  const fx = useSettings((s) => s.visualFx.animations);
  const s = useRef(new Animated.Value(focused && fx ? 1.12 : 1)).current;
  useEffect(() => {
    if (!fx) {
      s.setValue(1);
      return;
    }
    Animated.timing(s, { toValue: focused ? 1.12 : 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [focused, s, fx]);
  return <Animated.View style={[styles.iconWrap, { transform: [{ scale: s }] }]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    overflow: 'hidden',
  },
  spot: {
    position: 'absolute',
    top: 2,
    left: 0,
    width: SPOT,
    height: SPOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  iconWrap: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
  },
});
