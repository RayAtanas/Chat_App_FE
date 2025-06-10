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

  connect(token: string): Promise<Socket> {
    this.token = token;
    return new Promise((resolve, reject) => {
      this.socket = io("http://localhost:8080/chat", {
        auth: { token },
        transports: ["websocket"],
      });

      if (!this.socket) {
        return reject(new Error("Socket initialization failed"));
      }

      this.socket.on("connect", () => {
        console.log("Connected to chat server");
        resolve(this.socket!);
      });

      this.socket.on("connect_error", (error: unknown) => {
        console.error("Socket connection error:", error);
        reject(error);
      });

      this.socket.on("error", (error: unknown) => {
        console.error("Socket error:", error);
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  sendMessage(receiverId: string, content: string): void {
    this.socket?.emit("message:send", { receiverId, content });
  }

  getOnlineUsers(): void {
    this.socket?.emit("users:online");
  }

  startTyping(receiverId: string): void {
    this.socket?.emit("typing:start", { receiverId });
  }

  stopTyping(receiverId: string): void {
    this.socket?.emit("typing:stop", { receiverId });
  }

  logout(): void {
    this.socket?.emit("logout");
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
    this.socket?.on("users:online", callback);
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
}

export const socketService = new SocketService();