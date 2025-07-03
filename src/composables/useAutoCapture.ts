import { ref, onUnmounted, shallowRef } from 'vue';
import type { Ref } from 'vue';
import type { AutoCaptureOptions } from '../libs/opencv/idCardDetector';
import DetectionWorker from '../libs/opencv/workers/detection.worker?worker';

export function useAutoCapture(
  videoRef: Ref<HTMLVideoElement | null>,
  onCapture: (image: HTMLCanvasElement) => void,
  options: AutoCaptureOptions = {}
) {
  const { 
    detectionInterval = 150, 
    consecutiveFrames = 3,
  } = options;

  const detecting = ref(false);
  const isProcessing = ref(false);
  const isTargetDetected = ref(false);
  const worker = shallowRef<Worker | null>(null);

  let intervalId: number | null = null;
  let consecutiveDetections = 0;
  
  const startDetect = () => {
    if (worker.value) return;

    worker.value = new DetectionWorker();

    worker.value.onmessage = (event: MessageEvent) => {
      const { type, payload } = event.data;

      if (type === 'init-done') {
        detecting.value = true;
        isTargetDetected.value = false;
        consecutiveDetections = 0;
        // Worker가 준비된 후 감지 인터벌 시작
        intervalId = window.setInterval(runDetectionFrame, detectionInterval);
      }
      
      if (type === 'detection-result') {
        isProcessing.value = false; // 워커로부터 결과를 받았으므로 처리 중 상태 해제
        isTargetDetected.value = payload.found;

        if (payload.found) {
          consecutiveDetections++;
          if (consecutiveDetections >= consecutiveFrames) {
            captureAndStop();
          }
        } else {
          consecutiveDetections = 0;
        }
      }
    };

    // Worker 초기화 메시지 전송
    // public 폴더에 opencv.js 파일이 있어야 함
    worker.value.postMessage({
      type: 'init',
      payload: { options }
    });
  };

  const runDetectionFrame = () => {
    const video = videoRef.value;
    if (!video || video.paused || video.ended || video.videoWidth === 0 || isProcessing.value) {
      return;
    }

    isProcessing.value = true;

    // 성능을 위해 저해상도 캔버스에서 ImageData 추출
    const tempCanvas = document.createElement('canvas');
    const aspectRatio = video.videoWidth / video.videoHeight;
    tempCanvas.width = 480;
    tempCanvas.height = 480 / aspectRatio;
    
    const ctx = tempCanvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

    // 이미지 데이터를 Worker로 전송
    worker.value?.postMessage({
      type: 'detect',
      payload: { imageData }
    }, [imageData.data.buffer]); // 버퍼를 Transferable로 전달하여 복사 비용 절감
  };
  
  const captureAndStop = () => {
    const video = videoRef.value;
    if (!video) return;
    
    // 캡처는 원본 해상도로 수행
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = video.videoWidth;
    finalCanvas.height = video.videoHeight;
    finalCanvas.getContext('2d')!.drawImage(video, 0, 0, finalCanvas.width, finalCanvas.height);
    
    onCapture(finalCanvas);
    stopDetect();
  }

  const stopDetect = () => {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    
    worker.value?.terminate();
    worker.value = null;

    detecting.value = false;
    isProcessing.value = false;
    isTargetDetected.value = false;
    consecutiveDetections = 0;
  };

  onUnmounted(stopDetect);

  return {
    detecting,
    isProcessing,
    isTargetDetected,
    startDetect,
    stopDetect
  };
}