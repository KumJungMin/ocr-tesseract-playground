import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import { defaultGetUserMedia, type GetUserMediaFn } from '@/core/camera/services/mediaService'
import { CameraStatus } from '@/core/camera/types'

/**
 * 카메라 기능을 제공하는 Vue Composable
 * 
 * 이 composable은 브라우저의 MediaDevices API를 사용하여 카메라 스트림을 관리합니다.
 * 카메라 시작/중지, 상태 관리, 에러 처리를 포함한 완전한 카메라 제어 기능을 제공합니다.
 * 
 * 주요 기능:
 * 1. 카메라 스트림 시작 및 중지
 * 2. 실시간 상태 모니터링
 * 3. 에러 처리 및 복구
 * 4. 메모리 효율적인 리소스 관리
 * 
 * 상태 관리:
 * - Idle: 카메라가 중지된 상태
 * - Starting: 카메라 시작 중
 * - Streaming: 카메라 스트림 활성화
 * - Error: 카메라 접근 오류
 * 
 * @param videoRef - 카메라 스트림을 표시할 비디오 엘리먼트 참조
 * @param getUserMedia - getUserMedia 함수 (테스트용으로 주입 가능)
 * @returns 카메라 제어 함수들과 상태 객체
 */
export function useCamera(
  videoRef: Ref<HTMLVideoElement | null>,
  getUserMedia: GetUserMediaFn = defaultGetUserMedia,
) {
  /** 카메라 현재 상태 */
  const status = ref<CameraStatus>(CameraStatus.Idle)
  /** 카메라 관련 오류 정보 */
  const error = ref<Error | null>(null)
  /** 현재 활성화된 미디어 스트림 참조 */
  const streamRef = ref<MediaStream | null>(null)

  /**
   * 카메라 스트림을 시작합니다.
   * 
   * 이 메서드는 브라우저의 MediaDevices API를 사용하여 카메라에 접근하고
   * 비디오 엘리먼트에 스트림을 연결합니다. 기본적으로 후면 카메라를 우선적으로 사용합니다.
   * 
   * 카메라 시작 과정:
   * 1. 상태를 Starting으로 변경
   * 2. getUserMedia API로 카메라 스트림 요청
   * 3. 비디오 엘리먼트에 스트림 연결
   * 4. 비디오 재생 시작
   * 5. 상태를 Streaming으로 변경
   */
  async function start(constraints: MediaStreamConstraints = { video: { facingMode: { ideal: 'environment' } }, audio: false }) {
    // 이미 스트리밍 중이거나 시작 중이면 무시
    if (status.value === CameraStatus.Streaming || status.value === CameraStatus.Starting) return
    
    status.value = CameraStatus.Starting
    error.value = null
    
    try {
      // 1. getUserMedia API로 카메라 스트림 요청
      const stream = await getUserMedia(constraints)
      streamRef.value = stream

      // 2. 비디오 엘리먼트에 스트림 연결 및 재생
      if (videoRef.value) {
        videoRef.value.srcObject = stream
        await videoRef.value.play()
      }

      // 3. 스트리밍 상태로 변경
      status.value = CameraStatus.Streaming
    } catch (err: any) {
      // 4. 오류 처리
      error.value = err instanceof Error ? err : new Error('Unknown camera error')
      status.value = CameraStatus.Error
      console.error('카메라 접근 실패:', err)
    }
  }

  /**
   * 카메라 스트림을 중지합니다.
   * 
   * 이 메서드는 활성화된 카메라 스트림을 완전히 종료하고 관련 리소스를 정리합니다.
   * 메모리 누수를 방지하기 위해 모든 트랙을 중지하고 비디오 엘리먼트를 초기화합니다.
   * 
   * 정리 과정:
   * 1. 모든 미디어 트랙 중지
   * 2. 비디오 엘리먼트 정지 및 스트림 연결 해제
   * 3. 상태를 Idle로 변경
   * 4. 스트림 참조 제거
   */
  function stop() {
    // 1. 모든 미디어 트랙 중지 (메모리 누수 방지)
    if (streamRef.value) {
      streamRef.value.getTracks().forEach(track => track.stop())
    }

    // 2. 비디오 엘리먼트 정지 및 스트림 연결 해제
    if (videoRef.value) {
      videoRef.value.pause()
      videoRef.value.srcObject = null
    }

    // 3. 상태 초기화
    status.value = CameraStatus.Idle
    streamRef.value = null
  }

  return {
    /** 카메라 현재 상태 (반응형) */
    status,

    /** 카메라가 스트리밍 중인지 여부 (계산된 속성) */
    isStreaming: computed(() => status.value === CameraStatus.Streaming),

    /** 카메라 관련 오류 정보 (반응형) */
    error,

    /** 카메라 스트림 시작 함수 */
    start,

    /** 카메라 스트림 중지 함수 */
    stop,
  }
}
