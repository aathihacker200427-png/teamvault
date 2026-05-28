import { apiClient } from './client'

export const callsApi = {
  initiate: async (target_type: 'channel' | 'dm', target_id: string, call_type: 'audio' | 'video') => {
    const res = await apiClient.post('/calls', { target_type, target_id, call_type, routing_mode: 'p2p' })
    return res.data
  },
  join: async (call_id: string) => {
    const res = await apiClient.post(`/calls/${call_id}/join`)
    return res.data
  },
  leave: async (call_id: string) => {
    await apiClient.post(`/calls/${call_id}/leave`)
  },
}
