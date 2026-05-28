import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, Smile, X, FileText, Image as ImageIcon } from 'lucide-react'
import { wsClient } from '../../ws/client'
import { filesApi, UploadedFile } from '../../api/files'
import { toast } from '../Toaster'

interface Props {
  onSend: (content: string, attachments?: UploadedFile[]) => void
  sending?: boolean
  targetId?: string
  targetType?: 'channel' | 'dm'
}

export default function MessageInput({ onSend, sending, targetId, targetType }: Props) {
  const [content, setContent] = useState('')
  const [attachments, setAttachments] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const typingTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = Math.min(ref.current.scrollHeight, 160) + 'px'
    }
  }, [content])

  const sendTyping = (start: boolean) => {
    if (!targetId || !targetType) return
    wsClient.send({
      type: start ? 'typing.start' : 'typing.stop',
      payload: { target_id: targetId, target_type: targetType },
    })
  }

  const handleChange = (val: string) => {
    setContent(val)
    if (val.trim()) {
      sendTyping(true)
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      typingTimerRef.current = window.setTimeout(() => sendTyping(false), 3000)
    }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const arr = Array.from(files)
      const uploaded = await filesApi.upload(arr)
      setAttachments(prev => [...prev, ...uploaded])
    } catch (e: any) {
      toast(e.response?.data?.error || 'Upload failed', 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files || [])
    if (files.length > 0) {
      e.preventDefault()
      const dt = new DataTransfer()
      files.forEach(f => dt.items.add(f))
      handleFiles(dt.files)
    }
  }

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if ((!content.trim() && attachments.length === 0) || sending || uploading) return
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    sendTyping(false)
    onSend(content.trim(), attachments)
    setContent('')
    setAttachments([])
  }

  const isImage = (type: string) => type.startsWith('image/')

  return (
    <form onSubmit={handleSubmit} className="px-4 pb-4 pt-1">
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((att, i) => (
            <div key={i} className="relative bg-bg-tertiary border border-border rounded-lg p-2 flex items-center gap-2 max-w-[240px]">
              {isImage(att.content_type) ? (
                <img src={att.url} alt={att.filename} className="w-12 h-12 object-cover rounded" />
              ) : (
                <div className="w-12 h-12 bg-bg-hover rounded flex items-center justify-center">
                  <FileText size={20} className="text-text-muted" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-text-primary truncate">{att.filename}</p>
                <p className="text-[10px] text-text-muted">{(att.size / 1024).toFixed(1)} KB</p>
              </div>
              <button type="button" onClick={() => removeAttachment(i)}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-danger text-white flex items-center justify-center hover:bg-danger/80">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} accept="image/*,application/pdf,video/*,audio/*,.txt,.doc,.docx,.xlsx,.ppt,.pptx,.zip" />

      <div className="flex items-end gap-2 bg-bg-hover rounded-lg px-4 py-2 border border-border/50 focus-within:border-brand/50 transition-colors">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="p-1 text-text-muted hover:text-text-primary transition-colors shrink-0 disabled:opacity-50" title="Attach file">
          {uploading ? <ImageIcon size={20} className="animate-pulse" /> : <Paperclip size={20} />}
        </button>
        <textarea ref={ref} value={content} onChange={(e) => handleChange(e.target.value)} onPaste={handlePaste}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e) } }}
          placeholder={uploading ? 'Uploading...' : 'Type a message... (paste images here)'} rows={1} disabled={sending}
          className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted text-[15px] resize-none focus:outline-none py-1 max-h-40" />
        <button type="button" className="p-1 text-text-muted hover:text-text-primary transition-colors shrink-0" title="Emoji"><Smile size={20} /></button>
        <button type="submit" disabled={(!content.trim() && attachments.length === 0) || sending || uploading}
          className="p-1.5 bg-brand hover:bg-brand-hover text-white rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0">
          <Send size={16} />
        </button>
      </div>
    </form>
  )
}
