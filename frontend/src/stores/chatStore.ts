import { create } from 'zustand'

interface User { id: string; display_name: string; avatar_url?: string; status: string }
interface Message { id: string; channel_id?: string; conversation_id?: string; sender: User; content: string; reply_to?: { id: string; sender_name: string; content: string }; edited_at?: string; created_at: string }

interface ChatState {
  messages: Record<string, Message[]>
  activeConversation: string | null
  unreadCounts: Record<string, number>
  addMessage: (targetId: string, message: Message) => void
  setMessages: (targetId: string, messages: Message[]) => void
  prependMessages: (targetId: string, messages: Message[]) => void
  setActiveConversation: (targetId: string | null) => void
  incrementUnread: (targetId: string) => void
  clearUnread: (targetId: string) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: {},
  activeConversation: null,
  unreadCounts: {},
  addMessage: (targetId, message) =>
    set((state) => {
      const isActive = state.activeConversation === targetId
      return {
        messages: { ...state.messages, [targetId]: [...(state.messages[targetId] || []), message] },
        unreadCounts: isActive ? state.unreadCounts : { ...state.unreadCounts, [targetId]: (state.unreadCounts[targetId] || 0) + 1 },
      }
    }),
  setMessages: (targetId, messages) =>
    set((state) => ({ messages: { ...state.messages, [targetId]: messages } })),
  prependMessages: (targetId, messages) =>
    set((state) => ({ messages: { ...state.messages, [targetId]: [...messages, ...(state.messages[targetId] || [])] } })),
  setActiveConversation: (activeConversation) =>
    set((state) => ({ activeConversation, unreadCounts: activeConversation ? { ...state.unreadCounts, [activeConversation]: 0 } : state.unreadCounts })),
  incrementUnread: (targetId) =>
    set((state) => ({ unreadCounts: { ...state.unreadCounts, [targetId]: (state.unreadCounts[targetId] || 0) + 1 } })),
  clearUnread: (targetId) =>
    set((state) => ({ unreadCounts: { ...state.unreadCounts, [targetId]: 0 } })),
}))
