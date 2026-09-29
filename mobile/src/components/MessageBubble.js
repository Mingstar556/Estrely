import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { COLORS } from '../utils/theme';
import { formatTime } from '../utils/helpers';
import EmotionBadge from './EmotionBadge';
import Icon from 'react-native-vector-icons/Ionicons';

export default function MessageBubble({ message, onSpeak, isSpeaking }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.botContainer]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Icon name="sparkles" size={14} color="#050508" />
        </View>
      )}

      <View style={styles.contentWrapper}>
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
          <Text style={[styles.text, isUser ? styles.userText : styles.botText]}>
            {message.content}
          </Text>
        </View>

        {/* Message Actions / Footer */}
        <View style={[styles.footer, isUser && styles.footerUser]}>
          {!isUser && message.emotion && (
            <EmotionBadge emotion={message.emotion} confidence={message.emotion_confidence || 1} />
          )}

          {!isUser && (
            <View style={styles.actionRow}>
              {/* Copy button */}
              <TouchableOpacity 
                style={styles.actionBtn} 
                onPress={handleCopy}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon 
                  name={copied ? "checkmark" : "copy-outline"} 
                  size={13} 
                  color={copied ? COLORS.success : COLORS.textMuted} 
                />
                <Text style={[styles.actionBtnText, copied && { color: COLORS.success }]}>
                  {copied ? 'Copied' : 'Copy'}
                </Text>
              </TouchableOpacity>

              {/* Listen button if handler passed */}
              {onSpeak && (
                <TouchableOpacity 
                  style={[styles.actionBtn, isSpeaking && styles.speakingBtn]} 
                  onPress={() => onSpeak(message.content)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon 
                    name={isSpeaking ? "volume-high" : "volume-medium-outline"} 
                    size={14} 
                    color={isSpeaking ? COLORS.accent : COLORS.textMuted} 
                  />
                  <Text style={[styles.actionBtnText, isSpeaking && { color: COLORS.accent }]}>
                    {isSpeaking ? 'Speaking' : 'Listen'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <Text style={styles.time}>{formatTime(message.createdAt)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '88%',
  },
  userContainer: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  botContainer: {
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 4,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  contentWrapper: {
    flex: 1,
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: COLORS.userBubble,
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  botBubble: {
    backgroundColor: COLORS.botBubble,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#ffffff',
  },
  botText: {
    color: COLORS.textPrimary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    marginTop: 6,
    paddingHorizontal: 4,
    flexWrap: 'wrap',
  },
  footerUser: {
    justifyContent: 'flex-end',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 4,
  },
  speakingBtn: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  actionBtnText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  time: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
});
