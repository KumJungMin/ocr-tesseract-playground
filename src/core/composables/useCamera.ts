import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import { defaultGetUserMedia, type GetUserMediaFn } from '@/core/services/mediaService'

export enum CameraStatus {
  Idle = 'idle',
  Starting = 'starting',
  Streaming = 'streaming',
  Error = 'error',
}

export function useCamera(
  videoRef: Ref<HTMLVideoElement | null>,
  getUserMedia: GetUserMediaFn = defaultGetUserMedia,
) {
  const status = ref<CameraStatus>(CameraStatus.Idle)
  const error = ref<Error | null>(null)
  const streamRef = ref<MediaStream | null>(null)

  async function start(constraints: MediaStreamConstraints = { video: { facingMode: { ideal: 'environment' } }, audio: false }) {
    if (status.value === CameraStatus.Streaming || status.value === CameraStatus.Starting) return
    status.value = CameraStatus.Starting
    error.value = null
    try {
      const stream = await getUserMedia(constraints)
      streamRef.value = stream

      if (videoRef.value) {
        videoRef.value.srcObject = stream
        await videoRef.value.play()
      }

      status.value = CameraStatus.Streaming
    } catch (err: any) {
      error.value = err instanceof Error ? err : new Error('Unknown camera error')
      status.value = CameraStatus.Error
      console.error('카메라 접근 실패:', err)
    }
  }

  function stop() {
    if (streamRef.value) {
      streamRef.value.getTracks().forEach(track => track.stop())
    }

    if (videoRef.value) {
      videoRef.value.pause()
      videoRef.value.srcObject = null
    }

    status.value = CameraStatus.Idle
    streamRef.value = null
  }

  return {
    status,
    isStreaming: computed(() => status.value === CameraStatus.Streaming),
    error,
    start,
    stop,
  }
}
