import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useNavigate } from 'react-router-dom'
import { LogOut, Settings } from 'lucide-react'
import SettingsModal from '../modals/SettingsModal'

export default function UserPanel() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [showSettings, setShowSettings] = useState(false)

  return (
    <>
      <div className="h-[52px] px-2 bg-bg-tertiary flex items-center gap-2">
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-sm font-bold">
            {user?.display_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-status-online border-[3px] border-bg-tertiary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary truncate leading-tight">{user?.display_name}</div>
          <div className="text-[11px] text-text-muted truncate">Online</div>
        </div>
        <button onClick={() => setShowSettings(true)} className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors" title="Settings">
          <Settings size={16} />
        </button>
        <button onClick={() => { logout(); navigate('/login') }} className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-danger transition-colors" title="Log out">
          <LogOut size={16} />
        </button>
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  )
}
