import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { workspacesApi } from '../api/workspaces'
import Sidebar from '../components/layout/Sidebar'
import ChatView from '../components/chat/ChatView'
import CallOverlay from '../components/call/CallOverlay'
import SearchModal from '../components/modals/SearchModal'
import { useCallStore } from '../stores/callStore'
import { Menu } from 'lucide-react'

export default function WorkspacePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { setWorkspaces, activeWorkspace, activeChannel, activeDm, setActiveWorkspace, setActiveChannel, setChannels } = useWorkspaceStore()
  const { activeCall } = useCallStore()
  const queryClient = useQueryClient()

  const { data: workspacesData, isLoading: wsLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspacesApi.getWorkspaces,
  })

  const { data: channelsData } = useQuery({
    queryKey: ['channels', activeWorkspace?.id],
    queryFn: () => workspacesApi.getChannels(activeWorkspace!.id),
    enabled: !!activeWorkspace,
  })

  const createWsMutation = useMutation({
    mutationFn: (name: string) => workspacesApi.createWorkspace(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
  })

  const createChannelMutation = useMutation({
    mutationFn: () => workspacesApi.createChannel(activeWorkspace!.id, 'general', 'General discussion'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['channels'] }),
  })

  useEffect(() => {
    if (workspacesData) {
      setWorkspaces(workspacesData)
      if (workspacesData.length > 0 && !activeWorkspace) setActiveWorkspace(workspacesData[0])
    }
  }, [workspacesData])

  useEffect(() => {
    if (channelsData) {
      setChannels(channelsData)
      // Auto-select first channel if none active and we're not in a DM
      if (channelsData.length > 0 && !activeChannel && !activeDm) {
        setActiveChannel(channelsData[0])
      }
      // Auto-create default channel if workspace has none
      if (channelsData.length === 0 && activeWorkspace && !createChannelMutation.isPending) {
        createChannelMutation.mutate()
      }
    }
  }, [channelsData, activeWorkspace])

  // Auto-create workspace
  useEffect(() => {
    if (workspacesData && workspacesData.length === 0 && !createWsMutation.isPending) {
      createWsMutation.mutate('My Workspace')
    }
  }, [workspacesData])

  // Close sidebar when active channel/DM changes (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [activeChannel?.id, activeDm?.id])

  // Ctrl+K to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setSidebarOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (wsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-border border-t-brand animate-spin" />
          <p className="text-text-muted text-sm">Loading workspace...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-200 md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar onClose={() => setSidebarOpen(false)} onOpenSearch={() => setSearchOpen(true)} />
      </div>
      <main className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden h-12 px-3 flex items-center bg-bg-primary border-b border-border">
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-text-secondary hover:text-text-primary"><Menu size={20} /></button>
          <span className="ml-2 text-sm font-medium text-text-primary truncate">
            {activeChannel ? `# ${activeChannel.name}` : activeDm ? activeDm.participants[0]?.display_name : 'TeamVault'}
          </span>
        </div>
        <ChatView />
      </main>
      {activeCall && <CallOverlay />}
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </div>
  )
}
