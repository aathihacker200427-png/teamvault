interface PeerConnectionConfig {
  iceServers: RTCIceServer[]
}

export class PeerConnection {
  private pc: RTCPeerConnection
  private localStream: MediaStream | null = null
  private onTrackCallback?: (stream: MediaStream) => void
  private onIceCandidateCallback?: (candidate: RTCIceCandidate) => void

  constructor(config: PeerConnectionConfig) {
    this.pc = new RTCPeerConnection({ iceServers: config.iceServers })

    this.pc.ontrack = (event) => {
      this.onTrackCallback?.(event.streams[0])
    }

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceCandidateCallback?.(event.candidate)
      }
    }
  }

  setOnTrack(callback: (stream: MediaStream) => void) {
    this.onTrackCallback = callback
  }

  setOnIceCandidate(callback: (candidate: RTCIceCandidate) => void) {
    this.onIceCandidateCallback = callback
  }

  async setLocalStream(stream: MediaStream) {
    this.localStream = stream
    stream.getTracks().forEach((track) => {
      this.pc.addTrack(track, stream)
    })
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    return offer
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    return answer
  }

  async setRemoteDescription(desc: RTCSessionDescriptionInit) {
    await this.pc.setRemoteDescription(desc)
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    await this.pc.addIceCandidate(candidate)
  }

  close() {
    this.pc.close()
    this.localStream?.getTracks().forEach((track) => track.stop())
  }
}
