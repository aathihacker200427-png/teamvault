import { useState } from 'react'
import { format } from 'date-fns'
import { useAuthStore } from '../../stores/authStore'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { messagesApi } from '../../api/messages'
import { CheckCheck, Reply, Copy, Edit2, Trash2, Check, X } from 'lucide-react'
import { toast } from '../Toaster'

interface Message { id: string; channel_id?: string; conversation_id?: string; sender: { id: string; display_name: string; avatar_url?: string }; content: string; reply_to?: { id: string; sender_name: string; content: string }; attachments?: { id: string; url: string; filename: string; content_type: string; size: number }[]; edited_at?: string; created_at: string }

interface Props {
  message: Message
  onReply?: (msg: { id: string; content: string; sender_name: string }) => void
}

export default function MessageItem({ message, onReply }: Props) {
  const currentUserId = useAuthStore((s) => s.user?.id)
  const isMine = message.sender.id === currentUserId
  const time = format(new Date(message.created_at), 'HH:mm')
  const colors = ['#5865f2', '#23a55a', '#f0b232', '#eb459e', '#f23f43', '#f47b67']
  const color = colors[message.sender.display_name.charCodeAt(0) % colors.length]
  const queryClient = useQueryClient()

  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(message.content)

  const targetKey = ['messages', message.channel_id || message.conversation_id]

  const editMutation = useMutation({
    mutationFn: () => messagesApi.edit(message.id, editText),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: targetKey })
      setEditing(false)
      toast('Message updated', 'success')
    },
    onError: () => toast('Failed to edit', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => messagesApi.delete(message.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: targetKey })
      toast('Message deleted', 'success')
    },
    onError: () => toast('Failed to delete', 'error'),
  })

  const copyText = () => {
    navigator.clipboard.writeText(message.content)
    toast('Copied', 'success')
  }

  return (
    <div className={`px-4 py-1 flex group ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] flex gap-2 ${isMine ? 'flex-row-reverse' : ''} relative`}>
        {!isMine && (
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1" style={{ backgroundColor: color }}>
            {message.sender.display_name[0]?.toUpperCase()}
          </div>
        )}

        <div className={`min-w-0 flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
          {!isMine && (
            <span className="text-[11px] font-medium mb-0.5 ml-1" style={{ color }}>{message.sender.display_name}</span>
          )}

          {message.reply_to && (
            <div className="text-[11px] text-text-muted mb-0.5 px-2 py-0.5 rounded border-l-2 border-brand/50 bg-bg-tertiary/50 max-w-full truncate">
              <span className="font-medium">{message.reply_to.sender_name}: </span>{message.reply_to.content}
            </div>
          )}

          <div className="relative">
            {editing ? (
              <div className="flex flex-col gap-1.5">
                <textarea value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); editMutation.mutate() }
                    if (e.key === 'Escape') { setEditText(message.content); setEditing(false) }
                  }}
                  rows={Math.min(5, editText.split('\n').length)}
                  className={`px-3 py-2 rounded-2xl text-[14px] resize-none focus:outline-none ${isMine ? 'bg-brand text-white' : 'bg-bg-hover text-text-primary'} min-w-[200px]`} />
                <div className="flex items-center gap-1 text-[10px] text-text-muted">
                  <span>esc to cancel · enter to save</span>
                  <button onClick={() => { setEditText(message.content); setEditing(false) }}
                    className="ml-auto p-1 rounded hover:bg-bg-hover"><X size={12} /></button>
                  <button onClick={() => editMutation.mutate()} disabled={editMutation.isPending}
                    className="p-1 rounded bg-success text-white"><Check size={12} /></button>
                </div>
              </div>
            ) : (
              <>
                <div className={`px-3 py-2 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap break-words ${
                  isMine ? 'bg-brand text-white rounded-br-sm' : 'bg-bg-hover text-text-primary rounded-bl-sm'
                }`}>
                  {message.content || (message.attachments && message.attachments.length > 0 ? '' : '\u200B')}
                </div>

                {message.attachments && message.attachments.length > 0 && (
                  <div className={`mt-1 flex flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}>
                    {message.attachments.map(att => (
                      att.content_type.startsWith('image/') ? (
                        <a key={att.id} href={att.url} target="_blank" rel="noreferrer">
                          <img src={att.url} alt={att.filename} loading="lazy"
                            className="max-w-[280px] max-h-[300px] rounded-lg border border-border object-cover hover:opacity-90 transition-opacity" />
                        </a>
                      ) : att.content_type.startsWith('video/') ? (
                        <video key={att.id} src={att.url} controls className="max-w-[320px] max-h-[300px] rounded-lg border border-border" />
                      ) : att.content_type.startsWith('audio/') ? (
                        <audio key={att.id} src={att.url} controls className="max-w-[300px]" />
                      ) : (
                        <a key={att.id} href={att.url} target="_blank" rel="noreferrer" download={att.filename}
                          className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border border-border rounded-lg hover:bg-bg-hover transition-colors max-w-[280px]">
                          <div className="w-10 h-10 bg-brand/20 rounded flex items-center justify-center text-brand text-xs font-bold">
                            {att.filename.split('.').pop()?.toUpperCase().slice(0, 4) || 'FILE'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-text-primary truncate">{att.filename}</p>
                            <p className="text-[10px] text-text-muted">{(att.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </a>
                      )
                    ))}
                  </div>
                )}

                <div className={`absolute -top-3 ${isMine ? 'left-0' : 'right-0'} hidden group-hover:flex items-center gap-0.5 bg-bg-secondary border border-border rounded shadow-lg px-1 py-0.5 z-10`}>
                  <button onClick={() => onReply?.({ id: message.id, content: message.content, sender_name: message.sender.display_name })}
                    className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary" title="Reply">
                    <Reply size={13} />
                  </button>
                  <button onClick={copyText}
                    className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary" title="Copy">
                    <Copy size={13} />
                  </button>
                  {isMine && (
                    <>
                      <button onClick={() => setEditing(true)}
                        className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary" title="Edit">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => { if (confirm('Delete this message?')) deleteMutation.mutate() }}
                        className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-danger" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {!editing && (
            <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMine ? 'flex-row-reverse' : ''}`}>
              <span className="text-[10px] text-text-muted">{time}</span>
              {isMine && <CheckCheck size={12} className="text-text-link" />}
              {message.edited_at && <span className="text-[10px] text-text-muted">edited</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
