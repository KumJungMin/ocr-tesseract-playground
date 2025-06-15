<template>
  <div class="scanner">
    <video ref="videoEl" autoplay playsinline muted></video>
    <canvas id="canvasInput" ref="canvasEl"></canvas>
    <button v-if="capturedData" @click="download">다운로드</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

declare const cv: any;

const videoEl = ref<HTMLVideoElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const capturedData = ref<string | null>(null);
let detectTimer: number | null = null;

// 카드 비율 & 기준값
const CARD_RATIO      = 85.60 / 53.98;  // ≈1.585
const RATIO_TOLERANCE = 0.15;            // ±15%
const MIN_AREA_RATIO  = 0.3;            // 화면 면적의  30%
const MAX_AREA_RATIO  = 0.8;             // 화면 면적의 80%

onMounted(async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  if (!videoEl.value) throw new Error('videoRef가 없습니다');
  videoEl.value.srcObject = stream;
  await videoEl.value.play();

  if (cv.Mat) startDetection();
  else cv.onRuntimeInitialized = () => startDetection();
});

onUnmounted(() => stopDetection());

function startDetection() {
  const vid = videoEl.value!;
  const cvs = canvasEl.value!;
  cvs.width = vid.videoWidth;
  cvs.height = vid.videoHeight;
  detectTimer = window.setInterval(processFrame, 200);
}

function stopDetection() {
  if (detectTimer != null) {
    clearInterval(detectTimer);
    detectTimer = null;
  }
  const tracks = (videoEl.value?.srcObject as MediaStream)?.getTracks() || [];
  tracks.forEach(t => t.stop());
  if (videoEl.value) videoEl.value.srcObject = null;
}

function processFrame() {
  const vid = videoEl.value!;
  const cvs = canvasEl.value!;
  const ctx = cvs.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(vid, 0, 0, cvs.width, cvs.height);

  const frameArea = cvs.width * cvs.height;

  const src = cv.imread(cvs);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const sharp = new cv.Mat();
  const edges = new cv.Mat();
  const thresh = new cv.Mat();
  const hierarchy = new cv.Mat();
  const contours = new cv.MatVector();

  // 전처리
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.bilateralFilter(gray, blurred, 9, 75, 75);
  const kernel = cv.matFromArray(3, 3, cv.CV_32F, [-1, -1, -1, -1, 9, -1, -1, -1, -1]);
  cv.filter2D(blurred, sharp, cv.CV_8U, kernel);
  cv.Canny(sharp, edges, 50, 100);
  cv.threshold(edges, thresh, 50, 255, cv.THRESH_BINARY);
  const M = cv.Mat.ones(5, 5, cv.CV_8U);
  cv.morphologyEx(thresh, thresh, cv.MORPH_CLOSE, M);

  // 컨투어 검출 및 필터
  cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    const peri = cv.arcLength(cnt, true);
    const approx = new cv.Mat();
    cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

    if (approx.rows === 4 && cv.isContourConvex(approx)) {
      const r = cv.boundingRect(approx);
      const area = r.width * r.height;
      const aspect = r.width / r.height;
      const areaRatio = area / frameArea;
      const aspectDelta = Math.abs(aspect - CARD_RATIO);
      
      // 카드 비율 & 면적 비율 조건
      if (
        areaRatio > MIN_AREA_RATIO &&
        areaRatio < MAX_AREA_RATIO &&
        aspectDelta < RATIO_TOLERANCE
      ) {
        cv.rectangle(src, new cv.Point(r.x, r.y), new cv.Point(r.x + r.width, r.y + r.height), [0, 255, 0, 255], 2);
        cv.imshow(canvasEl.value!, src);
        triggerCapture(r);
        console.log(`카드 검출: x=${r.x}, y=${r.y}, w=${r.width}, h=${r.height}`);
        break;
      }
    }

    approx.delete();
    cnt.delete();
  }

  // 메모리 해제
  src.delete(); gray.delete(); blurred.delete(); sharp.delete();
  edges.delete(); thresh.delete(); hierarchy.delete(); contours.delete();
  kernel.delete(); M.delete();
}

function triggerCapture(r: { x: number; y: number; width: number; height: number }) {
  const cvs = canvasEl.value!;
  const src = cv.imread(cvs);
  const roi = src.roi(new cv.Rect(r.x, r.y, r.width, r.height));
  cv.cvtColor(roi, roi, cv.COLOR_RGBA2RGB);
  const tmp = document.createElement('canvas');
  tmp.width = r.width;
  tmp.height = r.height;
  cv.imshow(tmp, roi);
  capturedData.value = tmp.toDataURL('image/png');
  roi.delete(); src.delete();
  stopDetection();
}

function download() {
  if (!capturedData.value) return;
  const link = document.createElement('a');
  link.href = capturedData.value;
  link.download = 'card-capture.png';
  link.click();
}
</script>

<style scoped>
.scanner { 
  position: relative; 
  width: 100%; 
  max-width: 640px; 
  margin: auto; 
}
video, canvas { 
  display: block; 
  width: 100%; 
}
button { 
  position: absolute; 
  top: 1rem; 
  right: 1rem; 
  padding: 0.5em 1em; 
  }
</style>
