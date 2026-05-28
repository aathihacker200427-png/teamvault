import { useQuery } from '@tanstack/react-query'
import { dmApi } from '../../api/directMessages'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { usePresenceStore } from '../../stores/presenceStore'
import { useChatStore } from '../../stores/chatStore'
import { Plus, UserPlus } from 'lucide-react'

interface Props { onNewDm: () => void }

export default function DMList({ onNewDm }: Props) {
  const { data: conversations } = useQuery({ queryKey: ['dm-conversations'], queryFn: dmApi.getConversations })
  const { activeDm, setActiveDm } = useWorkspaceStore()
  const { statuses } = usePresenceStore()
  const { unreadCounts } = useChatStore()

  return (
    <div className="px-2 py-2">
      <div className="flex items-center justify-between px-2 mb-1 group">
        <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Direct Messages</h3>
        <button onClick={onNewDm} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-all" title="New DM">
          <Plus size={14} />
        </button>
      </div>
      {(!conversations || conversations.length === 0) ? (
        <button onClick={onNewDm} className="w-full px-3 py-3 rounded text-sm text-text-muted hover:bg-bg-hover hover:text-text-secondary text-left transition-colors flex items-center gap-2">
          <UserPlus size={16} className="shrink-0" />
          <span>Start a conversation</span>
        </button>
      ) : (
        <div className="space-y-px">
          {conversations.map((conv) => {
            const otherUser = conv.participants[0]
            const name = conv.is_group
              ? conv.participants.map((p) => p.display_name).join(', ')
              : otherUser?.display_name || 'Unknown'
            const isActive = activeDm?.id === conv.id
            const isOnline = otherUser ? statuses[otherUser.user_id] === 'online' : false
            const unread = unreadCounts[conv.id] || 0
            return (
              <button key={conv.id} onClick={() => setActiveDm(conv)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[15px] transition-colors ${isActive ? 'bg-bg-active text-text-primary font-medium' : unread > 0 ? 'text-text-primary font-medium' : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'}`}>
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center text-brand text-xs font-bold">
                    {name[0]?.toUpperCase()}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-bg-secondary ${isOnline ? 'bg-status-online' : 'bg-status-offline'}`} />
                </div>
                <span className="truncate flex-1">{name}</span>
                {unread > 0 && !isActive && (
                  <span className="bg-danger text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">{unread > 99 ? '99+' : unread}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
