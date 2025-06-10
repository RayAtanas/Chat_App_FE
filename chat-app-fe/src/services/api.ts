

// Centralized exports for all API services
export { authAPI } from './authService';
export { usersAPI } from './userService';
export { messagesAPI } from './messageService';
export type { RecentConversation } from './messageService';


export { default as api } from './index';