import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS } from '../utils/theme';
import apiClient from '../services/api';
import socketService from '../services/socket';
import { AuthContext } from '../context/AuthContext';
import MessageBubble from '../components/MessageBubble';
import TypingIndicator from '../components/TypingIndicator';

export default function ChatScreen({ route, navigation }) {
  const { conversationId, title } = route.params;
  const { isGuest, token } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [speakingText, setSpeakingText] = useState(null);
  const guestHistoryRef = useRef([]);

  useEffect(() => {
    navigation.setOptions({ 
      title: title || (isGuest ? 'Guest Session' : 'Estrely Chat'),
      headerRight: () => (
        <View style={styles.headerRightBox}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineStatusText}>{isGuest ? 'GUEST' : 'ONLINE'}</Text>
        </View>
      )
    });
    
    if (isGuest) {
      // Guest session initial welcome message
      setMessages([
        {
          id: 'guest-welcome',
          role: 'assistant',
          content: "Hello! I am Estrely, your luxury AI companion. Ask me anything—brainstorming, writing, deep concepts, or just casual talk. Your guest chat is private and ephemeral.",
          emotion: 'joy',
          createdAt: new Date().toISOString()
        }
      ]);
      return;
    }

    const loadMessages = async () => {
      try {
        const data = await apiClient.getMessages(conversationId);
        const list = data?.messages || (Array.isArray(data) ? data : []);
        // Reverse for inverted FlatList
        setMessages([...list].reverse());
      } catch (err) {
        console.error('Failed to load messages', err);
      }
    };
    loadMessages();

    // Setup socket connection
    if (token) {
      socketService.connect(token);
      socketService.joinConversation(conversationId);

      socketService.onResponse((msg) => {
        setIsTyping(false);
        setMessages(prev => [msg, ...prev]);
      });

      socketService.onTyping(() => {
        setIsTyping(true);
      });
    }

    return () => {
      if (token && conversationId) {
        socketService.leaveConversation(conversationId);
        socketService.disconnect();
      }
    };
  }, [conversationId, token, isGuest]);

  const handleSend = async (customText = null) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend || sending) return;

    const userMsg = {
      id: Date.now().toString(),
      content: textToSend,
      role: 'user',
      createdAt: new Date().toISOString()
    };
    
    setMessages(prev => [userMsg, ...prev]);
    if (!customText) setInputText('');
    setIsTyping(true);
    setSending(true);

    try {
      if (isGuest) {
        // Ephemeral Guest Messaging
        const responseData = await apiClient.sendGuestMessage(textToSend, guestHistoryRef.current);
        const botReply = responseData.response || responseData.message || '';
        
        guestHistoryRef.current.push({ role: 'user', content: textToSend });
        guestHistoryRef.current.push({ role: 'assistant', content: botReply });

        const botMsg = {
          id: (Date.now() + 1).toString(),
          content: botReply,
          role: 'assistant',
          emotion: responseData.emotion || 'neutral',
          emotion_confidence: responseData.emotion_confidence || 1,
          createdAt: new Date().toISOString()
        };
        setIsTyping(false);
        setMessages(prev => [botMsg, ...prev]);
      } else {
        // Registered User Messaging
        if (socketService.socket && socketService.socket.connected) {
          socketService.sendMessage(conversationId, textToSend);
        } else {
          // REST Fallback
          const responseData = await apiClient.sendMessage(conversationId, textToSend);
          const botReply = responseData.response || responseData.message || '';
          const botMsg = {
            id: (Date.now() + 1).toString(),
            content: botReply,
            role: 'assistant',
            emotion: responseData.emotion || 'neutral',
            emotion_confidence: responseData.emotion_confidence || 1,
            createdAt: new Date().toISOString()
          };
          setIsTyping(false);
          setMessages(prev => [botMsg, ...prev]);
        }
      }
    } catch (err) {
      setIsTyping(false);
      Alert.alert('Connection Error', err.message || 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleSpeak = (text) => {
    if (speakingText === text) {
      setSpeakingText(null);
      return;
    }
    setSpeakingText(text);
    setTimeout(() => {
      setSpeakingText(null);
    }, 4000);
  };

  const suggestions = [
    { title: '💡 Brainstorm Ideas', prompt: 'Give me 3 innovative concepts for a tech project.' },
    { title: '✨ Creative Story', prompt: 'Write a short story about an observatory looking into the unknown.' },
    { title: '🔍 Explain Simply', prompt: 'Explain quantum computing in simple, conversational terms.' },
    { title: '☕ Casual Chat', prompt: 'Hey Estrely! What are you up to today?' }
  ];

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Guest Mode Indicator Header Banner */}
      {isGuest && (
        <View style={styles.guestNotice}>
          <Icon name="shield-outline" size={14} color={COLORS.warning} style={{ marginRight: 6 }} />
          <Text style={styles.guestNoticeText}>
            Ephemeral Session: Messages are private & deleted upon exit.
          </Text>
        </View>
      )}

      {/* Messages FlatList */}
      <FlatList
        inverted
        data={isTyping ? [{ id: 'typing-indicator', isTyping: true }, ...messages] : messages}
        keyExtractor={item => item.id?.toString()}
        renderItem={({ item }) => {
          if (item.isTyping) return <TypingIndicator />;
          return (
            <MessageBubble 
              message={item} 
              onSpeak={handleSpeak}
              isSpeaking={speakingText === item.content}
            />
          );
        }}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={() => {
          // When conversation is empty or only has 1 message, show suggestions
          if (messages.length <= 1) {
            return (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsLabel}>POPULAR STARTERS</Text>
                <View style={styles.chipsGrid}>
                  {suggestions.map((s, idx) => (
                    <TouchableOpacity 
                      key={idx} 
                      style={styles.chip}
                      onPress={() => handleSend(s.prompt)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.chipText}>{s.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          }
          return null;
        }}
      />

      {/* Input Bar */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Ask Estrely anything..."
            placeholderTextColor={COLORS.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={10000}
          />
        </View>

        <TouchableOpacity 
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]} 
          onPress={() => handleSend()}
          disabled={!inputText.trim() || sending}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#050508" />
          ) : (
            <Icon name="arrow-up" size={20} color="#050508" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  headerRightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 10,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
    marginRight: 6,
  },
  onlineStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.accent,
    letterSpacing: 0.5,
  },
  guestNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.25)',
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  guestNoticeText: {
    color: COLORS.warning,
    fontSize: 11,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  suggestionsContainer: {
    marginBottom: 20,
    paddingTop: 10,
  },
  suggestionsLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    textAlign: 'center',
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  chip: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.bgSecondary,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'flex-end',
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: COLORS.inputBg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    minHeight: 44,
    maxHeight: 120,
    justifyContent: 'center',
  },
  input: {
    color: COLORS.textPrimary,
    fontSize: 15,
    paddingTop: Platform.OS === 'ios' ? 4 : 0,
    paddingBottom: Platform.OS === 'ios' ? 4 : 0,
  },
  sendButton: {
    backgroundColor: COLORS.accent,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(212, 175, 55, 0.35)',
    elevation: 0,
    shadowOpacity: 0,
  },
});
