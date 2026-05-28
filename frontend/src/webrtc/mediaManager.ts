export async function getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
  // Apply low-latency video constraints
  const enhanced: MediaStreamConstraints = {
    audio: constraints.audio === true ? {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    } : constraints.audio,
    video: constraints.video === true ? {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 60 },
    } : constraints.video,
  }
  return navigator.mediaDevices.getUserMedia(enhanced)
}

export async function getDisplayMedia(): Promise<MediaStream> {
  return navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: { ideal: 30, max: 60 },
    } as any,
    audio: true,
  })
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

export function toggleAudio(stream: MediaStream, enabled: boolean) {
  stream.getAudioTracks().forEach((track) => { track.enabled = enabled })
}

export function toggleVideo(stream: MediaStream, enabled: boolean) {
  stream.getVideoTracks().forEach((track) => { track.enabled = enabled })
}
