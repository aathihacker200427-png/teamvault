import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { workspacesApi } from '../../api/workspaces'
import { X, Hash, Lock } from 'lucide-react'

export default function CreateChannelModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const { activeWorkspace } = useWorkspaceStore()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => workspacesApi.createChannel(activeWorkspace!.id, name, topic || undefined, isPrivate),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['channels'] }); onClose() },
  })

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="w-full max-w-md bg-bg-secondary rounded-lg shadow-2xl border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-lg font-bold text-text-primary">Create Channel</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-hover text-text-muted"><X size={18} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) mutation.mutate() }} className="p-4 space-y-4">
          {/* Channel type */}
          <div className="flex gap-2">
            <button type="button" onClick={() => setIsPrivate(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${!isPrivate ? 'border-brand bg-brand/10 text-brand' : 'border-border text-text-muted hover:border-border-light'}`}>
              <Hash size={16} /> Public
            </button>
            <button type="button" onClick={() => setIsPrivate(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${isPrivate ? 'border-brand bg-brand/10 text-brand' : 'border-border text-text-muted hover:border-border-light'}`}>
              <Lock size={16} /> Private
            </button>
          </div>
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5">Channel Name</label>
            <input value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
              placeholder="new-channel" className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand text-sm" />
          </div>
          {/* Topic */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5">Topic <span className="font-normal text-text-muted">(optional)</span></label>
            <input value={topic} onChange={(e) => setTopic(e.target.value)}
              placeholder="What's this channel about?" className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors">Cancel</button>
            <button type="submit" disabled={!name.trim() || mutation.isPending}
              className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50">
              {mutation.isPending ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
