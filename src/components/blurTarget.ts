import { createRef } from 'react';
import type { View } from 'react-native';

/**
 * Ref to the `BlurTargetView` that wraps the app content (see app/_layout.tsx).
 * expo-blur's Android blur needs this explicit target — without it the
 * BlurView silently falls back to 'none' and no frosted glass appears.
 */
export const blurTargetRef = createRef<View>();
