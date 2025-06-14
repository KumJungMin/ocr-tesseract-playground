<template>
  <div class="video-capture">
    <div class="video-container">
      <video ref="videoRef" autoplay playsinline></video>
      <canvas ref="canvasRef" style="display: none;"></canvas>
    </div>
    <div class="controls">
      <button @click="startCamera" :disabled="isStreaming">카메라 시작</button>
      <button @click="captureImage" :disabled="!isStreaming">이미지 캡처</button>
      <button @click="stopCamera" :disabled="!isStreaming">카메라 중지</button>
    </div>
    <div v-if="capturedImage" class="captured-image">
      <h3>캡처된 이미지:</h3>
      <img :src="capturedImage" alt="캡처된 이미지" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const isStreaming = ref(false)
const capturedImage = ref<string | null>(null)
let stream: MediaStream | null = null

const startCamera = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    })
    
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      isStreaming.value = true
    }
  } catch (error) {
    console.error('카메라 접근 오류:', error)
  }
}

const captureImage = () => {
  if (!videoRef.value || !canvasRef.value || !isStreaming.value) return

  const video = videoRef.value
  const canvas = canvasRef.value
  
  // 캔버스 크기를 비디오 크기에 맞춤
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  
  // 비디오 프레임을 캔버스에 그리기
  const context = canvas.getContext('2d')
  if (context) {
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    // 캡처된 이미지를 base64 문자열로 변환
    capturedImage.value = canvas.toDataURL('image/png')
  }
}

const stopCamera = () => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
    if (videoRef.value) {
      videoRef.value.srcObject = null
    }
    isStreaming.value = false
    stream = null
  }
}

onUnmounted(() => {
  stopCamera()
})
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
  gap: 1rem;
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

.captured-image {
  margin-top: 1rem;
  text-align: center;
}

.captured-image img {
  max-width: 100%;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style> 