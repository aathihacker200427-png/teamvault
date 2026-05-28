import { apiClient } from './client'

export interface Attachment {
  id: string
  url: string
  filename: string
  content_type: string
  size: number
}

interface Message {
  id: string
  channel_id?: string
  conversation_id?: string
  sender: { id: string; display_name: string; avatar_url?: string; status: string }
  content: string
  reply_to?: { id: string; sender_name: string; content: string }
  attachments: Attachment[]
  edited_at?: string
  created_at: string
}

interface AttachmentInput { url: string; filename: string; content_type: string; size: number }

export const messagesApi = {
  getChannelMessages: async (channelId: string, cursor?: string, limit: number = 50) => {
    const params = new URLSearchParams()
    if (cursor) params.append('cursor', cursor)
    params.append('limit', limit.toString())
    const res = await apiClient.get<Message[]>(`/channels/${channelId}/messages?${params}`)
    return res.data
  },
  sendMessage: async (channelId: string, content: string, replyTo?: string, attachments?: AttachmentInput[]) => {
    const res = await apiClient.post<Message>(`/channels/${channelId}/messages`, { content, reply_to: replyTo, attachments })
    return res.data
  },
  getDmMessages: async (conversationId: string, cursor?: string, limit: number = 50) => {
    const params = new URLSearchParams()
    if (cursor) params.append('cursor', cursor)
    params.append('limit', limit.toString())
    const res = await apiClient.get<Message[]>(`/dm/${conversationId}/messages?${params}`)
    return res.data
  },
  sendDmMessage: async (conversationId: string, content: string, replyTo?: string, attachments?: AttachmentInput[]) => {
    const res = await apiClient.post<Message>(`/dm/${conversationId}/messages`, { content, reply_to: replyTo, attachments })
    return res.data
  },
  edit: async (messageId: string, content: string) => {
    const res = await apiClient.patch<Message>(`/messages/${messageId}`, { content })
    return res.data
  },
  delete: async (messageId: string) => {
    await apiClient.delete(`/messages/${messageId}`)
  },
}
