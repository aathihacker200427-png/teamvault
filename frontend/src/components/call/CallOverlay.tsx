import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCallStore } from '../../stores/callStore'
import { useAuthStore } from '../../stores/authStore'
import { stopStream, toggleAudio, toggleVideo } from '../../webrtc/mediaManager'
import { callsApi } from '../../api/calls'
import { callManager } from '../../webrtc/callManager'
import { usersApi } from '../../api/users'
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Maximize2, Minimize2, User as UserIcon, Pin, PinOff } from 'lucide-react'

function VideoTile({ stream, name, muted = false, isLocal = false, isAudioOnly = false, onClick, focused }: {
  stream: MediaStream | null
  name: string
  muted?: boolean
  isLocal?: boolean
  isAudioOnly?: boolean
  onClick?: () => void
  focused?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [needsClick, setNeedsClick] = useState(false)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play()
        .then(() => setNeedsClick(false))
        .catch(err => {
          console.warn('[VideoTile] autoplay blocked:', err)
          if (!isLocal) setNeedsClick(true)
        })
    }
  }, [stream, isLocal])

  const colors = ['#5865f2', '#23a55a', '#f0b232', '#eb459e', '#f23f43']
  const color = colors[name.charCodeAt(0) % colors.length]
  const hasVideo = stream && stream.getVideoTracks().some(t => t.enabled && !t.muted) && !isAudioOnly

  const handleClick = () => {
    if (needsClick && videoRef.current) {
      videoRef.current.play().then(() => setNeedsClick(false)).catch(() => {})
    } else {
      onClick?.()
    }
  }

  return (
    <div onClick={handleClick}
      className={`relative bg-bg-tertiary rounded-lg overflow-hidden flex items-center justify-center cursor-pointer transition-all ${focused ? 'ring-2 ring-brand' : 'hover:ring-1 hover:ring-border-light'}`}>
      <video ref={videoRef} autoPlay playsInline muted={isLocal}
        className={`w-full h-full object-contain bg-black ${hasVideo ? '' : 'hidden'}`} />
      {!hasVideo && (
        <div className="flex flex-col items-center gap-2 py-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold" style={{ backgroundColor: color }}>
            {name[0]?.toUpperCase()}
          </div>
        </div>
      )}
      {needsClick && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur z-10">
          <div className="text-center text-white">
            <div className="text-2xl mb-2">🔊</div>
            <p className="text-sm font-medium">Click to enable audio</p>
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 pointer-events-none">
        <div className="bg-black/60 backdrop-blur px-2 py-1 rounded text-xs text-white font-medium flex items-center gap-1.5 max-w-full">
          {muted && <MicOff size={11} className="text-danger shrink-0" />}
          <span className="truncate">{name}{isLocal && ' (you)'}</span>
        </div>
      </div>
      {focused && (
        <div className="absolute top-2 right-2">
          <Pin size={14} className="text-brand drop-shadow-lg fill-brand" />
        </div>
      )}
    </div>
  )
}

export default function CallOverlay() {
  const { activeCall, localStream, remoteStreams, endCall } = useCallStore()
  const user = useAuthStore((s) => s.user)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [duration, setDuration] = useState(0)
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({})
  const [focusedId, setFocusedId] = useState<string | null>(null)

  useEffect(() => {
    const interval = setInterval(() => setDuration(d => d + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // Fetch real names for remote participants
  useEffect(() => {
    // Seed names from call participants list (provided by backend)
    if (activeCall?.participants) {
      const seeded: Record<string, string> = {}
      for (const p of activeCall.participants) {
        if (p.user_id !== user?.id) seeded[p.user_id] = p.display_name
      }
      if (Object.keys(seeded).length > 0) setParticipantNames(prev => ({ ...seeded, ...prev }))
    }

    // Fallback: fetch missing names
    Object.keys(remoteStreams).forEach(async (userId) => {
      if (!participantNames[userId]) {
        const u = await usersApi.get(userId)
        if (u) setParticipantNames(prev => ({ ...prev, [userId]: u.display_name }))
      }
    })
  }, [remoteStreams, activeCall])

  // Auto-focus on the only remote when call connects
  useEffect(() => {
    const ids = Object.keys(remoteStreams)
    if (ids.length === 1 && !focusedId) setFocusedId(ids[0])
    if (ids.length === 0) setFocusedId(null)
  }, [remoteStreams, focusedId])

  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  const handleEndCall = async () => {
    stopStream(localStream)
    callManager.endCall()
    if (activeCall) try { await callsApi.leave(activeCall.id) } catch {}
    endCall()
  }

  const handleToggleAudio = () => {
    if (localStream) { toggleAudio(localStream, !audioEnabled); setAudioEnabled(!audioEnabled) }
  }

  const handleToggleVideo = () => {
    if (localStream) { toggleVideo(localStream, !videoEnabled); setVideoEnabled(!videoEnabled) }
  }

  const handleScreenShare = async () => {
    const result = await callManager.toggleScreenShare()
    setIsScreenSharing(!!result)
  }

  if (!activeCall) return null

  const isAudioOnly = activeCall.call_type === 'audio'
  const remoteEntries = Object.entries(remoteStreams)
  const totalParticipants = 1 + remoteEntries.length
  const isRinging = remoteEntries.length === 0

  const overlayClass = isFullscreen
    ? 'fixed inset-0 rounded-none z-[200]'
    : 'fixed bottom-4 right-4 w-[min(95vw,560px)] h-[min(85vh,500px)] rounded-xl z-[200]'

  // Determine layout
  const allTiles: Array<{ id: string; stream: MediaStream | null; name: string; muted: boolean; isLocal: boolean }> = [
    { id: 'self', stream: localStream, name: user?.display_name || 'You', muted: !audioEnabled, isLocal: true },
    ...remoteEntries.map(([id, stream]) => ({ id, stream, name: participantNames[id] || 'Connecting...', muted: false, isLocal: false })),
  ]

  const focusedTile = focusedId ? allTiles.find(t => t.id === focusedId) : null
  const otherTiles = focusedId ? allTiles.filter(t => t.id !== focusedId) : allTiles

  return createPortal(
    <div className={`${overlayClass} bg-bg-tertiary border border-border shadow-2xl flex flex-col overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-secondary shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse shrink-0" />
          <span className="text-sm font-medium text-text-primary truncate">
            {isRinging ? 'Calling...' : isScreenSharing ? 'Screen Sharing' : activeCall.call_type === 'video' ? 'Video Call' : 'Voice Call'}
          </span>
          {!isRinging && <span className="text-xs text-text-muted ml-2 shrink-0">{fmtDuration(duration)}</span>}
        </div>
        <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 rounded hover:bg-bg-hover text-text-muted">
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {/* Video area */}
      <div className="flex-1 p-2 overflow-hidden bg-black/30 relative">
        {isRinging ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-text-muted">
            <div className="w-24 h-24 rounded-full bg-brand flex items-center justify-center text-white text-3xl font-bold animate-pulse">
              {user?.display_name?.[0]?.toUpperCase() || '?'}
            </div>
            <p className="text-text-primary font-medium">Calling...</p>
            <p className="text-xs">Waiting for someone to join</p>
          </div>
        ) : focusedTile ? (
          // Spotlight layout: one big, others small
          <div className="h-full flex flex-col gap-2">
            <div className="flex-1 min-h-0 relative">
              <VideoTile
                stream={focusedTile.stream}
                name={focusedTile.name}
                muted={focusedTile.muted}
                isLocal={focusedTile.isLocal}
                isAudioOnly={isAudioOnly}
                focused
                onClick={() => setFocusedId(null)}
              />
              <button onClick={() => setFocusedId(null)} title="Unpin (show grid)"
                className="absolute top-2 left-2 p-1.5 rounded bg-black/60 hover:bg-black/80 text-white">
                <PinOff size={14} />
              </button>
            </div>
            {otherTiles.length > 0 && (
              <div className="flex gap-2 h-24 shrink-0 overflow-x-auto">
                {otherTiles.map(tile => (
                  <div key={tile.id} className="w-32 shrink-0">
                    <VideoTile
                      stream={tile.stream}
                      name={tile.name}
                      muted={tile.muted}
                      isLocal={tile.isLocal}
                      isAudioOnly={isAudioOnly}
                      onClick={() => setFocusedId(tile.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Grid layout
          <div className={`grid gap-2 h-full ${totalParticipants === 1 ? 'grid-cols-1' : totalParticipants === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2'}`}>
            {allTiles.map(tile => (
              <VideoTile
                key={tile.id}
                stream={tile.stream}
                name={tile.name}
                muted={tile.muted}
                isLocal={tile.isLocal}
                isAudioOnly={isAudioOnly}
                onClick={() => setFocusedId(tile.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 px-4 py-3 bg-bg-secondary shrink-0">
        <button onClick={handleToggleAudio} title={audioEnabled ? 'Mute' : 'Unmute'}
          className={`p-3 rounded-full transition-colors ${audioEnabled ? 'bg-bg-hover text-text-primary hover:bg-bg-active' : 'bg-danger text-white'}`}>
          {audioEnabled ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
        {!isAudioOnly && (
          <button onClick={handleToggleVideo} title={videoEnabled ? 'Stop Video' : 'Start Video'}
            className={`p-3 rounded-full transition-colors ${videoEnabled ? 'bg-bg-hover text-text-primary hover:bg-bg-active' : 'bg-danger text-white'}`}>
            {videoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
          </button>
        )}
        <button onClick={handleScreenShare} title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
          className={`p-3 rounded-full transition-colors ${isScreenSharing ? 'bg-brand text-white' : 'bg-bg-hover text-text-primary hover:bg-bg-active'}`}>
          <MonitorUp size={18} />
        </button>
        <div className="flex items-center gap-1 px-2 text-xs text-text-muted">
          <UserIcon size={12} />
          <span>{totalParticipants}</span>
        </div>
        <button onClick={handleEndCall} title={isRinging ? 'Cancel' : 'End Call'}
          className="p-3 rounded-full bg-danger text-white hover:bg-danger/80 transition-colors ml-1">
          <PhoneOff size={18} />
        </button>
      </div>
    </div>,
    document.body
  )
}
