import { useConnectionStatus } from '../ws/client'
import { Wifi, WifiOff } from 'lucide-react'

export default function ConnectionBanner() {
  const status = useConnectionStatus()
  if (status === 'connected') return null

  const isReconnecting = status === 'connecting'
  return (
    <div className={`fixed top-0 left-0 right-0 z-[150] px-4 py-1.5 text-center text-xs font-medium text-white shadow-lg ${isReconnecting ? 'bg-warning' : 'bg-danger'}`}>
      <div className="flex items-center justify-center gap-2">
        {isReconnecting ? <Wifi size={12} className="animate-pulse" /> : <WifiOff size={12} />}
        <span>{isReconnecting ? 'Reconnecting...' : 'Connection lost. Trying to reconnect...'}</span>
      </div>
    </div>
  )
}
