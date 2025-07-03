import { ref } from 'vue'
import type { Ref } from 'vue'

export function useCamera(videoRef: Ref<HTMLVideoElement | null>) {
  const isStreaming = ref(false)
  let stream: MediaStream | null = null

  async function start() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })

      if (videoRef.value) {
        videoRef.value.srcObject = stream
        await videoRef.value.play()
        isStreaming.value = true
      }
    } catch (err) {
      console.error('카메라 접근 실패:', err)
      isStreaming.value = false
    }
  }

  function stop() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
    }

    if (videoRef.value) {
      videoRef.value.pause()
      videoRef.value.srcObject = null
    }

    isStreaming.value = false
    stream = null
  }

  return {
    isStreaming,
    start,
    stop,
  }
}
