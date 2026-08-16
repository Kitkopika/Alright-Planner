/**
 * AmbientBackground — the app's signature theme layer.
 *
 * A multi-hue glow (accent + a violet companion) that bleeds from the top
 * corners and bottom of every screen, behind the content. It's non-interactive
 * (pointerEvents none) and sits underneath the ScrollView, so it never
 * interrupts planning, focus, or any other interaction.
 *
 * Opacities are bumped in light mode (the same values would vanish on a near-
 * white background), keeping the layer clearly visible in both themes.
 */

import React, { useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors, isDarkMode, rotateHue } from '../theme';
import { useSvgId } from './motion';
import { useSettings } from '../data/settings';

export const AmbientBackground = React.memo(function AmbientBackground({ style }: { style?: StyleProp<ViewStyle> }) {
  const fx = useSettings((s) => s.visualFx.background);
  const id = useSvgId('amb');
  const light = !isDarkMode();
  const topOp = light ? 0.5 : 0.32;
  const sideOp = light ? 0.34 : 0.22;
  const bottomOp = light ? 0.22 : 0.12;
  const [box, setBox] = useState({ w: 0, h: 0 });

  if (!fx) return null;

  // Companion hue derives from the accent (+36°) so it always matches the theme.
  const secondary = rotateHue(colors.accent, 36);

  const top = `amb-t-${id}`;
  const side = `amb-s-${id}`;
  const bottom = `amb-b-${id}`;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width !== box.w || height !== box.h) setBox({ w: width, h: height });
      }}
    >
      {box.w > 0 && box.h > 0 && (
        <Svg width={box.w} height={box.h} style={{ backgroundColor: 'transparent' }}>
          <Defs>
            <RadialGradient id={top} cx="16%" cy="-8%" rx="72%" ry="54%">
              <Stop offset="0%" stopColor={colors.accent} stopOpacity={topOp} />
              <Stop offset="62%" stopColor={colors.accent} stopOpacity={topOp * 0.4} />
              <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id={side} cx="90%" cy="0%" rx="64%" ry="48%">
              <Stop offset="0%" stopColor={secondary} stopOpacity={sideOp} />
              <Stop offset="100%" stopColor={secondary} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id={bottom} cx="50%" cy="114%" rx="88%" ry="58%">
              <Stop offset="0%" stopColor={colors.accent} stopOpacity={bottomOp} />
              <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={box.w} height={box.h} fill={`url(#${top})`} />
          <Rect x="0" y="0" width={box.w} height={box.h} fill={`url(#${side})`} />
          <Rect x="0" y="0" width={box.w} height={box.h} fill={`url(#${bottom})`} />
        </Svg>
      )}
    </View>
  );
});
