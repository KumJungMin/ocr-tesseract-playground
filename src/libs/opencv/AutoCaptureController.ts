import { IdCardDetector } from './idCardDetector'
import type { DetectionResult } from './idCardDetector';
import type { Mat } from 'opencv-ts';


type DetectCallback = (progress: number) => void;
type CaptureCallback = (imageData: ImageData) => void;

export interface ControllerOptions {
  detectionInterval?: number;
  consecutiveFrames?: number;
}

export class AutoCaptureController {
  private detector: IdCardDetector;
  private options: Required<ControllerOptions>;
  private onDetect: DetectCallback;
  private onCapture: CaptureCallback;
  private isCapturing: boolean = false;
  private consecutiveDetections: number = 0;
  private lastDetectionTime: number = 0;
  private animationFrameId: number | null = null;
  private srcMat: Mat;

  constructor(
    detector: IdCardDetector,
    onDetect: DetectCallback,
    onCapture: CaptureCallback,
    options: ControllerOptions = {}
  ) {
    this.detector = detector;
    this.options = {
      detectionInterval: 100,
      consecutiveFrames: 5,
      ...options,
    };
    this.onDetect = onDetect;
    this.onCapture = onCapture;
    this.srcMat = new this.detector.cv.Mat();
  }

  public start(videoEl: HTMLVideoElement): void {
    if (this.isCapturing) return;
    this.isCapturing = true;
    this.consecutiveDetections = 0;
    
    const loop = (): void => {
      if (!this.isCapturing) return;
      this.processFrame(videoEl);
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  public stop(): void {
    this.isCapturing = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.onDetect(0);
  }

  public destroy(): void {
    this.stop();
    if (this.srcMat) {
      this.srcMat.delete();
    }
  }

  private processFrame(videoEl: HTMLVideoElement): void {
    const now = Date.now();
    if (now - this.lastDetectionTime < this.options.detectionInterval) return;
    this.lastDetectionTime = now;

    const cap = new this.detector.cv.VideoCapture(videoEl);
    cap.read(this.srcMat);

    if (this.srcMat.empty()) {
      return;
    }
    
    if (this.srcMat.rows > this.srcMat.cols) {
      // 90도 반시계 회전: transpose + flip(0)
      this.detector.cv.transpose(this.srcMat, this.srcMat);
      this.detector.cv.flip(this.srcMat, this.srcMat, 0);
    }

    let result: DetectionResult | null = null;
    try {
      result = this.detector.detect(this.srcMat);

      if (result.found) {
        this.consecutiveDetections++;
        this.onDetect(this.consecutiveDetections / this.options.consecutiveFrames);
      } else {
        this.consecutiveDetections = 0;
        this.onDetect(0);
      }

      if (this.consecutiveDetections >= this.options.consecutiveFrames) {
        this.stop();
        
        const tempCanvas = document.createElement('canvas');
        this.detector.cv.imshow(tempCanvas, this.srcMat);
        const ctx = tempCanvas.getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
          this.onCapture(imageData);
        }
      }
    } finally {
      if (result?.candidate?.contour) {
        result.candidate.contour.delete();
      }
    }
  }
}