import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { COLORS } from '../utils/theme';
import Icon from 'react-native-vector-icons/Ionicons';

export default function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(dot1, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(dot2, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(dot3, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(dot1, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(dot2, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(dot3, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => animate());
    };
    animate();
  }, []);

  const translateY = (anim) => anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6]
  });

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Icon name="sparkles" size={14} color="#050508" />
      </View>
      <View style={styles.bubble}>
        <Animated.View style={[styles.dot, { transform: [{ translateY: translateY(dot1) }] }]} />
        <Animated.View style={[styles.dot, { transform: [{ translateY: translateY(dot2) }] }]} />
        <Animated.View style={[styles.dot, { transform: [{ translateY: translateY(dot3) }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 16,
    alignSelf: 'flex-start',
    alignItems: 'flex-end',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  bubble: {
    backgroundColor: COLORS.botBubble,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
    marginHorizontal: 3,
  }
});
