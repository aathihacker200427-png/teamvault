import { create } from 'zustand'

interface PresenceState {
  statuses: Record<string, string>
  setUserStatus: (userId: string, status: string) => void
  isOnline: (userId: string) => boolean
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  statuses: {},
  setUserStatus: (userId, status) => set((state) => ({ statuses: { ...state.statuses, [userId]: status } })),
  isOnline: (userId) => get().statuses[userId] === 'online',
}))
