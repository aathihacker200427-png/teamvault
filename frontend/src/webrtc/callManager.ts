import { wsClient } from '../ws/client'
import { useCallStore } from '../stores/callStore'

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

const log = (...args: any[]) => console.log('[CallManager]', ...args)

class CallManager {
  private peers: Map<string, RTCPeerConnection> = new Map()
  private localStream: MediaStream | null = null
  private screenStream: MediaStream | null = null
  private currentCallId: string | null = null
  private currentUserId: string | null = null
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map()
  private wsHandlersRegistered = false

  init(currentUserId: string) {
    this.currentUserId = currentUserId
    if (this.wsHandlersRegistered) return
    this.wsHandlersRegistered = true
    log('Initialized for user', currentUserId)

    wsClient.on('signal.offer', async (payload: any) => {
      const { from_user_id, call_id, data } = payload
      log('← signal.offer from', from_user_id, 'for call', call_id)
      if (call_id !== this.currentCallId) {
        log('  ignoring (call_id mismatch:', this.currentCallId, ')')
        return
      }
      try {
        const peer = this.getOrCreatePeer(from_user_id)
        await peer.setRemoteDescription(new RTCSessionDescription(data))
        const pending = this.pendingCandidates.get(from_user_id) || []
        for (const c of pending) await peer.addIceCandidate(c).catch(() => {})
        this.pendingCandidates.delete(from_user_id)
        const answer = await peer.createAnswer()
        await peer.setLocalDescription(answer)
        this.send(from_user_id, 'signal.answer', { sdp: answer.sdp, type: answer.type })
        log('→ signal.answer sent to', from_user_id)
      } catch (err) {
        log('Error handling offer:', err)
      }
    })

    wsClient.on('signal.answer', async (payload: any) => {
      const { from_user_id, call_id, data } = payload
      log('← signal.answer from', from_user_id, 'for call', call_id)
      if (call_id !== this.currentCallId) return
      const peer = this.peers.get(from_user_id)
      if (!peer) { log('  no peer for', from_user_id); return }
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(data))
        const pending = this.pendingCandidates.get(from_user_id) || []
        for (const c of pending) await peer.addIceCandidate(c).catch(() => {})
        this.pendingCandidates.delete(from_user_id)
      } catch (err) {
        log('Error handling answer:', err)
      }
    })

    wsClient.on('signal.ice_candidate', async (payload: any) => {
      const { from_user_id, call_id, data } = payload
      if (call_id !== this.currentCallId) return
      const peer = this.peers.get(from_user_id)
      if (!peer || !peer.remoteDescription) {
        const list = this.pendingCandidates.get(from_user_id) || []
        list.push(data)
        this.pendingCandidates.set(from_user_id, list)
        return
      }
      try {
        await peer.addIceCandidate(data)
      } catch (err) {
        log('Error adding ICE:', err)
      }
    })

    wsClient.on('call.joined', async (payload: any) => {
      const { call_id, user_id } = payload
      log('← call.joined: user', user_id, 'joined call', call_id)
      if (call_id !== this.currentCallId) {
        log('  ignoring (current call:', this.currentCallId, ')')
        return
      }
      if (user_id === this.currentUserId) return
      log('  → initiating offer to', user_id)
      await this.callPeer(user_id)
    })

    wsClient.on('call.left', (payload: any) => {
      const { user_id } = payload
      log('← call.left: user', user_id, 'left')
      this.closePeer(user_id)
    })
  }

  startCall(callId: string, localStream: MediaStream) {
    log('startCall: callId=', callId, 'tracks=', localStream.getTracks().map(t => t.kind))
    this.currentCallId = callId
    this.localStream = localStream
  }

  /**
   * Toggle screen sharing during an active call.
   * Replaces the video track in all existing peer connections.
   */
  async toggleScreenShare(): Promise<MediaStream | null> {
    if (this.screenStream) {
      // Stop screen sharing, restore camera
      this.screenStream.getTracks().forEach(t => t.stop())
      this.screenStream = null

      // Restore camera video track if we have one
      const cameraTrack = this.localStream?.getVideoTracks()[0]
      if (cameraTrack) {
        for (const peer of this.peers.values()) {
          const sender = peer.getSenders().find(s => s.track?.kind === 'video')
          if (sender) await sender.replaceTrack(cameraTrack).catch(() => {})
        }
      }
      log('Screen share stopped, camera restored')
      return null
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        this.screenStream = stream
        const screenTrack = stream.getVideoTracks()[0]
        if (!screenTrack) return null

        // Replace video track in all peers
        for (const peer of this.peers.values()) {
          const sender = peer.getSenders().find(s => s.track?.kind === 'video')
          if (sender) {
            await sender.replaceTrack(screenTrack).catch(() => {})
          } else if (this.localStream) {
            // No video sender exists (audio-only call), add the screen track
            peer.addTrack(screenTrack, this.localStream)
          }
        }

        // Stop sharing if user clicks browser's "Stop sharing"
        screenTrack.onended = () => { this.toggleScreenShare() }

        log('Screen share started')
        return stream
      } catch (err) {
        log('Screen share failed:', err)
        this.screenStream = null
        return null
      }
    }
  }

  isScreenSharing(): boolean {
    return this.screenStream !== null
  }

  async callPeer(targetUserId: string) {
    log('callPeer:', targetUserId)
    try {
      const peer = this.getOrCreatePeer(targetUserId)
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      this.send(targetUserId, 'signal.offer', { sdp: offer.sdp, type: offer.type })
      log('→ signal.offer sent to', targetUserId)
    } catch (err) {
      log('callPeer error:', err)
    }
  }

  endCall() {
    log('endCall: closing', this.peers.size, 'peers')
    for (const peer of this.peers.values()) peer.close()
    this.peers.clear()
    this.pendingCandidates.clear()
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop())
      this.screenStream = null
    }
    this.currentCallId = null
    this.localStream = null
  }

  private getOrCreatePeer(userId: string): RTCPeerConnection {
    let peer = this.peers.get(userId)
    if (peer) return peer
    log('creating peer for', userId)

    peer = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    })

    if (this.localStream) {
      const tracks = this.localStream.getTracks()
      log('  adding', tracks.length, 'local tracks')
      tracks.forEach(track => {
        const sender = peer!.addTrack(track, this.localStream!)
        // Set degraded video quality for low latency
        if (track.kind === 'video') {
          const params = sender.getParameters()
          if (!params.encodings) params.encodings = [{}]
          params.encodings[0].maxBitrate = 1_500_000 // 1.5 Mbps
          params.encodings[0].maxFramerate = 30
          sender.setParameters(params).catch(() => {})
        }
      })
    } else {
      log('  WARNING: no localStream when creating peer')
    }

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        this.send(userId, 'signal.ice_candidate', e.candidate.toJSON())
      }
    }

    peer.ontrack = (e) => {
      log('ontrack from', userId, 'kind=', e.track.kind, 'streams=', e.streams.length)
      const stream = e.streams[0]
      if (stream) {
        useCallStore.getState().addRemoteStream(userId, stream)
      }
    }

    peer.onconnectionstatechange = () => {
      log('peer', userId, 'state:', peer!.connectionState)
      if (peer!.connectionState === 'failed' || peer!.connectionState === 'closed') {
        this.closePeer(userId)
      }
    }

    peer.oniceconnectionstatechange = () => {
      log('peer', userId, 'ICE state:', peer!.iceConnectionState)
    }

    this.peers.set(userId, peer)
    return peer
  }

  private closePeer(userId: string) {
    const peer = this.peers.get(userId)
    if (peer) {
      peer.close()
      this.peers.delete(userId)
    }
    this.pendingCandidates.delete(userId)
    useCallStore.getState().removeRemoteStream(userId)
  }

  private send(targetUserId: string, type: string, data: any) {
    wsClient.send({
      type,
      payload: {
        target_user_id: targetUserId,
        call_id: this.currentCallId,
        data,
      },
    })
  }
}

export const callManager = new CallManager()
