/**
 * Motion + spotlight primitives — dependency-light (RN core `Animated` + the
 * already-installed `react-native-svg`), so they work without any new native
 * module or rebuild.
 *
 * - Reveal: spring fade + slide-up on mount (interruptible, critically damped).
 * - Spotlight: soft radial accent glow for drawing the eye to a focal element.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors, motion } from '../theme';
import { useSettings } from '../data/settings';

/**
 * React's useId returns strings with characters (e.g. ":") that break SVG
 * `url(#id)` fragment references, so we strip them for gradient ids.
 */
export function useSvgId(prefix: string): string {
  const raw = React.useId();
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${prefix}${cleaned}`;
}

/**
 * A pressable that springs down on press-in and back on release — so the
 * animation replays on every single press. `style` is applied to the inner
 * (scaled) view.
 */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled,
  style,
  scaleTo = 0.92,
  hitSlop,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  hitSlop?: number;
}) {
  const fx = useSettings((s) => s.visualFx.animations);
  const s = useRef(new Animated.Value(1)).current;
  const animateTo = (to: number) => {
    if (!fx) {
      s.setValue(1);
      return;
    }
    Animated.timing(s, { toValue: to, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };
  const scale = s.interpolate({ inputRange: [0, 1], outputRange: [scaleTo, 1] });
  const translateY = s.interpolate({ inputRange: [0, 1], outputRange: [2, 0] });
  const opacity = s.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => animateTo(0)}
      onPressOut={() => animateTo(1)}
    >
      <Animated.View style={[style, { transform: [{ scale }, { translateY }], opacity }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Reveal({  children,
  delay = 0,
  distance = 14,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const fx = useSettings((s) => s.visualFx.animations);
  const p = useRef(new Animated.Value(fx ? 0 : 1)).current;
  useEffect(() => {
    if (!fx) {
      p.setValue(1);
      return;
    }
    const anim = Animated.spring(p, {
      toValue: 1,
      delay,
      useNativeDriver: true,
      ...motion.spring,
    });
    anim.start();
    return () => anim.stop();
  }, [p, delay, fx]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: p,
          transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Soft radial glow — place it absolutely behind a focal element. Colors fall
 * back to the current accent; `opacity` is the peak (center) alpha.
 */
export function Spotlight({
  size = 220,
  color = colors.accent,
  opacity = 0.45,
  style,
}: {
  size?: number;
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const id = useSvgId('spot');
  const gradId = `spot-${id}`;
  const fx = useSettings((s) => s.visualFx.lighting);
  if (!fx) return null;
  return (
    <Svg width={size} height={size} style={[{ backgroundColor: 'transparent' }, style]} pointerEvents="none">
      <Defs>
        <RadialGradient id={gradId} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <Stop offset="55%" stopColor={color} stopOpacity={opacity * 0.45} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={size} height={size} fill={`url(#${gradId})`} />
    </Svg>
  );
}

/**
 * Diagonal linear-gradient fill (top-left → bottom-right). Place inside a
 * sized, overflow-hidden container (e.g. a rounded button) to tint it.
 */export function GradientFill({ colors: cs, style }: { colors: [string, string]; style?: StyleProp<ViewStyle> }) {
  const fx = useSettings((s) => s.visualFx.gradients);
  if (!fx) return null;
  // expo-linear-gradient renders natively off the JS thread — no onLayout /
  // setState re-render storm inside animated views (the old SVG version
  // re-rendered React on every layout event during animations).
  return <LinearGradient colors={cs} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" style={[StyleSheet.absoluteFill, style]} />;
}

/**
 * A soft vertical fade (opaque → transparent) that overlays the top or bottom
 * edge of a scroll area, so content scrolling under the chrome blends instead
 * of cutting off with a hard edge.
 */
export const FadeEdge = React.memo(function FadeEdge({
  color,
  height = 16,
  position = 'top',
  style,
}: {
  color: string;
  height?: number;
  position?: 'top' | 'bottom';
  style?: StyleProp<ViewStyle>;
}) {
  const id = useSvgId('fade');
  const fx = useSettings((s) => s.visualFx.lighting);
  const [w, setW] = useState(0);
  if (!fx) return null;
  const atTop = position === 'top';
  return (
    <View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, right: 0, height, overflow: 'hidden', zIndex: 5 }, atTop ? { top: 0 } : { bottom: 0 }, style]}
      onLayout={(e) => {
        const { width } = e.nativeEvent.layout;
        if (width !== w) setW(width);
      }}
    >
      {w > 0 && (
        <Svg width={w} height={height} style={{ backgroundColor: 'transparent' }}>
          <Defs>
            <SvgLinearGradient id={id} x1="0" y1={atTop ? '0' : '1'} x2="0" y2={atTop ? '1' : '0'}>
              <Stop offset="0" stopColor={color} stopOpacity={0.6} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width={w} height={height} fill={`url(#${id})`} />
        </Svg>
      )}
    </View>
  );
});
