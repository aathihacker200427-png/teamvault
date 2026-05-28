import { apiClient } from './client'

interface DmConversation {
  id: string
  is_group: boolean
  participants: {
    user_id: string
    display_name: string
    avatar_url?: string
  }[]
  last_message?: any
  created_at: string
}

export const dmApi = {
  getConversations: async () => {
    const response = await apiClient.get<DmConversation[]>('/dm')
    return response.data
  },

  createOrGetDm: async (userId: string) => {
    const response = await apiClient.post<{ conversation_id: string }>('/dm', {
      user_id: userId,
    })
    return response.data
  },

  createGroupDm: async (userIds: string[]) => {
    const response = await apiClient.post<{ conversation_id: string }>(
      '/dm/group',
      { user_ids: userIds }
    )
    return response.data
  },
}
