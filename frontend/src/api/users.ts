import { apiClient } from './client'

interface User {
  id: string
  email: string
  display_name: string
  avatar_url?: string
  status: string
  status_message?: string
}

const userCache = new Map<string, User>()

export const usersApi = {
  get: async (userId: string): Promise<User | null> => {
    if (userCache.has(userId)) return userCache.get(userId)!
    try {
      const res = await apiClient.get<User>(`/users/${userId}`)
      userCache.set(userId, res.data)
      return res.data
    } catch {
      return null
    }
  },
  search: async (query: string): Promise<User[]> => {
    const res = await apiClient.get<User[]>(`/users/search?q=${encodeURIComponent(query)}`)
    return res.data
  },
}
