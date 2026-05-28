import { useTypingStore } from '../../stores/typingStore'
import { useState, useEffect } from 'react'
import { usersApi } from '../../api/users'

export default function TypingIndicator({ targetId }: { targetId: string }) {
  const typers = useTypingStore((s) => s.typing[targetId] ? Object.keys(s.typing[targetId]) : [])
  const [names, setNames] = useState<Record<string, string>>({})

  useEffect(() => {
    typers.forEach(async (id) => {
      if (!names[id]) {
        const u = await usersApi.get(id)
        if (u) setNames(prev => ({ ...prev, [id]: u.display_name }))
      }
    })
  }, [typers])

  if (typers.length === 0) return null

  const namesList = typers.map(id => names[id] || 'Someone').filter(Boolean)
  const text = namesList.length === 1
    ? `${namesList[0]} is typing`
    : namesList.length === 2
      ? `${namesList[0]} and ${namesList[1]} are typing`
      : `${namesList.length} people are typing`

  return (
    <div className="px-4 pb-1 text-xs text-text-muted flex items-center gap-2 h-5">
      <div className="flex gap-0.5">
        <span className="w-1 h-1 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1 h-1 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1 h-1 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>{text}...</span>
    </div>
  )
}
