import { useState } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import ChannelList from './ChannelList'
import DMList from './DMList'
import UserPanel from './UserPanel'
import CreateChannelModal from '../modals/CreateChannelModal'
import { Search, X } from 'lucide-react'

interface SidebarProps {
  onClose: () => void
  onOpenSearch: () => void
}

export default function Sidebar({ onClose, onOpenSearch }: SidebarProps) {
  const { activeWorkspace } = useWorkspaceStore()
  const [showCreateChannel, setShowCreateChannel] = useState(false)

  return (
    <>
      <aside className="h-full w-72 bg-bg-secondary flex flex-col">
        <div className="h-12 px-4 flex items-center justify-between border-b border-border shadow-sm">
          <h2 className="font-bold text-text-primary truncate text-[15px]">
            {activeWorkspace?.name || 'TeamVault'}
          </h2>
          <button className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors md:hidden" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="px-3 pt-3">
          <button onClick={onOpenSearch} className="w-full flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary rounded text-sm text-text-muted text-left hover:bg-bg-hover transition-colors">
            <Search size={14} />
            <span className="flex-1">Search...</span>
            <kbd className="hidden sm:inline text-[10px] bg-bg-secondary px-1.5 py-0.5 rounded border border-border">Ctrl K</kbd>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pt-2">
          <ChannelList onCreateChannel={() => setShowCreateChannel(true)} />
          <DMList onNewDm={onOpenSearch} />
        </div>

        <UserPanel />
      </aside>

      {showCreateChannel && <CreateChannelModal onClose={() => setShowCreateChannel(false)} />}
    </>
  )
}
