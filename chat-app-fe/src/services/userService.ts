// src/services/api/usersAPI.ts

import { AxiosResponse } from 'axios';
import api from './index';
import { User } from '../types/types';

export const usersAPI = {
  getAllUsers: async (): Promise<Partial<User>[]> => {
    const response: AxiosResponse<Partial<User>[]> = await api.get('/users');
    return response.data;
  },

  getOnlineUsers: async (): Promise<Partial<User>[]> => {
    const response: AxiosResponse<Partial<User>[]> = await api.get('/users/online');
    return response.data;
  },

  getUserById: async (userId: string): Promise<User> => {
    const response: AxiosResponse<User> = await api.get(`/users/${userId}`);
    return response.data;
  },
};

