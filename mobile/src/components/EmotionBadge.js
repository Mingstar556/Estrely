import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { EMOTION_COLORS, COLORS } from '../utils/theme';

export default function EmotionBadge({ emotion, confidence = 1 }) {
  if (!emotion) return null;
  
  const color = EMOTION_COLORS[emotion.toLowerCase()] || EMOTION_COLORS.neutral;

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: color, opacity: 0.5 + (confidence * 0.5) }]} />
      <Text style={styles.text}>{emotion.charAt(0).toUpperCase() + emotion.slice(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  text: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
  }
});
