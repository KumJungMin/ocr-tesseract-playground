import cv from 'opencv-ts';  
import { IdCardDetector } from '../idCardDetector';

let detector: IdCardDetector | null = null;

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;

  if (type === 'init') {
    detector = new IdCardDetector(cv, payload.options);
    self.postMessage({ type: 'init-done' });

  } else if (type === 'detect') {
    if (!detector) return;
    
    const mat = cv.matFromImageData(payload.imageData);
    const result = detector.detect(mat);
    mat.delete();
    self.postMessage({ type: 'detection-result', payload: result });
  }
};