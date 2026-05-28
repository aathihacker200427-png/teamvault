import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/authStore'

const WS_URL = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/ws`

interface WsMessage {
  type: string
  payload: any
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

class WebSocketClient {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private heartbeatInterval: number | null = null
  private messageHandlers: Map<string, Set<(payload: any) => void>> = new Map()
  private statusHandlers: Set<(status: ConnectionStatus) => void> = new Set()
  private currentStatus: ConnectionStatus = 'disconnected'

  connect(token: string) {
    if (this.ws?.readyState === WebSocket.OPEN) return
    this.setStatus('connecting')
    this.ws = new WebSocket(`${WS_URL}?token=${token}`)

    this.ws.onopen = () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
      this.setStatus('connected')
      this.startHeartbeat()
    }

    this.ws.onmessage = (event) => {
      try {
        const message: WsMessage = JSON.parse(event.data)
        this.handleMessage(message)
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }

    this.ws.onclose = () => {
      console.log('WebSocket disconnected')
      this.setStatus('disconnected')
      this.stopHeartbeat()
      this.attemptReconnect(token)
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }

  disconnect() {
    this.stopHeartbeat()
    this.ws?.close()
    this.ws = null
    this.setStatus('disconnected')
  }

  send(message: WsMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
      if (message.type.startsWith('signal.') || message.type.startsWith('call.')) {
        console.log('[WS] →', message.type, message.payload)
      }
    } else {
      console.warn('[WS] cannot send (state:', this.ws?.readyState, ')', message.type)
    }
  }

  on(type: string, handler: (payload: any) => void) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set())
    }
    this.messageHandlers.get(type)!.add(handler)
    return () => { this.messageHandlers.get(type)?.delete(handler) }
  }

  onStatus(handler: (status: ConnectionStatus) => void) {
    this.statusHandlers.add(handler)
    handler(this.currentStatus)
    return () => { this.statusHandlers.delete(handler) }
  }

  private setStatus(status: ConnectionStatus) {
    this.currentStatus = status
    this.statusHandlers.forEach(h => h(status))
  }

  private handleMessage(message: WsMessage) {
    if (message.type.startsWith('signal.') || message.type.startsWith('call.')) {
      console.log('[WS] ←', message.type, message.payload)
    }
    const handlers = this.messageHandlers.get(message.type)
    handlers?.forEach((handler) => handler(message.payload))
  }

  private startHeartbeat() {
    this.heartbeatInterval = window.setInterval(() => {
      this.send({ type: 'ping', payload: { timestamp: Date.now() } })
    }, 30000)
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private attemptReconnect(token: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }
    this.reconnectAttempts++
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000)
    setTimeout(() => {
      console.log(`Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
      this.connect(token)
    }, delay)
  }
}

export const wsClient = new WebSocketClient()

export function useWebSocket() {
  const accessToken = useAuthStore((state) => state.accessToken)

  useEffect(() => {
    if (accessToken) wsClient.connect(accessToken)
    return () => { wsClient.disconnect() }
  }, [accessToken])

  return wsClient
}

export function useConnectionStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  useEffect(() => wsClient.onStatus(setStatus), [])
  return status
}
