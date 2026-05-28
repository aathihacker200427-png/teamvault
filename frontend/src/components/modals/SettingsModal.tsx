import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '../../stores/authStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { apiClient } from '../../api/client'
import { toast } from '../Toaster'
import { X, User, Bell, Palette } from 'lucide-react'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={`w-10 h-5 rounded-full relative transition-colors ${checked ? 'bg-brand' : 'bg-bg-active'}`}>
      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${checked ? 'right-0.5' : 'left-0.5'}`} />
    </button>
  )
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { user, updateUser } = useAuthStore()
  const settings = useSettingsStore()
  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [statusMessage, setStatusMessage] = useState(user?.status_message || '')
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'profile' | 'notifications' | 'appearance'>('profile')

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await apiClient.patch('/users/me', { display_name: displayName, status_message: statusMessage })
      updateUser(res.data)
      toast('Profile updated', 'success')
      onClose()
    } catch {
      toast('Failed to update profile', 'error')
    } finally { setSaving(false) }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl h-[85vh] max-h-[600px] bg-bg-secondary rounded-xl shadow-2xl border border-border flex overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="w-44 bg-bg-tertiary p-3 flex flex-col gap-1 shrink-0">
          <h3 className="text-xs font-bold text-text-muted uppercase px-2 mb-2">Settings</h3>
          {[
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'appearance', label: 'Appearance', icon: Palette },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm text-left transition-colors ${
                tab === id ? 'bg-bg-active text-text-primary' : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'
              }`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-lg font-bold text-text-primary capitalize">{tab}</h2>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-bg-hover text-text-muted"><X size={18} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {tab === 'profile' && (
              <div className="space-y-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-brand flex items-center justify-center text-white text-2xl font-bold">
                    {displayName[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-text-primary font-medium truncate">{user?.email}</p>
                    <p className="text-sm text-text-muted">Status: <span className="text-status-online">Online</span></p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5">Display Name</label>
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-bg-tertiary border border-border rounded-md text-text-primary focus:outline-none focus:border-brand text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5">Status Message</label>
                  <input value={statusMessage} onChange={(e) => setStatusMessage(e.target.value)} placeholder="What are you up to?"
                    className="w-full px-3 py-2.5 bg-bg-tertiary border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand text-sm" />
                </div>
                <button onClick={handleSave} disabled={saving}
                  className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}

            {tab === 'notifications' && (
              <div className="space-y-1">
                {[
                  { label: 'Enable notifications', desc: 'Get notified about new messages', value: settings.notificationsEnabled, set: settings.setNotifications },
                  { label: 'Sound effects', desc: 'Play sound when receiving messages', value: settings.soundEnabled, set: settings.setSound },
                  { label: 'Desktop notifications', desc: 'Show browser notifications', value: settings.desktopNotifications, set: (v: boolean) => {
                    settings.setDesktop(v)
                    if (v && Notification.permission !== 'granted') Notification.requestPermission()
                  }},
                  { label: 'Call ringtone', desc: 'Play sound for incoming calls', value: settings.callRingtone, set: settings.setRingtone },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm text-text-primary font-medium">{item.label}</p>
                      <p className="text-xs text-text-muted mt-0.5">{item.desc}</p>
                    </div>
                    <Toggle checked={item.value} onChange={item.set} />
                  </div>
                ))}
              </div>
            )}

            {tab === 'appearance' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Theme</label>
                  <div className="flex gap-3">
                    <button onClick={() => settings.setTheme('dark')}
                      className={`w-24 h-16 rounded-lg bg-[#313338] border-2 flex items-center justify-center text-xs text-white font-medium transition-colors ${settings.theme === 'dark' ? 'border-brand' : 'border-border hover:border-border-light'}`}>
                      Dark {settings.theme === 'dark' && '✓'}
                    </button>
                    <button onClick={() => settings.setTheme('light')}
                      className={`w-24 h-16 rounded-lg bg-white border-2 flex items-center justify-center text-xs text-gray-800 font-medium transition-colors ${settings.theme === 'light' ? 'border-brand' : 'border-border hover:border-border-light'}`}>
                      Light {settings.theme === 'light' && '✓'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Font Size</label>
                  <div className="flex gap-2">
                    {(['small', 'medium', 'large'] as const).map(size => (
                      <button key={size} onClick={() => settings.setFontSize(size)}
                        className={`px-4 py-2 rounded border text-sm font-medium transition-colors capitalize ${
                          settings.fontSize === size ? 'border-brand bg-brand/10 text-brand' : 'border-border text-text-muted hover:border-border-light'
                        }`}>
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-text-muted">
                    TeamVault by{' '}
                    <a href="https://strucureo.com" target="_blank" rel="noreferrer" className="text-brand hover:underline font-medium">
                      Strucureo
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
