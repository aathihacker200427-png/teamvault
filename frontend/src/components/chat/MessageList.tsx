import { useEffect, useRef } from 'react'
import { format, isToday, isYesterday, isSameDay } from 'date-fns'
import MessageItem from './MessageItem'

interface Message { id: string; sender: { id: string; display_name: string; avatar_url?: string; status: string }; content: string; reply_to?: { id: string; sender_name: string; content: string }; edited_at?: string; created_at: string }

interface Props {
  messages: Message[]
  onReply?: (msg: { id: string; content: string; sender_name: string }) => void
}

function dateLabel(d: Date): string {
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMMM d, yyyy')
}

export default function MessageList({ messages, onReply }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-muted gap-3 px-6">
        <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center text-3xl">💬</div>
        <p className="text-lg font-medium text-text-secondary">No messages yet</p>
        <p className="text-sm text-center">Send the first message to start the conversation!</p>
      </div>
    )
  }

  const items: Array<{ type: 'date'; label: string; key: string } | { type: 'msg'; msg: Message }> = []
  let lastDate: Date | null = null
  for (const msg of messages) {
    const d = new Date(msg.created_at)
    if (!lastDate || !isSameDay(lastDate, d)) {
      items.push({ type: 'date', label: dateLabel(d), key: `d-${msg.id}` })
      lastDate = d
    }
    items.push({ type: 'msg', msg })
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto py-4">
      {items.map((item) =>
        item.type === 'date' ? (
          <div key={item.key} className="flex items-center gap-3 px-4 py-2 my-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wide bg-bg-secondary px-2 py-0.5 rounded">{item.label}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        ) : (
          <MessageItem key={item.msg.id} message={item.msg} onReply={onReply} />
        )
      )}
    </div>
  )
}
