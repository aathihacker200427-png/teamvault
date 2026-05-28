import { create } from 'zustand'

interface Workspace { id: string; name: string; slug: string; icon_url?: string; owner_id: string }
interface Channel { id: string; workspace_id: string; name: string; topic?: string; is_private: boolean }
interface DmConversation { id: string; is_group: boolean; participants: { user_id: string; display_name: string; avatar_url?: string }[]; last_message?: any; created_at: string }

interface WorkspaceState {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  channels: Channel[]
  activeChannel: Channel | null
  activeDm: DmConversation | null
  setWorkspaces: (w: Workspace[]) => void
  setActiveWorkspace: (w: Workspace | null) => void
  setChannels: (c: Channel[]) => void
  setActiveChannel: (c: Channel | null) => void
  setActiveDm: (dm: DmConversation | null) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  activeWorkspace: null,
  channels: [],
  activeChannel: null,
  activeDm: null,
  setWorkspaces: (workspaces) => set({ workspaces }),
  setActiveWorkspace: (activeWorkspace) => set({ activeWorkspace }),
  setChannels: (channels) => set({ channels }),
  setActiveChannel: (activeChannel) => set({ activeChannel, activeDm: null }),
  setActiveDm: (activeDm) => set({ activeDm, activeChannel: null }),
}))
