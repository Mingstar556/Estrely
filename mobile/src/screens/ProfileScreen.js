import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { COLORS } from '../utils/theme';
import { maskEmail } from '../utils/helpers';
import apiClient from '../services/api';
import Icon from 'react-native-vector-icons/Ionicons';

export default function ProfileScreen({ navigation }) {
  const { user, isGuest, logout } = useContext(AuthContext);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    if (isGuest) return;
    const fetchUsage = async () => {
      try {
        const data = await apiClient.getUsage();
        setUsage(data);
      } catch(err) {
        console.error('Failed to fetch usage', err);
      }
    };
    fetchUsage();
  }, [isGuest]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Profile Badge */}
      <View style={styles.header}>
        <View style={styles.avatarWrapper}>
          <View style={styles.avatarHalo} />
          <View style={[styles.avatar, isGuest && styles.avatarGuest]}>
            {isGuest ? (
              <Icon name="shield-checkmark" size={36} color={COLORS.accent} />
            ) : (
              <Text style={styles.avatarText}>
                {user?.username ? user.username.charAt(0).toUpperCase() : 'E'}
              </Text>
            )}
          </View>
        </View>

        <Text style={styles.username}>{user?.username || (isGuest ? 'Guest Explorer' : 'Member')}</Text>
        
        <View style={styles.badgeRow}>
          <View style={styles.proBadge}>
            <Text style={styles.proBadgeText}>{isGuest ? 'GUEST SESSION' : 'ESTRELY PRO'}</Text>
          </View>
        </View>

        <Text style={styles.email}>
          {isGuest ? 'Unsaved Temporary Session' : (user?.email ? maskEmail(user.email) : 'Authenticated')}
        </Text>
      </View>

      {/* AI Intelligence & Voice Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>AI Configuration</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingIconBox}>
            <Icon name="mic-outline" size={18} color={COLORS.accent} />
          </View>
          <View style={styles.settingTextContent}>
            <Text style={styles.settingLabel}>Voice Persona</Text>
            <Text style={styles.settingSub}>Vibrant teen voice (1.08x rate, 1.18x pitch, lively)</Text>
          </View>
          <View style={styles.activePill}>
            <Text style={styles.activePillText}>ACTIVE</Text>
          </View>
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingIconBox}>
            <Icon name="planet-outline" size={18} color={COLORS.accent} />
          </View>
          <View style={styles.settingTextContent}>
            <Text style={styles.settingLabel}>Intelligence Engine</Text>
            <Text style={styles.settingSub}>Multi-AI Orchestrator with Google Search</Text>
          </View>
          <View style={styles.activePill}>
            <Text style={styles.activePillText}>LIVE</Text>
          </View>
        </View>
      </View>

      {/* Token Usage Card (for registered users) */}
      {!isGuest && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Token Quota</Text>
          {usage ? (
            <View>
              <View style={styles.quotaRow}>
                <Text style={styles.statLabel}>Daily Usage</Text>
                <Text style={styles.statValue}>{usage.dailyTokens || 0} / 50,000</Text>
              </View>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${Math.min(100, ((usage.dailyTokens || 0) / 50000) * 100)}%` }
                  ]} 
                />
              </View>

              <View style={[styles.quotaRow, { marginTop: 12 }]}>
                <Text style={styles.statLabel}>Monthly Allocation</Text>
                <Text style={styles.statValue}>{usage.monthlyTokens || 0} / 500,000</Text>
              </View>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${Math.min(100, ((usage.monthlyTokens || 0) / 500000) * 100)}%` }
                  ]} 
                />
              </View>
            </View>
          ) : (
            <Text style={styles.loadingStatsText}>Syncing token metrics...</Text>
          )}
        </View>
      )}

      {/* Guest Call-to-action Card */}
      {isGuest && (
        <View style={[styles.card, styles.guestCtaCard]}>
          <Icon name="lock-open-outline" size={24} color={COLORS.accent} style={{ marginBottom: 8 }} />
          <Text style={styles.guestCtaTitle}>Upgrade to Full Account</Text>
          <Text style={styles.guestCtaDesc}>
            Sign up to unlock multi-conversation history, persistent chat memory, and device synchronization across PC & Phone.
          </Text>
          <TouchableOpacity 
            style={styles.guestUpgradeBtn}
            onPress={logout}
          >
            <Text style={styles.guestUpgradeBtnText}>Sign Up / Log In</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Logout / Exit Guest Session */}
      <TouchableOpacity 
        style={[styles.logoutBtn, isGuest && styles.exitGuestBtn]} 
        onPress={logout}
        activeOpacity={0.8}
      >
        <Icon 
          name={isGuest ? "exit-outline" : "log-out-outline"} 
          size={18} 
          color="#ffffff" 
          style={{ marginRight: 8 }} 
        />
        <Text style={styles.logoutText}>
          {isGuest ? 'Exit Guest Session' : 'Log Out'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.version}>Estrely Mobile • Version 1.0.0 (Pro)</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  content: {
    padding: 20,
    alignItems: 'center',
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatarWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarHalo: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.bgCard,
    borderWidth: 2,
    borderColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarGuest: {
    borderColor: COLORS.goldBorder,
  },
  avatarText: {
    color: COLORS.accent,
    fontSize: 32,
    fontWeight: '800',
  },
  username: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  proBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  proBadgeText: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  email: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  card: {
    backgroundColor: COLORS.bgCard,
    width: '100%',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  settingIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingTextContent: {
    flex: 1,
  },
  settingLabel: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  settingSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  activePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activePillText: {
    color: COLORS.success,
    fontSize: 9,
    fontWeight: '800',
  },
  quotaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  statValue: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.inputBg,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 3,
  },
  loadingStatsText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  guestCtaCard: {
    alignItems: 'center',
    borderColor: COLORS.goldBorder,
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
  },
  guestCtaTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  guestCtaDesc: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  guestUpgradeBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  guestUpgradeBtnText: {
    color: '#050508',
    fontWeight: '700',
    fontSize: 13,
  },
  logoutBtn: {
    flexDirection: 'row',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    width: '100%',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  exitGuestBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  logoutText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  version: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 24,
  },
});
