import { create } from 'zustand'

interface TypingState {
  // Map of conversation/channel ID -> Map of user_id -> timeout id
  typing: Record<string, Record<string, number>>
  setTyping: (targetId: string, userId: string) => void
  clearTyping: (targetId: string, userId: string) => void
  getTypers: (targetId: string) => string[]
}

export const useTypingStore = create<TypingState>((set, get) => ({
  typing: {},
  setTyping: (targetId, userId) => {
    // Clear existing timeout
    const existing = get().typing[targetId]?.[userId]
    if (existing) clearTimeout(existing)

    // Auto-clear after 5 seconds of no activity
    const timeoutId = window.setTimeout(() => {
      set((state) => {
        const target = { ...state.typing[targetId] }
        delete target[userId]
        return { typing: { ...state.typing, [targetId]: target } }
      })
    }, 5000)

    set((state) => ({
      typing: {
        ...state.typing,
        [targetId]: { ...(state.typing[targetId] || {}), [userId]: timeoutId },
      },
    }))
  },
  clearTyping: (targetId, userId) =>
    set((state) => {
      const existing = state.typing[targetId]?.[userId]
      if (existing) clearTimeout(existing)
      const target = { ...state.typing[targetId] }
      delete target[userId]
      return { typing: { ...state.typing, [targetId]: target } }
    }),
  getTypers: (targetId) => Object.keys(get().typing[targetId] || {}),
}))
