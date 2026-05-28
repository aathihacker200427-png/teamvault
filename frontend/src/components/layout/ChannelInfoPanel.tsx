import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workspacesApi, channelsApi } from '../../api/workspaces'
import { dmApi } from '../../api/directMessages'
import { apiClient } from '../../api/client'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { usePresenceStore } from '../../stores/presenceStore'
import { toast } from '../Toaster'
import { X, Hash, Lock, Users, Settings, Trash2, Edit2, Check, MessageCircle, UserPlus, Search } from 'lucide-react'

interface Props { onClose: () => void }

export default function ChannelInfoPanel({ onClose }: Props) {
  const { activeChannel, activeWorkspace, setActiveChannel, setActiveDm } = useWorkspaceStore()
  const { statuses } = usePresenceStore()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'members' | 'settings'>('members')
  const [editingName, setEditingName] = useState(false)
  const [editingTopic, setEditingTopic] = useState(false)
  const [name, setName] = useState(activeChannel?.name || '')
  const [topic, setTopic] = useState(activeChannel?.topic || '')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])

  const { data: members } = useQuery({
    queryKey: ['workspace-members', activeWorkspace?.id],
    queryFn: () => workspacesApi.getMembers(activeWorkspace!.id),
    enabled: !!activeWorkspace,
  })

  const memberIds = new Set((members || []).map(m => m.user_id))

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; topic?: string }) => channelsApi.update(activeChannel!.id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['channels'] })
      if (activeChannel) setActiveChannel({ ...activeChannel, name: updated.name, topic: updated.topic })
      toast('Channel updated', 'success')
    },
    onError: () => toast('Failed to update channel', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => channelsApi.delete(activeChannel!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] })
      setActiveChannel(null)
      toast('Channel deleted', 'success')
      onClose()
    },
    onError: () => toast('Failed to delete channel', 'error'),
  })

  const addMemberMutation = useMutation({
    mutationFn: (userId: string) => workspacesApi.addMember(activeWorkspace!.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members'] })
      toast('Member added', 'success')
      setSearchQuery('')
      setSearchResults([])
    },
    onError: () => toast('Failed to add member', 'error'),
  })

  const handleSearchUsers = async (q: string) => {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    try {
      const res = await apiClient.get(`/users/search?q=${encodeURIComponent(q)}`)
      setSearchResults((res.data || []).filter((u: any) => !memberIds.has(u.id)))
    } catch { setSearchResults([]) }
  }

  const startDm = async (userId: string, displayName: string) => {
    try {
      const res = await dmApi.createOrGetDm(userId)
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] })
      setActiveDm({ id: res.conversation_id, is_group: false, participants: [{ user_id: userId, display_name: displayName }], created_at: new Date().toISOString() })
      onClose()
    } catch {}
  }

  if (!activeChannel) return null

  return (
    <aside className="absolute top-12 right-0 bottom-0 w-80 bg-bg-secondary border-l border-border flex flex-col z-30 shadow-xl">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {activeChannel.is_private ? <Lock size={16} className="text-text-muted shrink-0" /> : <Hash size={16} className="text-text-muted shrink-0" />}
          <h3 className="text-sm font-bold text-text-primary truncate">{activeChannel.name}</h3>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-bg-hover text-text-muted"><X size={16} /></button>
      </div>

      <div className="flex border-b border-border">
        <button onClick={() => setTab('members')}
          className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${tab === 'members' ? 'border-brand text-text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}>
          <Users size={14} /> Members ({members?.length || 0})
        </button>
        <button onClick={() => setTab('settings')}
          className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${tab === 'settings' ? 'border-brand text-text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}>
          <Settings size={14} /> Settings
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'members' && (
          <div className="p-3 space-y-3">
            <div>
              <div className="flex items-center gap-2 px-2 py-1 bg-bg-tertiary rounded text-sm">
                <Search size={14} className="text-text-muted" />
                <input value={searchQuery} onChange={(e) => handleSearchUsers(e.target.value)} placeholder="Add member..."
                  className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none" />
              </div>
              {searchResults.length > 0 && (
                <div className="mt-1 max-h-40 overflow-y-auto bg-bg-tertiary rounded">
                  {searchResults.map(u => (
                    <button key={u.id} onClick={() => addMemberMutation.mutate(u.id)}
                      className="w-full flex items-center gap-2 px-2 py-2 hover:bg-bg-hover text-left">
                      <div className="w-7 h-7 rounded-full bg-brand/20 flex items-center justify-center text-xs font-bold text-brand">
                        {u.display_name?.[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm text-text-primary flex-1 truncate">{u.display_name}</span>
                      <UserPlus size={14} className="text-brand" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              {members?.map(m => (
                <div key={m.user_id} className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-hover">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center text-xs font-bold text-brand">
                      {m.display_name[0]?.toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg-secondary ${(statuses[m.user_id] === 'online' || m.status === 'online') ? 'bg-status-online' : 'bg-status-offline'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text-primary truncate flex items-center gap-1">
                      {m.display_name}
                      {m.role === 'owner' && <span className="text-2xs text-brand bg-brand/10 px-1 rounded">owner</span>}
                    </div>
                  </div>
                  <button onClick={() => startDm(m.user_id, m.display_name)} title="Send DM"
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-bg-active text-text-muted hover:text-text-primary">
                    <MessageCircle size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="p-4 space-y-5">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Channel Name</label>
              <div className="flex items-center gap-2">
                {editingName ? (
                  <>
                    <input value={name} onChange={(e) => setName(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-bg-tertiary border border-border rounded text-sm text-text-primary focus:outline-none focus:border-brand" />
                    <button onClick={() => { updateMutation.mutate({ name }); setEditingName(false) }}
                      className="p-1.5 bg-brand text-white rounded"><Check size={14} /></button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-text-primary">#{activeChannel.name}</span>
                    <button onClick={() => setEditingName(true)} className="p-1 rounded hover:bg-bg-hover text-text-muted"><Edit2 size={14} /></button>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Topic</label>
              <div className="flex items-center gap-2">
                {editingTopic ? (
                  <>
                    <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Add a topic..."
                      className="flex-1 px-3 py-1.5 bg-bg-tertiary border border-border rounded text-sm text-text-primary focus:outline-none focus:border-brand" />
                    <button onClick={() => { updateMutation.mutate({ topic }); setEditingTopic(false) }}
                      className="p-1.5 bg-brand text-white rounded"><Check size={14} /></button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-text-secondary">{activeChannel.topic || <span className="text-text-muted italic">No topic set</span>}</span>
                    <button onClick={() => setEditingTopic(true)} className="p-1 rounded hover:bg-bg-hover text-text-muted"><Edit2 size={14} /></button>
                  </>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <button onClick={() => { if (confirm(`Delete #${activeChannel.name}? This cannot be undone.`)) deleteMutation.mutate() }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-danger/10 hover:bg-danger/20 text-danger text-sm font-medium rounded transition-colors">
                <Trash2 size={14} /> Delete Channel
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
