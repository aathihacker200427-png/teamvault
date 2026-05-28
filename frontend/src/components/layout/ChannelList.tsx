import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useChatStore } from '../../stores/chatStore'
import { Hash, Lock, Plus } from 'lucide-react'

interface Props { onCreateChannel: () => void }

export default function ChannelList({ onCreateChannel }: Props) {
  const { channels, activeChannel, setActiveChannel } = useWorkspaceStore()
  const { unreadCounts } = useChatStore()

  return (
    <div className="px-2 py-2">
      <div className="flex items-center justify-between px-2 mb-1 group">
        <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Channels</h3>
        <button onClick={onCreateChannel} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-all" title="Create Channel">
          <Plus size={14} />
        </button>
      </div>
      {channels.length === 0 ? (
        <button onClick={onCreateChannel} className="w-full px-3 py-3 rounded text-sm text-text-muted hover:bg-bg-hover hover:text-text-secondary text-left transition-colors flex items-center gap-2">
          <Plus size={16} className="shrink-0" />
          <span>Create your first channel</span>
        </button>
      ) : (
        <div className="space-y-px">
          {channels.map((ch) => {
            const unread = unreadCounts[ch.id] || 0
            const isActive = activeChannel?.id === ch.id
            return (
              <button key={ch.id} onClick={() => setActiveChannel(ch)}
                className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-left text-[15px] transition-colors ${
                  isActive ? 'bg-bg-active text-text-primary font-medium' : unread > 0 ? 'text-text-primary font-medium' : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'
                }`}>
                {ch.is_private ? <Lock size={16} className="shrink-0 opacity-70" /> : <Hash size={16} className="shrink-0 opacity-70" />}
                <span className="truncate flex-1">{ch.name}</span>
                {unread > 0 && !isActive && (
                  <span className="bg-danger text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">{unread}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
