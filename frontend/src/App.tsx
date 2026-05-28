import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { useSettingsStore } from './stores/settingsStore'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import WorkspacePage from './pages/WorkspacePage'
import { useWebSocket, wsClient } from './ws/client'
import { useChatStore } from './stores/chatStore'
import { usePresenceStore } from './stores/presenceStore'
import { useCallStore } from './stores/callStore'
import { useTypingStore } from './stores/typingStore'
import { Toaster, toast } from './components/Toaster'
import ConnectionBanner from './components/ConnectionBanner'
import IncomingCallModal from './components/call/IncomingCallModal'
import { callManager } from './webrtc/callManager'
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { callsApi } from './api/calls'
import { getUserMedia } from './webrtc/mediaManager'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function AppShell({ children }: { children: React.ReactNode }) {
  useWebSocket()
  const { addMessage, activeConversation, unreadCounts } = useChatStore()
  const { setUserStatus } = usePresenceStore()
  const { setActiveCall, setLocalStream, activeCall } = useCallStore()
  const settings = useSettingsStore()
  const queryClient = useQueryClient()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const ringRef = useRef<HTMLAudioElement | null>(null)
  const [incomingCall, setIncomingCall] = useState<any>(null)
  const currentUserId = useAuthStore((s) => s.user?.id)

  // Initialize callManager once we have a user
  useEffect(() => {
    if (currentUserId) callManager.init(currentUserId)
  }, [currentUserId])

  // Tab title flash for unread notifications
  useEffect(() => {
    const totalUnread = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0)
    const original = 'TeamVault'
    document.title = totalUnread > 0 ? `(${totalUnread}) ${original}` : original
  }, [unreadCounts])

  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2LkZeYl5OSjoeAeXRxcXR5gIeLkJSXl5eTj4qEfnhzcHBzdXuBh4yRlZeXlZGMh4F7dnJwcXR5f4WKj5OWl5aTj4qFf3l0cXBydnuBh4yRlZeXlZGMh4F7dnJwcXR5f4WKj5OWl5aTkIqFf3l0cXBydnuBh4yRlZeXlZGMh4F7dg==')
    audioRef.current.volume = 0.3
  }, [])

  useEffect(() => {
    const unsubMessage = wsClient.on('chat.message', (payload: any) => {
      const targetId = payload.channel_id || payload.conversation_id
      if (!targetId) return
      addMessage(targetId, payload)
      queryClient.invalidateQueries({ queryKey: ['messages', targetId] })

      if (payload.sender?.id === currentUserId) return
      if (targetId === activeConversation) return

      if (settings.notificationsEnabled) {
        if (settings.soundEnabled) audioRef.current?.play().catch(() => {})
        if (settings.desktopNotifications && Notification.permission === 'granted') {
          new Notification(payload.sender?.display_name || 'New message', { body: payload.content, icon: '/favicon.svg' })
        }
      }
    })

    const unsubMessageUpdated = wsClient.on('chat.message.updated', (payload: any) => {
      const targetId = payload.channel_id || payload.conversation_id
      if (targetId) queryClient.invalidateQueries({ queryKey: ['messages', targetId] })
    })

    const unsubMessageDeleted = wsClient.on('chat.message.deleted', (payload: any) => {
      const targetId = payload.channel_id || payload.conversation_id
      if (targetId) queryClient.invalidateQueries({ queryKey: ['messages', targetId] })
    })

    const unsubTypingStart = wsClient.on('typing.start', (payload: any) => {
      if (payload.user_id === currentUserId) return
      useTypingStore.getState().setTyping(payload.target_id, payload.user_id)
    })

    const unsubTypingStop = wsClient.on('typing.stop', (payload: any) => {
      useTypingStore.getState().clearTyping(payload.target_id, payload.user_id)
    })

    const unsubChannelCreated = wsClient.on('channel.created', () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] })
    })
    const unsubChannelUpdated = wsClient.on('channel.updated', () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] })
    })
    const unsubChannelDeleted = wsClient.on('channel.deleted', () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] })
    })

    const unsubPresence = wsClient.on('presence.changed', (payload: any) => {
      if (payload.user_id && payload.status) setUserStatus(payload.user_id, payload.status)
    })

    const unsubCall = wsClient.on('call.incoming', (payload: any) => {
      if (payload.initiated_by === currentUserId) return
      if (activeCall) return
      setIncomingCall(payload)
      if (settings.callRingtone) {
        ringRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2LkZeYl5OSjoeAeXRxcXR5gIeLkJSXl5eTj4qEfnhzcHBzdXuBh4yRlZeXlZGMh4F7dnJwcXR5f4WKj5OWl5aTj4qFf3l0cXBydnuBh4yRlZeXlZGMh4F7dg==')
        ringRef.current.loop = true
        ringRef.current.play().catch(() => {})
      }
    })

    const unsubCallLeft = wsClient.on('call.left', (payload: any) => {
      const { call_id, user_id } = payload
      // If we're not in a call or it's a different call, ignore
      const currentCall = useCallStore.getState().activeCall
      if (!currentCall || currentCall.id !== call_id) return

      // Remove their remote stream
      useCallStore.getState().removeRemoteStream(user_id)

      // If no one else is in the call, auto-hang up
      const remaining = Object.keys(useCallStore.getState().remoteStreams).length
      if (remaining === 0) {
        // Stop our local streams and end the call
        const { localStream } = useCallStore.getState()
        if (localStream) localStream.getTracks().forEach(t => t.stop())
        callManager.endCall()
        useCallStore.getState().endCall()
        toast('Call ended', 'info')
      }
    })

    // Also dismiss the incoming call modal if the caller cancels
    const unsubCallCancel = wsClient.on('call.left', (payload: any) => {
      setIncomingCall((prev: any) => {
        if (prev && prev.id === payload.call_id && payload.user_id === prev.initiated_by) {
          if (ringRef.current) { ringRef.current.pause(); ringRef.current = null }
          toast('Caller cancelled', 'info')
          return null
        }
        return prev
      })
    })

    return () => { unsubMessage(); unsubMessageUpdated(); unsubMessageDeleted(); unsubTypingStart(); unsubTypingStop(); unsubChannelCreated(); unsubChannelUpdated(); unsubChannelDeleted(); unsubPresence(); unsubCall(); unsubCallLeft(); unsubCallCancel() }
  }, [addMessage, activeConversation, setUserStatus, settings, currentUserId, activeCall, queryClient])

  const stopRingtone = () => {
    if (ringRef.current) { ringRef.current.pause(); ringRef.current = null }
  }

  const handleAcceptCall = async () => {
    if (!incomingCall) return
    stopRingtone()
    try {
      const isVideo = incomingCall.call_type === 'video'
      const stream = await getUserMedia({ audio: true, video: isVideo }).catch(() => getUserMedia({ audio: true }))
      setLocalStream(stream)
      callManager.startCall(incomingCall.id, stream)
      setActiveCall(incomingCall)
      // Joining will trigger call.joined event to others, who will initiate WebRTC offers to us
      await callsApi.join(incomingCall.id)
    } catch {
      toast('Could not access microphone/camera', 'error')
    }
    setIncomingCall(null)
  }

  const handleDeclineCall = async () => {
    if (!incomingCall) return
    stopRingtone()
    try { await callsApi.leave(incomingCall.id) } catch {}
    setIncomingCall(null)
  }

  return (
    <>
      {children}
      {incomingCall && <IncomingCallModal call={incomingCall} onAccept={handleAcceptCall} onDecline={handleDeclineCall} />}
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ConnectionBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/workspace/*"
          element={
            <ProtectedRoute>
              <AppShell>
                <WorkspacePage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/workspace" />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
