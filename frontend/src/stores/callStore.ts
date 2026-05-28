import { create } from 'zustand'

interface CallParticipant {
  user_id: string
  display_name: string
  has_audio: boolean
  has_video: boolean
  has_screen: boolean
}

interface CallState {
  activeCall: {
    id: string
    call_type: string
    routing_mode: string
    status: string
    participants: CallParticipant[]
  } | null
  localStream: MediaStream | null
  remoteStreams: Record<string, MediaStream>
  setActiveCall: (call: CallState['activeCall']) => void
  setLocalStream: (stream: MediaStream | null) => void
  addRemoteStream: (userId: string, stream: MediaStream) => void
  removeRemoteStream: (userId: string) => void
  endCall: () => void
}

export const useCallStore = create<CallState>((set) => ({
  activeCall: null,
  localStream: null,
  remoteStreams: {},
  setActiveCall: (activeCall) => set({ activeCall }),
  setLocalStream: (localStream) => set({ localStream }),
  addRemoteStream: (userId, stream) =>
    set((state) => ({
      remoteStreams: {
        ...state.remoteStreams,
        [userId]: stream,
      },
    })),
  removeRemoteStream: (userId) =>
    set((state) => {
      const { [userId]: _, ...rest } = state.remoteStreams
      return { remoteStreams: rest }
    }),
  endCall: () =>
    set({
      activeCall: null,
      localStream: null,
      remoteStreams: {},
    }),
}))
