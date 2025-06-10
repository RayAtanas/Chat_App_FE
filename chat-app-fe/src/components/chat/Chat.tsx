// src/components/chat/Chat.tsx

import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  MessageCircle, 
  Send, 
  LogOut, 
  Users,
  Circle,
  MoreVertical
} from 'lucide-react';
import { useAuth } from '../../services/authContext';
import { usersAPI, messagesAPI } from '../../services/api';
import { socketService, SocketMessage, OnlineUser, TypingEvent } from '../../services/socketService';
import { User as UserType, Message } from '../../types/types';

const Chat: React.FC = () => {
  const { user, logout, token } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<OnlineUser | null>(null);
  const [messages, setMessages] = useState<SocketMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState<{ [userId: string]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize socket connection
  useEffect(() => {
    if (!token || !user) return;

    const initSocket = async () => {
      try {
        await socketService.connect(token);
        setIsConnected(true);
        
        // Get initial online users
        socketService.getOnlineUsers();
        
        // Set up event listeners
        socketService.onMessageReceive((message: SocketMessage) => {
          setMessages(prev => [...prev, message]);
        });

        socketService.onMessageSent((message: SocketMessage) => {
          setMessages(prev => [...prev, message]);
        });

        socketService.onUsersOnline((users: OnlineUser[]) => {
          // Filter out current user
          const filteredUsers = users.filter(u => u.id !== user.id);
          setOnlineUsers(filteredUsers);
          setLoading(false);
        });

        socketService.onUserStatus((status) => {
          setOnlineUsers(prev => {
            if (status.status === 'ONLINE') {
              // Add user if not already in list and not current user
              if (!prev.find(u => u.id === status.userId) && status.userId !== user.id) {
                return [...prev, { 
                  id: status.userId, 
                  username: status.username, 
                  email: '', 
                  status: 'ONLINE' 
                }];
              }
            } else {
              // Remove user from online list
              return prev.filter(u => u.id !== status.userId);
            }
            return prev;
          });
        });

        socketService.onTypingStart((data: TypingEvent) => {
          setIsTyping(prev => ({ ...prev, [data.userId]: true }));
        });

        socketService.onTypingStop((data: TypingEvent) => {
          setIsTyping(prev => ({ ...prev, [data.userId]: false }));
        });

      } catch (error) {
        console.error('Failed to connect to socket:', error);
        setLoading(false);
      }
    };

    initSocket();

    return () => {
      socketService.disconnect();
    };
  }, [token, user]);

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
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
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
    </div>
  );
};

export default Chat;