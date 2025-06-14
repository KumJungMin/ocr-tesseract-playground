import { ref } from 'vue'
import type { Ref } from 'vue'

export function useCamera(videoRef:  Ref<HTMLVideoElement | null>) {
  const isStreaming = ref(false)
  let stream: MediaStream | null = null

  async function start() {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      isStreaming.value = true
    }
  }

  function stop() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      if (videoRef.value) videoRef.value.srcObject = null
      isStreaming.value = false
      stream = null
    }
  }

  return { isStreaming, start, stop }
} 