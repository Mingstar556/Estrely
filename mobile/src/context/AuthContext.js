import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const guestFlag = await AsyncStorage.getItem('estrely_is_guest');
        if (guestFlag === 'true') {
          setIsGuest(true);
          setUser({
            id: 'guest',
            username: 'Guest Explorer',
            email: 'Ephemeral Session (Unsaved)',
            role: 'guest'
          });
          setIsLoading(false);
          return;
        }

        const storedToken = await AsyncStorage.getItem('estrely_token');
        if (storedToken) {
          apiClient.setToken(storedToken);
          try {
            const profile = await apiClient.getProfile();
            setUser(profile.user || profile);
            setToken(storedToken);
            setIsGuest(false);
          } catch(err) {
            console.error("Token invalid or expired", err);
            await AsyncStorage.removeItem('estrely_token');
            apiClient.setToken(null);
          }
        }
      } catch (e) {
        console.error('Failed to load auth status', e);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuthStatus();
  }, []);

  const login = async (username, password) => {
    try {
      const response = await apiClient.login(username, password);
      const newToken = response.token;
      const newUser = response.user;
      setUser(newUser);
      setToken(newToken);
      setIsGuest(false);
      apiClient.setToken(newToken);
      await AsyncStorage.setItem('estrely_token', newToken);
      await AsyncStorage.removeItem('estrely_is_guest');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const register = async (username, email, password) => {
    try {
      const response = await apiClient.register(username, email, password);
      const newToken = response.token;
      const newUser = response.user;
      setUser(newUser);
      setToken(newToken);
      setIsGuest(false);
      apiClient.setToken(newToken);
      await AsyncStorage.setItem('estrely_token', newToken);
      await AsyncStorage.removeItem('estrely_is_guest');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const loginAsGuest = async () => {
    setIsGuest(true);
    setToken(null);
    apiClient.setToken(null);
    const guestUser = {
      id: 'guest',
      username: 'Guest Explorer',
      email: 'Ephemeral Session (Unsaved)',
      role: 'guest'
    };
    setUser(guestUser);
    await AsyncStorage.setItem('estrely_is_guest', 'true');
    await AsyncStorage.removeItem('estrely_token');
    return { success: true };
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    setIsGuest(false);
    apiClient.setToken(null);
    await AsyncStorage.removeItem('estrely_token');
    await AsyncStorage.removeItem('estrely_is_guest');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isGuest,
        isLoading,
        login,
        register,
        loginAsGuest,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
