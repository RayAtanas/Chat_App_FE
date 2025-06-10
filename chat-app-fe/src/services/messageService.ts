// src/services/api/messagesAPI.ts

import { AxiosResponse } from 'axios';
import api from './index';
import { Message } from '../types/types';

export interface RecentConversation {
  id: string;
  partnerId: string;
  partnerUsername: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export const messagesAPI = {
  getChatHistory: async (partnerId: string): Promise<Message[]> => {
    const response: AxiosResponse<Message[]> = await api.get(`/messages/history?partnerId=${partnerId}`);
    return response.data;
  },

  getRecentConversations: async (): Promise<RecentConversation[]> => {
    const response: AxiosResponse<RecentConversation[]> = await api.get('/messages/conversations');
    return response.data;
  },

  markMessagesAsRead: async (partnerId: string): Promise<void> => {
    await api.put(`/messages/mark-read/${partnerId}`);
  },

  deleteMessage: async (messageId: string): Promise<void> => {
    await api.delete(`/messages/${messageId}`);
  },
};