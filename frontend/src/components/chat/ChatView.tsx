import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useCallStore } from '../../stores/callStore'
import { messagesApi } from '../../api/messages'
import { workspacesApi } from '../../api/workspaces'
import { callsApi } from '../../api/calls'
import { callManager } from '../../webrtc/callManager'
import { getUserMedia } from '../../webrtc/mediaManager'
import { toast } from '../Toaster'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import TypingIndicator from './TypingIndicator'
import ChannelInfoPanel from '../layout/ChannelInfoPanel'
import { Hash, Phone, Video, MonitorUp, Users, MessageCircle, X } from 'lucide-react'

export default function ChatView() {
  const { activeChannel, activeDm, activeWorkspace } = useWorkspaceStore()
  const { setActiveCall, setLocalStream } = useCallStore()
  const queryClient = useQueryClient()
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; sender_name: string } | null>(null)
  const [showInfoPanel, setShowInfoPanel] = useState(false)

  const targetId = activeChannel?.id || activeDm?.id
  const isDm = !!activeDm

  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['messages', targetId],
    queryFn: () => isDm ? messagesApi.getDmMessages(activeDm!.id) : messagesApi.getChannelMessages(activeChannel!.id),
    enabled: !!targetId,
    refetchOnWindowFocus: false,
  })

  const { data: members } = useQuery({
    queryKey: ['workspace-members', activeWorkspace?.id],
    queryFn: () => workspacesApi.getMembers(activeWorkspace!.id),
    enabled: !!activeWorkspace && !isDm,
  })

  const sendMutation = useMutation({
    mutationFn: ({ content, replyId, attachments }: { content: string; replyId?: string; attachments?: any[] }) =>
      isDm ? messagesApi.sendDmMessage(activeDm!.id, content, replyId, attachments) : messagesApi.sendMessage(activeChannel!.id, content, replyId, attachments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', targetId] })
      setReplyTo(null)
    },
    onError: () => toast('Failed to send message', 'error'),
  })

  const startCall = async (type: 'audio' | 'video') => {
    try {
      const stream = await getUserMedia({ audio: true, video: type === 'video' }).catch(() => getUserMedia({ audio: true }))
      setLocalStream(stream)
      const call = await callsApi.initiate(isDm ? 'dm' : 'channel', targetId!, type)
      callManager.startCall(call.id, stream)
      setActiveCall(call)
    } catch {
      toast('Could not access microphone/camera. Check browser permissions.', 'error')
    }
  }

  const startScreenShare = async () => {
    // Start a video call - screen sharing is then done via the in-call button
    try {
      const stream = await getUserMedia({ audio: true, video: true }).catch(() => getUserMedia({ audio: true }))
      setLocalStream(stream)
      const call = await callsApi.initiate(isDm ? 'dm' : 'channel', targetId!, 'video')
      callManager.startCall(call.id, stream)
      setActiveCall(call)
      // Wait a moment then immediately start screen share
      setTimeout(() => callManager.toggleScreenShare(), 500)
    } catch {
      toast('Could not start screen share. Check browser permissions.', 'error')
    }
  }

  if (!targetId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-muted gap-3 px-6">
        <div className="w-20 h-20 rounded-full bg-bg-secondary flex items-center justify-center text-4xl">👋</div>
        <p className="text-xl font-bold text-text-primary">Welcome to TeamVault</p>
        <p className="text-sm text-center max-w-sm">Select a channel or direct message from the sidebar to start chatting. Press <kbd className="px-1.5 py-0.5 bg-bg-secondary rounded text-xs">Ctrl+K</kbd> to search.</p>
      </div>
    )
  }

  const displayName = isDm
    ? (activeDm!.is_group ? activeDm!.participants.map(p => p.display_name).join(', ') : activeDm!.participants[0]?.display_name || 'Unknown')
    : activeChannel!.name

  const currentMessages = messagesData ? [...messagesData].reverse() : []
  const memberCount = members?.length || 0

  return (
    <div className="flex-1 flex relative overflow-hidden">
      <div className={`flex-1 flex flex-col min-w-0 ${showInfoPanel ? 'md:mr-80' : ''}`}>
        <div className="h-12 px-4 flex items-center justify-between border-b border-border bg-bg-primary shadow-sm shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {isDm ? <MessageCircle size={20} className="text-text-muted shrink-0" /> : <Hash size={20} className="text-text-muted shrink-0" />}
            <h2 className="font-bold text-text-primary text-[15px] truncate">{displayName}</h2>
            {!isDm && activeChannel?.topic && <span className="hidden sm:inline text-sm text-text-muted border-l border-border pl-2 ml-1 truncate">{activeChannel.topic}</span>}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => startCall('audio')} className="p-2 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors" title="Voice Call"><Phone size={18} /></button>
            <button onClick={() => startCall('video')} className="p-2 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors" title="Video Call"><Video size={18} /></button>
            <button onClick={startScreenShare} className="p-2 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors" title="Share Screen"><MonitorUp size={18} /></button>
            {!isDm && (
              <button onClick={() => setShowInfoPanel(!showInfoPanel)}
                className={`p-2 rounded transition-colors flex items-center gap-1 ${showInfoPanel ? 'bg-bg-hover text-text-primary' : 'hover:bg-bg-hover text-text-muted hover:text-text-primary'}`}
                title="Channel Info">
                <Users size={18} />
                {memberCount > 0 && <span className="text-xs font-medium">{memberCount}</span>}
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-text-muted">
            <div className="w-8 h-8 rounded-full border-2 border-border border-t-brand animate-spin" />
          </div>
        ) : (
          <MessageList messages={currentMessages} onReply={setReplyTo} />
        )}

        {replyTo && (
          <div className="px-4 py-2 bg-bg-secondary border-t border-border flex items-center gap-3 shrink-0">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-muted">Replying to <span className="text-text-secondary font-medium">{replyTo.sender_name}</span></p>
              <p className="text-sm text-text-secondary truncate">{replyTo.content}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="p-1 rounded hover:bg-bg-hover text-text-muted"><X size={16} /></button>
          </div>
        )}

        <MessageInput onSend={(content, attachments) => sendMutation.mutate({ content, replyId: replyTo?.id, attachments })} sending={sendMutation.isPending} targetId={targetId} targetType={isDm ? 'dm' : 'channel'} />
        <TypingIndicator targetId={targetId!} />
      </div>

      {showInfoPanel && !isDm && <ChannelInfoPanel onClose={() => setShowInfoPanel(false)} />}
    </div>
  )
}
