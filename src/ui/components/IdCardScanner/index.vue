<template>
  <div class="video-capture-card">
    <div class="video-section">
      <div class="video-container">
        <video ref="videoRef" autoplay playsinline></video>
        <canvas ref="canvasRef" style="display: none;"></canvas>
        <canvas ref="frameCanvasRef" class="frame-canvas"></canvas>
        <img
          v-if="showMaskedOverlay && maskedImage"
          :src="maskedImage"
          class="masked-overlay"
          alt="마스킹 오버레이"
        />
      </div>
      <div class="status-banner" v-if="isProcessing">
        <span>🔎 OCR 처리 중...</span>
      </div>
      <div class="status-banner detecting" v-else-if="isDetecting && !isTargetDetected">
        <span>🟡 신분증 자동 감지 대기 중...</span>
      </div>
      <div class="status-banner detected" v-else-if="isDetecting && isTargetDetected">
        <span>🟢 신분증이 감지되었습니다! 자동 촬영 중...</span>
      </div>
      <div class="status-banner idle" v-else>
        <span>📷 신분증을 프레임 안에 맞춰주세요</span>
      </div>
    </div>
    <div class="controls">
      <button class="main-btn" @click="startCameraAndDetection" :disabled="isStreaming">
        <span>📷</span> 카메라 시작
      </button>
      <button class="main-btn" @click="captureImageManually" :disabled="!isStreaming">
        <span>✂️</span> 이미지 캡처
      </button>
      <button class="main-btn" @click="stopCameraAndDetection" :disabled="!isStreaming">
        <span>🛑</span> 카메라 중지
      </button>
      <button class="main-btn" @click="triggerFileInput">
        <span>📁</span> 파일 업로드
      </button>
      <input
        type="file"
        ref="fileInput"
        accept="image/*"
        @change="handleFileUpload"
        style="display: none"
      />
    </div>
    <div class="image-preview-row">
      <div v-if="showPreview && capturedImage" class="image-preview">
        <div class="preview-label">원본 이미지</div>
        <img :src="capturedImage" alt="원본 이미지" />
      </div>
      <div v-if="showPreview && maskedImage" class="image-preview masked">
        <div class="preview-label">마스킹된 이미지</div>
        <img :src="maskedImage" alt="마스킹된 이미지" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, watch, computed } from 'vue'
import { useCamera } from '@/core/camera/useCamera'
import { useOCR } from '@/core/ocr/useOCR'
import { useMasking } from '@/core/masking/useMasking'
import { useAutoCapture } from '@/core/auto-capture/useAutoCapture'
import { AutoCaptureStatus } from '@/core/auto-capture/types'
import type { Word } from '@/core/masking/types'

const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const frameCanvasRef = ref<HTMLCanvasElement | null>(null)

const capturedImage = ref<string | null>(null)
const maskedImage = ref<string | null>(null)
const isProcessing = ref(false)
const showMaskedOverlay = ref(false)
const frameColor = ref<'green' | 'red'>('red')
const showPreview = ref(false)

const { isStreaming, start: startCamera, stop: stopCamera } = useCamera(videoRef)
const { initialize: initializeOCR, terminate: terminateOCR, recognize } = useOCR()
const { applyMask, detectDocumentType, getApplicablePatterns, findMaskRegions, extractWords } = useMasking()

const {
  status,
  isTargetDetected,
  startDetect,
  stopDetect,
} = useAutoCapture(
  videoRef,
  async (capturedCanvas: HTMLCanvasElement) => {
    if (await hasMaskTarget(capturedCanvas)) {
      await processImage(capturedCanvas);
      stopCameraAndDetection();
    }
  }
);


const isDetecting = computed(() => status.value === AutoCaptureStatus.Detecting)

// 자동 감지 상태와 타겟 감지 상태 변경 시 프레임 색상 업데이트
watch([status, isTargetDetected], ([newStatus, detected]) => {
  const detecting = newStatus === AutoCaptureStatus.Detecting;
  frameColor.value = (detecting && detected) ? 'green' : 'red';
  drawFrame(true);
});

watch(isStreaming, (newVal) => {
  if (newVal && videoRef.value) drawFrame(true)
  if (!newVal) stopDetect();
  
});

onUnmounted(() => {
  stopCameraAndDetection();
  terminateOCR();
});

/**
 * 이미지를 처리하여 OCR 인식 및 마스킹을 수행합니다.
 * 
 * 이 함수는 캡처된 이미지나 업로드된 이미지를 받아서 OCR 인식을 통해 텍스트를 추출하고,
 * 민감한 개인정보를 자동으로 감지하여 마스킹을 적용합니다.
 * 
 * 처리 과정:
 * 1. Canvas에 소스 이미지 그리기
 * 2. 원본 이미지를 미리보기용으로 저장
 * 3. OCR 엔진 초기화 및 텍스트 인식 수행
 * 4. 민감한 정보 감지 및 마스킹 적용
 * 5. 마스킹된 이미지를 미리보기용으로 저장
 * 6. 성공 시 프레임 색상을 녹색으로 변경하고 미리보기 표시
 * 7. 실패 시 프레임 색상을 빨간색으로 변경하고 미리보기 숨김
 * 
 * @param source - 처리할 이미지 소스 (Canvas 또는 Image 엘리먼트)
 * @returns Promise<void> - 이미지 처리 완료
 */
const processImage = async (source: HTMLCanvasElement | HTMLImageElement) => {
  if (isProcessing.value || !canvasRef.value) return;
  isProcessing.value = true;
  maskedImage.value = null;
  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    isProcessing.value = false;
    return;
  }

  // 소스 이미지를 Canvas에 그리기
  canvas.width = source instanceof HTMLCanvasElement ? source.width : source.naturalWidth;
  canvas.height = source instanceof HTMLCanvasElement ? source.height : source.naturalHeight;
  ctx.drawImage(source, 0, 0);
  capturedImage.value = canvas.toDataURL('image/png');

  // OCR 인식 및 마스킹 적용
  try {
    await initializeOCR();
    const ocrData = await recognize(canvas);
    await applyMask(ctx, ocrData);
    maskedImage.value = canvas.toDataURL('image/png');
    frameColor.value = 'green';
    showPreview.value = true;

    if (videoRef.value && isStreaming.value) {
      videoRef.value.pause();
      showMaskedOverlay.value = true;
    }
  } catch (error) {
    maskedImage.value = null;
    frameColor.value = 'red';
    showPreview.value = false;
  } finally {
    isProcessing.value = false;
  }
};


const captureImageManually = () => {
  if (!videoRef.value || !isStreaming.value) return;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = videoRef.value.videoWidth;
  tempCanvas.height = videoRef.value.videoHeight;
  tempCanvas.getContext('2d')?.drawImage(videoRef.value, 0, 0);

  processImage(tempCanvas);
};

const handleFileUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      processImage(img);
    };
    img.src = e.target?.result as string;
  };

  reader.readAsDataURL(file);
  if (fileInput.value) fileInput.value.value = '';
};

const triggerFileInput = () => {
  fileInput.value?.click();
};

const startCameraAndDetection = async () => {
  if (isStreaming.value) return;

  drawFrame(true)
  capturedImage.value = null;
  maskedImage.value = null;
  await startCamera();

  // 비디오가 완전히 준비된 후 자동캡처 시작
  if (videoRef.value) {
    videoRef.value.onloadedmetadata = () => {
      if (isStreaming.value) startDetect();
    };
    // 이미 준비된 경우 바로 실행
    if (videoRef.value.readyState >= 3 && isStreaming.value) {
      startDetect();
    }
  }
};

const stopCameraAndDetection = () => {
  stopCamera();
  stopDetect();
};


function drawFrame(visible: boolean) {
  const canvas = frameCanvasRef.value
  const video = videoRef.value

  if (!canvas || !video) return
  if (video.videoWidth === 0 || video.videoHeight === 0) return
  
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (visible) {
    ctx.strokeStyle = frameColor.value === 'green' ? 'lime' : '#ff3b3b';
    ctx.lineWidth = 8

    // 둥근 사각형 테두리 그리기
    const radius = 32 // 모서리 둥글기(px)
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(canvas.width - radius, 0);
    ctx.arcTo(canvas.width, 0, canvas.width, radius, radius);
    ctx.lineTo(canvas.width, canvas.height - radius);
    ctx.arcTo(canvas.width, canvas.height, canvas.width - radius, canvas.height, radius);
    ctx.lineTo(radius, canvas.height);
    ctx.arcTo(0, canvas.height, 0, canvas.height - radius, radius);
    ctx.lineTo(0, radius);
    ctx.arcTo(0, 0, radius, 0, radius);
    ctx.closePath();
    ctx.stroke();
  }
}

// 마스킹 대상 감지 함수 (OCR 결과에서 패턴 매칭)
async function hasMaskTarget(canvas: HTMLCanvasElement): Promise<boolean> {
  await initializeOCR();
  const ocrData = await recognize(canvas);
  const words = extractWords(ocrData.data.blocks);
  const docType = detectDocumentType(words.map((w: Word) => w.text).join(' '));
  if (!docType) return false;
  const patterns = getApplicablePatterns(docType);
  const regions = findMaskRegions(words, patterns);
  return regions.length > 0;
}

</script>

<style scoped>
body {
  font-family: 'Pretendard', 'Noto Sans KR', 'Apple SD Gothic Neo', Arial, sans-serif;
}
.video-capture-card {
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.10), 0 1.5px 6px rgba(0,0,0,0.06);
  padding: 2rem 1.5rem 2.5rem 1.5rem;
  max-width: 480px;
  margin: 2rem auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}
.video-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}
.video-container {
  width: 100%;
  aspect-ratio: 1.59 / 1;
  background: #222;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  position: relative;
}
.frame-canvas {
  position: absolute;
  top: 0; left: 0;
  width: 100%; 
  height: 100%;
  pointer-events: none;
  z-index: 2;
  border-radius: 12px;
}
video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 12px;
  background: #000;
}
.status-banner {
  margin-top: 1rem;
  width: 100%;
  padding: 0.7rem 1rem;
  border-radius: 8px;
  font-size: 1.08rem;
  font-weight: 500;
  text-align: center;
  background: #f3f6fa;
  color: #333;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  letter-spacing: 0.01em;
}
.status-banner.detecting {
  background: #fffbe6;
  color: #bfa100;
}
.status-banner.detected {
  background: #eaffea;
  color: #1a7f37;
}
.status-banner.idle {
  background: #f3f6fa;
  color: #333;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
  width: 100%;
}
.main-btn {
  background: linear-gradient(90deg, #4f8cff 0%, #38cfa6 100%);
  color: #fff;
  font-size: 1.08rem;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  padding: 0.7rem 1.5rem;
  box-shadow: 0 1.5px 6px rgba(0,0,0,0.06);
  cursor: pointer;
  transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
  display: flex;
  align-items: center;
  gap: 0.5em;
  max-width: 320px;
  width: 100%;
  margin: 0 auto;
}
.main-btn:disabled {
  background: #e0e0e0;
  color: #aaa;
  cursor: not-allowed;
  box-shadow: none;
}
.main-btn:not(:disabled):hover {
  background: linear-gradient(90deg, #38cfa6 0%, #4f8cff 100%);
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 4px 16px rgba(79,140,255,0.10);
}
.image-preview-row {
  display: flex;
  gap: 1.5rem;
  width: 100%;
  justify-content: center;
}
.image-preview {
  background: #f8fafc;
  border-radius: 12px;
  box-shadow: 0 1.5px 6px rgba(0,0,0,0.06);
  padding: 1rem 0.7rem 0.7rem 0.7rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 120px;
  max-width: 180px;
}
.image-preview img {
  width: 100%;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  border: 2px solid #e0e7ef;
}
.image-preview .preview-label {
  font-size: 0.98rem;
  font-weight: 500;
  color: #4f8cff;
  margin-bottom: 0.5em;
  margin-top: 0.2em;
}
.image-preview.masked .preview-label {
  color: #38cfa6;
}
.masked-overlay {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  border-radius: 12px;
  z-index: 2;
  pointer-events: none;
  box-shadow: 0 0 0 4px #38cfa6aa;
  animation: popIn 0.2s;
}
@keyframes popIn {
  from { opacity: 0; transform: scale(0.98);}
  to { opacity: 1; transform: scale(1);}
}
</style> 