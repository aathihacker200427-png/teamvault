import { apiClient } from './client'

interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user: {
    id: string
    email: string
    display_name: string
    avatar_url?: string
    status: string
  }
}

export const authApi = {
  register: async (email: string, password: string, display_name: string) => {
    const response = await apiClient.post<AuthResponse>('/auth/register', {
      email,
      password,
      display_name,
    })
    return response.data
  },

  login: async (email: string, password: string) => {
    const response = await apiClient.post<AuthResponse>('/auth/login', {
      email,
      password,
    })
    return response.data
  },

  logout: async () => {
    await apiClient.post('/auth/logout')
  },
}
