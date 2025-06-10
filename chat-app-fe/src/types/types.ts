export interface User {
  id: string;
  username: string;
}

export interface RegisterUserDto {
  username: string;
  password: string;
}

export interface LoginUserDto {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
}

export interface ProfileResponse {
  userId: string;
  username: string;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
  sender?: User;
  receiver?: User;
}

export interface OnlineUser {
  id: string;
  username: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (credentials: LoginUserDto) => Promise<void>;
  register: (userData: RegisterUserDto) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}