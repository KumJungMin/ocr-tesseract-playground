<template>
  <div class="video-capture">
    <div class="video-container">
      <video ref="videoRef" autoplay playsinline></video>
      <canvas ref="canvasRef" style="display: none;"></canvas>
    </div>
    <div class="controls">
      <div class="camera-controls">
        <button @click="startCamera" :disabled="isStreaming">카메라 시작</button>
        <button @click="captureImage" :disabled="!isStreaming">이미지 캡처</button>
        <button @click="stopCamera" :disabled="!isStreaming">카메라 중지</button>
      </div>
      <div class="file-controls">
        <input
          type="file"
          ref="fileInput"
          accept="image/*"
          @change="handleFileUpload"
          style="display: none"
        />
        <button @click="triggerFileInput">파일 업로드</button>
      </div>
    </div>
    <div v-if="capturedImage" class="captured-image">
      <h3>원본 이미지:</h3>
      <img :src="capturedImage" alt="원본 이미지" />
    </div>
    <div v-if="maskedImage" class="masked-image">
      <h3>마스킹된 이미지:</h3>
      <img :src="maskedImage" alt="마스킹된 이미지" />
    </div>
    <div v-if="isProcessing" class="processing">
      <p>OCR 처리 중...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useCamera } from '@/composables/useCamera'
import { useOCR } from '@/composables/useOCR'
import { useMasking } from '@/composables/useMasking'

interface Word {
  text: string
  bbox: {
    x0: number
    y0: number
    x1: number
    y1: number
  }
}

interface Line {
  words: Word[]
}

interface Paragraph {
  lines: Line[]
}

interface Block {
  paragraphs: Paragraph[]
}

const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const capturedImage = ref<string | null>(null)
const maskedImage = ref<string | null>(null)
const isProcessing = ref(false)

const { isStreaming, start: startCamera, stop: stopCamera } = useCamera(videoRef)
const { initialize: initializeOCR, terminate: terminateOCR, recognize } = useOCR()
const { applyMask } = useMasking()

onUnmounted(() => {
  stopCamera()
  terminateOCR()
})

const captureImage = async () => {
  if (!videoRef.value || !canvasRef.value || !isStreaming.value) return
  const video = videoRef.value
  const canvas = canvasRef.value
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const context = canvas.getContext('2d')
  if (context) {
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    capturedImage.value = canvas.toDataURL('image/png')
    isProcessing.value = true
    await initializeOCR()
    const ocrData = await recognize(canvas)
    await applyMask(context, ocrData)
    maskedImage.value = canvas.toDataURL('image/png')
    isProcessing.value = false
  }
}

const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !canvasRef.value) return
  const reader = new FileReader()
  reader.onload = async (e) => {
    const img = new Image()
    img.onload = async () => {
      const canvas = canvasRef.value!
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        capturedImage.value = canvas.toDataURL('image/png')
        isProcessing.value = true
        await initializeOCR()
        const ocrData = await recognize(canvas)
        await applyMask(ctx, ocrData)
        maskedImage.value = canvas.toDataURL('image/png')
        isProcessing.value = false
      }
    }
    img.src = e.target?.result as string
  }
  reader.readAsDataURL(file)
  input.value = ''
}

const triggerFileInput = () => {
  fileInput.value?.click()
}
</script>

<style scoped>
.video-capture {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
}

.video-container {
  position: relative;
  width: 100%;
  max-width: 640px;
}

video {
  width: 100%;
  border-radius: 8px;
  background-color: #000;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 640px;
}

.camera-controls,
.file-controls {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  background-color: #4CAF50;
  color: white;
  cursor: pointer;
  transition: background-color 0.3s;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  background-color: #45a049;
}

.captured-image,
.masked-image {
  margin-top: 1rem;
  text-align: center;
}

.captured-image img,
.masked-image img {
  max-width: 100%;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.processing {
  margin-top: 1rem;
  color: #666;
}
</style> 