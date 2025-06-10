// src/services/api/authAPI.ts

import { AxiosResponse } from 'axios';
import api from './index';
import { LoginUserDto, RegisterUserDto, LoginResponse, ProfileResponse, User } from '../types/types';

export const authAPI = {
  register: async (userData: RegisterUserDto): Promise<Partial<User>> => {
    const response: AxiosResponse<Partial<User>> = await api.post('/auth/register', userData);
    return response.data;
  },

  login: async (credentials: LoginUserDto): Promise<LoginResponse> => {
    const response: AxiosResponse<LoginResponse> = await api.post('/auth/login', credentials);
    return response.data;
  },

  getProfile: async (): Promise<ProfileResponse> => {
    const response: AxiosResponse<ProfileResponse> = await api.get('/auth/profile');
    return response.data;
  },
};