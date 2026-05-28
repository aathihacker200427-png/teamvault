import { createPortal } from 'react-dom'
import { Phone, PhoneOff, Video } from 'lucide-react'

interface IncomingCallProps {
  call: {
    id: string
    call_type: string
    initiated_by: string
    participants: { user_id: string; display_name: string }[]
  }
  onAccept: () => void
  onDecline: () => void
}

export default function IncomingCallModal({ call, onAccept, onDecline }: IncomingCallProps) {
  const caller = call.participants.find(p => p.user_id === call.initiated_by)
  const callerName = caller?.display_name || 'Someone'
  const isVideo = call.call_type === 'video'

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4">
      <div className="bg-bg-secondary rounded-2xl p-6 w-full max-w-sm border border-border shadow-2xl text-center">
        <div className="w-24 h-24 mx-auto rounded-full bg-brand flex items-center justify-center text-white text-3xl font-bold mb-4 animate-pulse">
          {callerName[0]?.toUpperCase()}
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-1">{callerName}</h2>
        <p className="text-sm text-text-muted mb-6">Incoming {isVideo ? 'video' : 'voice'} call...</p>

        <div className="flex justify-center gap-6">
          <button onClick={onDecline} title="Decline"
            className="w-14 h-14 rounded-full bg-danger hover:bg-danger/80 text-white flex items-center justify-center transition-colors">
            <PhoneOff size={24} />
          </button>
          <button onClick={onAccept} title="Accept"
            className="w-14 h-14 rounded-full bg-success hover:bg-success/80 text-white flex items-center justify-center transition-colors animate-pulse">
            {isVideo ? <Video size={24} /> : <Phone size={24} />}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
