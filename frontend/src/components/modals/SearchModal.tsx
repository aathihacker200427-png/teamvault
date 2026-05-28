import { useState } from 'react'
import { apiClient } from '../../api/client'
import { dmApi } from '../../api/directMessages'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { Search, X, User, Hash } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

interface SearchResult { id: string; display_name?: string; email?: string; name?: string; type: 'user' | 'channel' }

export default function SearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()
  const { setActiveDm } = useWorkspaceStore()

  const handleSearch = async (q: string) => {
    setQuery(q)
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await apiClient.get(`/users/search?q=${encodeURIComponent(q)}`)
      setResults((res.data || []).map((u: any) => ({ ...u, type: 'user' as const })))
    } catch { setResults([]) }
    finally { setLoading(false) }
  }

  const handleClickUser = async (user: SearchResult) => {
    try {
      const res = await dmApi.createOrGetDm(user.id)
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] })
      // Navigate to the DM
      setActiveDm({
        id: res.conversation_id,
        is_group: false,
        participants: [{ user_id: user.id, display_name: user.display_name || '', avatar_url: undefined }],
        created_at: new Date().toISOString(),
      })
      onClose()
    } catch (e) {
      console.error('Failed to open DM:', e)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/70" onClick={onClose}>
      <div className="w-full max-w-lg bg-bg-secondary rounded-lg shadow-2xl border border-border overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={20} className="text-text-muted shrink-0" />
          <input autoFocus value={query} onChange={(e) => handleSearch(e.target.value)} placeholder="Search users..."
            className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted text-[15px] focus:outline-none" />
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-hover text-text-muted"><X size={18} /></button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading && <div className="px-4 py-8 text-center text-text-muted text-sm">Searching...</div>}
          {!loading && query.length >= 2 && results.length === 0 && <div className="px-4 py-8 text-center text-text-muted text-sm">No results found</div>}
          {!loading && query.length < 2 && <div className="px-4 py-8 text-center text-text-muted text-sm">Type at least 2 characters to search</div>}
          {results.map((r) => (
            <button key={r.id} onClick={() => handleClickUser(r)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-bg-hover text-left transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center">
                {r.type === 'user' ? <User size={16} className="text-brand" /> : <Hash size={16} className="text-brand" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-text-primary truncate">{r.display_name || r.name}</div>
                {r.email && <div className="text-xs text-text-muted truncate">{r.email}</div>}
              </div>
              <span className="text-xs text-brand bg-brand/10 px-2 py-0.5 rounded font-medium">Message</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
