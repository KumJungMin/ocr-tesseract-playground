export function createDetectionCanvas(video: HTMLVideoElement, targetWidth = 480): HTMLCanvasElement {
  const aspectRatio = video.videoWidth / video.videoHeight;
  const canvas = document.createElement('canvas');
 
  canvas.width = targetWidth;
  canvas.height = targetWidth / aspectRatio;
 
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Failed to get canvas context');
 
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
} 