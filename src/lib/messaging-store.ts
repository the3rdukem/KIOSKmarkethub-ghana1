/**
 * Messaging Store
 *
 * Production-ready persistent messaging system for:
 * - Buyer ↔ Vendor conversations
 * - Product inquiries (pre-purchase)
 * - Order-related messages (post-purchase)
 *
 * For authenticated users: syncs with database via API
 * For guests: uses localStorage (read-only view not applicable)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MessageType = 'text' | 'image' | 'file' | 'system';
export type ConversationContext = 'product_inquiry' | 'order_support' | 'general' | 'dispute';
export type ConversationStatus = 'active' | 'archived' | 'flagged' | 'closed';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: 'buyer' | 'vendor' | 'admin';
  senderAvatar?: string;
  content: string;
  messageType: MessageType;
  attachmentUrl?: string;
  attachmentName?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

export interface Conversation {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar?: string;
  vendorId: string;
  vendorName: string;
  vendorAvatar?: string;
  vendorBusinessName?: string;
  context: ConversationContext;
  productId?: string;
  productName?: string;
  productImage?: string;
  orderId?: string;
  orderNumber?: string;
  disputeId?: string;
  status: ConversationStatus;
  isPinnedBuyer: boolean;
  isPinnedVendor: boolean;
  isMutedBuyer: boolean;
  isMutedVendor: boolean;
  lastMessageId?: string;
  lastMessageContent?: string;
  lastMessageAt?: string;
  lastMessageSenderId?: string;
  unreadCountBuyer: number;
  unreadCountVendor: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  archivedBy?: string;
  flaggedAt?: string;
  flaggedBy?: string;
  flagReason?: string;
  moderatorNotes?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

interface MessagingState {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  currentConversationId: string | null;
  nextCursor: string | null;
  messagesNextCursor: Record<string, string | null>;

  setCurrentConversation: (id: string | null) => void;
  fetchConversations: (cursor?: string) => Promise<void>;
  fetchMessages: (conversationId: string, cursor?: string) => Promise<void>;
  createConversation: (data: {
    vendorId: string;
    productId?: string;
    orderId?: string;
    context?: ConversationContext;
  }) => Promise<Conversation | null>;
  sendMessage: (conversationId: string, content: string, messageType?: MessageType) => Promise<Message | null>;
  markConversationAsRead: (conversationId: string) => Promise<void>;
  updateConversationSettings: (conversationId: string, updates: { isPinned?: boolean; isMuted?: boolean }) => Promise<void>;
  archiveConversation: (conversationId: string) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const useMessagingStore = create<MessagingState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messages: {},
      unreadCount: 0,
      isLoading: false,
      error: null,
      currentConversationId: null,
      nextCursor: null,
      messagesNextCursor: {},

      setCurrentConversation: (id) => {
        set({ currentConversationId: id });
        if (id) {
          get().fetchMessages(id);
          get().markConversationAsRead(id);
        }
      },

      fetchConversations: async (cursor?: string) => {
        set({ isLoading: true, error: null });
        try {
          const params = new URLSearchParams();
          params.set('limit', '20');
          if (cursor) params.set('cursor', cursor);

          const response = await fetch(`/api/messaging/conversations?${params}`);
          if (!response.ok) {
            if (response.status === 401) {
              set({ conversations: [], isLoading: false });
              return;
            }
            throw new Error('Failed to fetch conversations');
          }

          const data = await response.json();
          set((state) => ({
            conversations: cursor 
              ? [...state.conversations, ...data.conversations]
              : data.conversations,
            nextCursor: data.nextCursor || null,
            unreadCount: data.unreadCount || 0,
            isLoading: false,
          }));
        } catch (error) {
          console.error('[MessagingStore] fetchConversations error:', error);
          set({ error: 'Failed to load conversations', isLoading: false });
        }
      },

      fetchMessages: async (conversationId: string, cursor?: string) => {
        set({ isLoading: true, error: null });
        try {
          const params = new URLSearchParams();
          params.set('limit', '50');
          if (cursor) params.set('cursor', cursor);

          const response = await fetch(`/api/messaging/conversations/${conversationId}/messages?${params}`);
          if (!response.ok) {
            if (response.status === 401 || response.status === 404) {
              set({ isLoading: false });
              return;
            }
            throw new Error('Failed to fetch messages');
          }

          const data = await response.json();
          const messages = data.messages.reverse();

          set((state) => ({
            messages: {
              ...state.messages,
              [conversationId]: cursor
                ? [...messages, ...(state.messages[conversationId] || [])]
                : messages,
            },
            messagesNextCursor: {
              ...state.messagesNextCursor,
              [conversationId]: data.nextCursor || null,
            },
            isLoading: false,
          }));
        } catch (error) {
          console.error('[MessagingStore] fetchMessages error:', error);
          set({ error: 'Failed to load messages', isLoading: false });
        }
      },

      createConversation: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch('/api/messaging/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create conversation');
          }

          const result = await response.json();
          const conversation = result.conversation;

          set((state) => {
            const exists = state.conversations.some((c) => c.id === conversation.id);
            return {
              conversations: exists
                ? state.conversations
                : [conversation, ...state.conversations],
              currentConversationId: conversation.id,
              isLoading: false,
            };
          });

          return conversation;
        } catch (error) {
          console.error('[MessagingStore] createConversation error:', error);
          set({ error: error instanceof Error ? error.message : 'Failed to create conversation', isLoading: false });
          return null;
        }
      },

      sendMessage: async (conversationId: string, content: string, messageType: MessageType = 'text') => {
        set({ error: null });
        try {
          const response = await fetch(`/api/messaging/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ content, messageType }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to send message');
          }

          const result = await response.json();
          const message = result.message;

          set((state) => ({
            messages: {
              ...state.messages,
              [conversationId]: [...(state.messages[conversationId] || []), message],
            },
            conversations: state.conversations.map((c) =>
              c.id === conversationId
                ? {
                    ...c,
                    lastMessageId: message.id,
                    lastMessageContent: message.content.substring(0, 100),
                    lastMessageAt: message.createdAt,
                    lastMessageSenderId: message.senderId,
                    updatedAt: message.createdAt,
                  }
                : c
            ),
          }));

          return message;
        } catch (error) {
          console.error('[MessagingStore] sendMessage error:', error);
          set({ error: error instanceof Error ? error.message : 'Failed to send message' });
          return null;
        }
      },

      markConversationAsRead: async (conversationId: string) => {
        try {
          const response = await fetch(`/api/messaging/conversations/${conversationId}/read`, {
            method: 'POST',
            credentials: 'include',
          });

          if (response.ok) {
            const convResponse = await fetch(`/api/messaging/conversations/${conversationId}`);
            if (convResponse.ok) {
              const data = await convResponse.json();
              set((state) => ({
                conversations: state.conversations.map((c) =>
                  c.id === conversationId ? data.conversation : c
                ),
              }));
            }
            get().fetchUnreadCount();
          }
        } catch (error) {
          console.error('[MessagingStore] markConversationAsRead error:', error);
        }
      },

      updateConversationSettings: async (conversationId: string, updates: { isPinned?: boolean; isMuted?: boolean }) => {
        try {
          const response = await fetch(`/api/messaging/conversations/${conversationId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(updates),
          });

          if (response.ok) {
            const result = await response.json();
            set((state) => ({
              conversations: state.conversations.map((c) =>
                c.id === conversationId ? { ...c, ...result.conversation } : c
              ),
            }));
          }
        } catch (error) {
          console.error('[MessagingStore] updateConversationSettings error:', error);
        }
      },

      archiveConversation: async (conversationId: string) => {
        try {
          const response = await fetch(`/api/messaging/conversations/${conversationId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ action: 'archive' }),
          });

          if (response.ok) {
            set((state) => ({
              conversations: state.conversations.filter((c) => c.id !== conversationId),
              currentConversationId: state.currentConversationId === conversationId ? null : state.currentConversationId,
            }));
          }
        } catch (error) {
          console.error('[MessagingStore] archiveConversation error:', error);
        }
      },

      fetchUnreadCount: async () => {
        try {
          const response = await fetch('/api/messaging/unread');
          if (response.ok) {
            const data = await response.json();
            set({ unreadCount: data.unreadCount || 0 });
          }
        } catch (error) {
          console.error('[MessagingStore] fetchUnreadCount error:', error);
        }
      },

      clearError: () => set({ error: null }),

      reset: () => set({
        conversations: [],
        messages: {},
        unreadCount: 0,
        isLoading: false,
        error: null,
        currentConversationId: null,
        nextCursor: null,
        messagesNextCursor: {},
      }),
    }),
    {
      name: 'marketplace-messaging',
      partialize: (state) => ({
        currentConversationId: state.currentConversationId,
      }),
    }
  )
);
