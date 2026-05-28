import { apiClient } from './client'

export interface UploadedFile {
  url: string
  filename: string
  content_type: string
  size: number
}

export const filesApi = {
  upload: async (files: File[]): Promise<UploadedFile[]> => {
    const formData = new FormData()
    files.forEach(f => formData.append('file', f))
    const res = await apiClient.post<UploadedFile[]>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
}
