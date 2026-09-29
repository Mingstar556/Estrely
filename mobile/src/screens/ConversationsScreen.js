import React, { useState, useEffect, useContext } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  ActivityIndicator 
} from 'react-native';
import { COLORS } from '../utils/theme';
import Icon from 'react-native-vector-icons/Ionicons';
import apiClient from '../services/api';
import { formatTime, truncateText } from '../utils/helpers';
import EmotionBadge from '../components/EmotionBadge';
import { AuthContext } from '../context/AuthContext';

export default function ConversationsScreen({ navigation }) {
  const { isGuest, user } = useContext(AuthContext);
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchConversations = async () => {
    if (isGuest) {
      setConversations([{
        id: 'guest-session',
        title: 'Guest Session (Temporary)',
        lastMessage: 'Tap to chat. Messages are ephemeral and unsaved.',
        updatedAt: new Date().toISOString(),
        isGuest: true
      }]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await apiClient.getConversations();
      const list = data?.conversations || (Array.isArray(data) ? data : []);
      setConversations(list);
    } catch (error) {
      console.error('Failed to fetch conversations', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchConversations();
    });
    return unsubscribe;
  }, [navigation, isGuest]);

  const handleCreateNew = async () => {
    if (isGuest) {
      Alert.alert(
        'Guest Mode Restriction',
        'Guests are limited to a single temporary chat. To create multiple chats and save your history, sign up for a free account!',
        [
          { text: 'Got it' },
        ]
      );
      return;
    }

    try {
      setLoading(true);
      const conv = await apiClient.createConversation('New Chat');
      const convId = conv.id || conv.conversation_id;
      fetchConversations();
      navigation.navigate('Chat', { conversationId: convId, title: 'New Chat' });
    } catch(err) {
      Alert.alert('Error', err.message || 'Failed to create new conversation');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = (id, title) => {
    if (isGuest) {
      Alert.alert('Notice', 'Guest conversations are not stored.');
      return;
    }

    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete "${title || 'this chat'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteConversation(id);
              setConversations(prev => prev.filter(c => c.id !== id));
            } catch (err) {
              Alert.alert('Error', 'Failed to delete conversation');
            }
          }
        }
      ]
    );
  };

  const filteredConversations = conversations.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (c.title && c.title.toLowerCase().includes(q)) || 
           (c.lastMessage && c.lastMessage.toLowerCase().includes(q));
  });

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.item}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('Chat', { 
        conversationId: item.id, 
        title: item.title || 'Chat',
        isGuest 
      })}
    >
      <View style={styles.itemLeft}>
        <View style={[styles.avatarCircle, item.isGuest && styles.guestAvatarCircle]}>
          <Icon 
            name={item.isGuest ? "shield-outline" : "chatbubble-ellipses-outline"} 
            size={18} 
            color={COLORS.accent} 
          />
        </View>
      </View>

      <View style={styles.itemContent}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title || 'New Conversation'}
          </Text>
          {item.isGuest && (
            <View style={styles.unsavedPill}>
              <Text style={styles.unsavedText}>UNSAVED</Text>
            </View>
          )}
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {truncateText(item.lastMessage || 'No messages yet', 50)}
        </Text>
      </View>

      <View style={styles.itemRight}>
        <Text style={styles.time}>{formatTime(item.updatedAt || item.createdAt)}</Text>
        
        <View style={styles.actionRow}>
          {item.lastEmotion && <EmotionBadge emotion={item.lastEmotion} confidence={1} />}
          {!item.isGuest && (
            <TouchableOpacity 
              style={styles.deleteBtn}
              onPress={() => handleDeleteConversation(item.id, item.title)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="trash-outline" size={15} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Top Banner for Guests */}
      {isGuest && (
        <View style={styles.guestBanner}>
          <Icon name="information-circle-outline" size={18} color={COLORS.warning} style={{ marginRight: 6 }} />
          <Text style={styles.guestBannerText}>
            Guest Mode: Chats are ephemeral & not recorded.
          </Text>
        </View>
      )}

      {/* Search Input Bar */}
      {!isGuest && (
        <View style={styles.searchContainer}>
          <Icon name="search-outline" size={18} color={COLORS.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Conversation List */}
      {filteredConversations.length === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Icon name="chatbubbles-outline" size={36} color={COLORS.accent} />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No matching chats found' : 'Your Chat Lounge is Empty'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery ? 'Try a different keyword' : 'Start a new conversation with Estrely AI'}
          </Text>
          {!searchQuery && (
            <TouchableOpacity style={styles.emptyStartBtn} onPress={handleCreateNew}>
              <Text style={styles.emptyStartBtnText}>Start First Chat</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          refreshing={loading}
          onRefresh={fetchConversations}
          contentContainerStyle={styles.listPadding}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={[styles.fab, isGuest && styles.fabGuest]} 
        onPress={handleCreateNew}
        activeOpacity={0.85}
      >
        <Icon name="add" size={26} color="#050508" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  guestBannerText: {
    color: COLORS.warning,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    marginHorizontal: 14,
    marginVertical: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  listPadding: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    paddingBottom: 90,
  },
  item: {
    backgroundColor: COLORS.bgCard,
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  itemLeft: {
    marginRight: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestAvatarCircle: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  itemContent: {
    flex: 1,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  unsavedPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  unsavedText: {
    color: COLORS.danger,
    fontSize: 9,
    fontWeight: '800',
  },
  preview: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  itemRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 42,
  },
  time: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteBtn: {
    padding: 3,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  emptyStartBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyStartBtnText: {
    color: '#050508',
    fontWeight: '700',
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    bottom: 22,
    right: 22,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  fabGuest: {
    backgroundColor: COLORS.accent,
  },
});
