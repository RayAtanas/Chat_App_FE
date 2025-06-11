// src/components/chat/Chat.tsx

import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  MessageCircle, 
  Send, 
  LogOut, 
  Users,
  Circle,
  MoreVertical,
  X
} from 'lucide-react';
import { useAuth } from '../../services/authContext';
import { usersAPI, messagesAPI } from '../../services/api';
import { socketService, SocketMessage, OnlineUser, TypingEvent, UserStatus } from '../../services/socketService';
import { User as UserType, Message } from '../../types/types';

interface Notification {
  id: string;
  message: string;
  type: 'login' | 'logout';
  timestamp: number;
}

const Chat: React.FC = () => {
  const { user, logout, token } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<OnlineUser | null>(null);
  const [messages, setMessages] = useState<SocketMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState<{ [userId: string]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add notification function with duplicate prevention
  const addNotification = (message: string, type: 'login' | 'logout') => {
    // Check if the same notification already exists in the last 2 seconds
    const now = Date.now();
    const isDuplicate = notifications.some(n => 
      n.message === message && 
      n.type === type && 
      (now - n.timestamp) < 2000
    );
    
    if (isDuplicate) {
      console.log("Duplicate notification prevented:", message);
      return;
    }

    const notification: Notification = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      message,
      type,
      timestamp: now
    };
    
    console.log("Adding notification:", notification);
    setNotifications(prev => [...prev, notification]);
    
    // Auto remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  // Remove notification manually
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Initialize socket connection
  useEffect(() => {
    if (!token || !user) return;

    let isComponentMounted = true;

    const initSocket = async () => {
      try {
        console.log("Initializing socket for user:", user.username);
        await socketService.connect(token);
        
        if (!isComponentMounted) return;
        setIsConnected(true);
        
        // Define event handlers
        const handleMessageReceive = (message: SocketMessage) => {
          if (isComponentMounted) {
            setMessages(prev => [...prev, message]);
          }
        };

        const handleMessageSent = (message: SocketMessage) => {
          if (isComponentMounted) {
            setMessages(prev => [...prev, message]);
          }
        };

        const handleUsersOnline = (users: OnlineUser[]) => {
          if (isComponentMounted) {
            console.log("Online users updated:", users);
            // Filter out current user
            const filteredUsers = users.filter(u => u.id !== user.id);
            setOnlineUsers(filteredUsers);
            setLoading(false);
          }
        };

        const handleUserStatus = (status: UserStatus) => {
          if (!isComponentMounted) return;
          console.log("User status change:", status);
          
          setOnlineUsers(prev => {
            const userExists = prev.find(u => u.id === status.userId);
            
            if (status.status === 'ONLINE') {
              // Add user if not already in list and not current user
              if (!userExists && status.userId !== user.id) {
                // Show login notification
                addNotification(`${status.username} joined the chat`, 'login');
                return [...prev, { 
                  id: status.userId, 
                  username: status.username, 
                  status: 'ONLINE' 
                }];
              }
            } else {
              // Show logout notification if user was in the list
              if (userExists) {
                addNotification(`${status.username} left the chat`, 'logout');
                return prev.filter(u => u.id !== status.userId);
              }
            }
            return prev;
          });
        };

        const handleTypingStart = (data: TypingEvent) => {
          if (isComponentMounted) {
            setIsTyping(prev => ({ ...prev, [data.userId]: true }));
          }
        };

        const handleTypingStop = (data: TypingEvent) => {
          if (isComponentMounted) {
            setIsTyping(prev => ({ ...prev, [data.userId]: false }));
          }
        };

        // Remove any existing listeners first
        socketService.off('message:receive');
        socketService.off('message:sent');
        socketService.off('users:online');
        socketService.off('user:status');
        socketService.off('typing:start');
        socketService.off('typing:stop');

        // Set up event listeners
        socketService.onMessageReceive(handleMessageReceive);
        socketService.onMessageSent(handleMessageSent);
        socketService.onUsersOnline(handleUsersOnline);
        socketService.onUserStatus(handleUserStatus);
        socketService.onTypingStart(handleTypingStart);
        socketService.onTypingStop(handleTypingStop);

        setLoading(false);
      } catch (error) {
        console.error('Failed to connect to socket:', error);
        if (isComponentMounted) {
          setIsConnected(false);
          setLoading(false);
        }
      }
    };

    initSocket();

    return () => {
      console.log("Cleaning up socket connection for user:", user.username);
      isComponentMounted = false;
      
      // Clean up event listeners
      socketService.off('message:receive');
      socketService.off('message:sent');
      socketService.off('users:online');
      socketService.off('user:status');
      socketService.off('typing:start');
      socketService.off('typing:stop');
      
      socketService.disconnect();
    };
  }, [token, user]);

  // Periodic online users refresh and auto-refresh on user status changes
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      if (socketService.isConnected()) {
        console.log("Periodic refresh of online users");
        socketService.getOnlineUsers();
      }
    }, 15000); // Refresh every 15 seconds

    return () => clearInterval(interval);
  }, [isConnected]);

  // Auto-refresh users list when notifications are added (user joins/leaves)
  useEffect(() => {
    if (notifications.length > 0 && isConnected) {
      // Small delay to allow server to process the user status change
      setTimeout(() => {
        if (socketService.isConnected()) {
          console.log("Auto-refreshing users after status change");
          socketService.getOnlineUsers();
        }
      }, 1000);
    }
  }, [notifications.length, isConnected]);

  // Load chat history when user is selected
  useEffect(() => {
    if (selectedUser && user) {
      loadChatHistory(selectedUser.id);
    }
  }, [selectedUser, user]);

  const loadChatHistory = async (partnerId: string) => {
    try {
      const history = await messagesAPI.getChatHistory(partnerId);
      // Convert Message to SocketMessage format
      const socketMessages: SocketMessage[] = history.map(msg => ({
        id: msg.id,
        content: msg.content,
        senderId: msg.senderId,
        senderUsername: msg.senderId === user?.id ? user.username : selectedUser?.username || '',
        receiverId: msg.receiverId,
        receiverUsername: msg.receiverId === user?.id ? user.username : selectedUser?.username || '',
        createdAt: msg.createdAt
      }));
      setMessages(socketMessages);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedUser || !user) return;

    socketService.sendMessage(selectedUser.id, messageInput);
    setMessageInput('');
    
    // Stop typing indicator
    socketService.stopTyping(selectedUser.id);
  };

  const handleTyping = (value: string) => {
    setMessageInput(value);
    
    if (!selectedUser) return;

    if (value.trim()) {
      socketService.startTyping(selectedUser.id);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        socketService.stopTyping(selectedUser.id);
      }, 1000);
    } else {
      socketService.stopTyping(selectedUser.id);
    }
  };

  const handleLogout = () => {
    socketService.logout();
    logout();
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`flex items-center justify-between p-4 rounded-lg shadow-lg min-w-80 ${
              notification.type === 'login' 
                ? 'bg-green-100 border border-green-200 text-green-800' 
                : 'bg-orange-100 border border-orange-200 text-orange-800'
            } animate-slide-in`}
          >
            <div className="flex items-center space-x-3">
              <div className={`w-2 h-2 rounded-full ${
                notification.type === 'login' ? 'bg-green-500' : 'bg-orange-500'
              }`}></div>
              <span className="font-medium">{notification.message}</span>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="text-gray-500 hover:text-gray-700 ml-4"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Sidebar - Users List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 rounded-full w-10 h-10 flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">{user?.username}</h2>
                <div className="flex items-center space-x-1">
                  <Circle className={`w-2 h-2 ${isConnected ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'}`} />
                  <span className="text-xs text-gray-500">
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => socketService.getOnlineUsers()}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                title="Refresh online users"
              >
                <Users className="w-4 h-4" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Online Users */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center space-x-2 mb-4">
              <Users className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">
                Online Users ({onlineUsers.length})
              </h3>
            </div>
            
            {onlineUsers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No other users online</p>
                <button
                  onClick={() => socketService.getOnlineUsers()}
                  className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                >
                  Refresh
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {onlineUsers.map((onlineUser) => (
                  <div
                    key={onlineUser.id}
                    onClick={() => setSelectedUser(onlineUser)}
                    className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedUser?.id === onlineUser.id
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{onlineUser.username}</p>
                      <p className="text-xs text-green-600">Online</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">{selectedUser.username}</h2>
                    <p className="text-sm text-green-600">Online</p>
                  </div>
                </div>
                <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.senderId === user?.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-200'
                      }`}
                    >
                      <p className={message.senderId === user?.id ? 'text-white' : 'text-gray-900'}>
                        {message.content}
                      </p>
                      <p
                        className={`text-xs mt-1 ${
                          message.senderId === user?.id ? 'text-blue-100' : 'text-gray-500'
                        }`}
                      >
                        {formatTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              
              {/* Typing indicator */}
              {isTyping[selectedUser.id] && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-4 py-2 rounded-lg">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => handleTyping(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={`Message ${selectedUser.username}...`}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  disabled={!isConnected}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || !isConnected}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition duration-200 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* No user selected */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Select a conversation
              </h3>
              <p className="text-gray-500">
                Choose someone from the sidebar to start chatting
              </p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Chat;