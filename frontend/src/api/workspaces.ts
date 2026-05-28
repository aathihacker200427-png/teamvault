import { apiClient } from './client'

interface Workspace { id: string; name: string; slug: string; icon_url?: string; owner_id: string; created_at: string }
interface Channel { id: string; workspace_id: string; name: string; topic?: string; is_private: boolean; created_at: string }
interface WorkspaceMember { user_id: string; display_name: string; avatar_url?: string; status: string; role: string }

export const workspacesApi = {
  getWorkspaces: async () => (await apiClient.get<Workspace[]>('/workspaces')).data,
  createWorkspace: async (name: string) => (await apiClient.post<Workspace>('/workspaces', { name })).data,
  getChannels: async (workspaceId: string) => (await apiClient.get<Channel[]>(`/workspaces/${workspaceId}/channels`)).data,
  createChannel: async (workspaceId: string, name: string, topic?: string, isPrivate: boolean = false) =>
    (await apiClient.post<Channel>(`/workspaces/${workspaceId}/channels`, { name, topic, is_private: isPrivate })).data,
  getMembers: async (workspaceId: string) => (await apiClient.get<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`)).data,
  addMember: async (workspaceId: string, userId: string) => (await apiClient.post(`/workspaces/${workspaceId}/members`, { user_id: userId })).data,
}

export const channelsApi = {
  update: async (channelId: string, data: { name?: string; topic?: string }) =>
    (await apiClient.patch<Channel>(`/channels/${channelId}`, data)).data,
  delete: async (channelId: string) => { await apiClient.delete(`/channels/${channelId}`) },
}
