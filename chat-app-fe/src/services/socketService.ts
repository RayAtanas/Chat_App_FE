// src/services/socketService.ts

import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";

export interface SocketMessage {
  id: string;
  content: string;
  senderId: string;
  senderUsername: string;
  receiverId: string;
  receiverUsername: string;
  createdAt: string;
}

export interface UserStatus {
  userId: string;
  username: string;
  status: "ONLINE" | "OFFLINE";
}

export interface OnlineUser {
  id: string;
  username: string;
  status: string;
}

export interface TypingEvent {
  userId: string;
  username: string;
}

class SocketService {
  private socket: Socket | null = null;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(token: string): Promise<Socket> {
    this.token = token;
    
    // Disconnect existing socket if any
    if (this.socket) {
      this.socket.disconnect();
    }

    return new Promise((resolve, reject) => {
      this.socket = io("http://localhost:8080/chat", {
        auth: { token },
        transports: ["websocket"],
        forceNew: true, // Force new connection
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
      });

      if (!this.socket) {
        return reject(new Error("Socket initialization failed"));
      }

      this.socket.on("connect", () => {
        console.log("Connected to chat server with socket ID:", this.socket?.id);
        this.reconnectAttempts = 0;
        
        // Request online users immediately after connection
        setTimeout(() => {
          this.getOnlineUsers();
        }, 500);
        
        resolve(this.socket!);
      });

      this.socket.on("connect_error", (error: unknown) => {
        console.error("Socket connection error:", error);
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(error);
        }
      });

      this.socket.on("disconnect", (reason: string) => {
        console.log("Socket disconnected:", reason);
      });

      this.socket.on("reconnect", (attemptNumber: number) => {
        console.log("Socket reconnected after", attemptNumber, "attempts");
        setTimeout(() => {
          this.getOnlineUsers();
        }, 500);
      });

      this.socket.on("error", (error: unknown) => {
        console.error("Socket error:", error);
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      console.log("Manually disconnecting socket");
      this.socket.disconnect();
      this.socket = null;
    }
  }

  sendMessage(receiverId: string, content: string): void {
    if (this.socket?.connected) {
      this.socket.emit("message:send", { receiverId, content });
    } else {
      console.error("Socket not connected, cannot send message");
    }
  }

  getOnlineUsers(): void {
    if (this.socket?.connected) {
      console.log("Requesting online users...");
      this.socket.emit("users:online");
    } else {
      console.error("Socket not connected, cannot get online users");
    }
  }

  startTyping(receiverId: string): void {
    if (this.socket?.connected) {
      this.socket.emit("typing:start", { receiverId });
    }
  }

  stopTyping(receiverId: string): void {
    if (this.socket?.connected) {
      this.socket.emit("typing:stop", { receiverId });
    }
  }

  logout(): void {
    if (this.socket?.connected) {
      this.socket.emit("logout");
    }
  }

  onMessageReceive(callback: (message: SocketMessage) => void): void {
    this.socket?.on("message:receive", callback);
  }

  onMessageSent(callback: (message: SocketMessage) => void): void {
    this.socket?.on("message:sent", callback);
  }

  onUserStatus(callback: (status: UserStatus) => void): void {
    this.socket?.on("user:status", callback);
  }

  onUsersOnline(callback: (users: OnlineUser[]) => void): void {
    this.socket?.on("users:online", (users: OnlineUser[]) => {
      console.log("Received online users:", users);
      callback(users);
    });
  }

  onTypingStart(callback: (data: TypingEvent) => void): void {
    this.socket?.on("typing:start", callback);
  }

  onTypingStop(callback: (data: TypingEvent) => void): void {
    this.socket?.on("typing:stop", callback);
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// Create a new instance for each tab
export const socketService = new SocketService();