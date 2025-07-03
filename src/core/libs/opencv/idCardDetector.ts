import type OpenCV from 'opencv-ts';
import type { Mat } from 'opencv-ts';

/**
 * 자동 캡처 옵션 인터페이스
 */
export interface AutoCaptureOptions {
  targetRatio?: number;
  ratioTolerance?: number;
  approxPolyEpsilonFactor?: number;
  minAngle?: number;
  maxAngle?: number;
  blurKernelSize?: number;
  cannyThreshold1?: number;
  cannyThreshold2?: number;
  morphKernelSize?: number;
  minDetectionScore?: number;
  detectionInterval?:number;
  consecutiveFrames?:number;
  scoreWeightRatio?: number;
  scoreWeightAngle?: number;
  debug?: boolean;
}

/**
 * 감지 결과 객체의 타입 정의
 */
export interface DetectionResult {
  found: boolean;
  candidate?: {
    contour: Mat;
    score: number;
  };
}

/**
 * OpenCV를 사용하여 이미지에서 신분증을 감지하는 클래스
 */
export class IdCardDetector {
  public readonly cv: typeof OpenCV;
  public readonly options: Required<AutoCaptureOptions>;

  constructor(cv: typeof OpenCV, options: AutoCaptureOptions = {}) {
    this.cv = cv;
    this.options = {
      // 모바일 환경에 최적화된 기본값
      targetRatio: 1.586,
      ratioTolerance: 0.25, // 오차 허용치를 높여 비스듬한 카드도 인식
      approxPolyEpsilonFactor: 0.02,
      minAngle: 52.0,       // 각도 허용치도 넓힘
      maxAngle: 110.0,
      blurKernelSize: 5,
      cannyThreshold1: 50,
      cannyThreshold2: 150,
      morphKernelSize: 5,
      minDetectionScore: 0.18,
      scoreWeightRatio: 0.4,
      scoreWeightAngle: 0.3,
      detectionInterval: 150,
      consecutiveFrames: 5,
      debug: false,
      ...options,
    };
  }

  public detect(srcMat: Mat): DetectionResult {
    let edges: Mat | undefined;
    let bestCandidate: DetectionResult['candidate'] = undefined;

    try {
      edges = this._preprocessImage(srcMat);
      const candidate = this._findBestCandidate(edges);
      
      if (candidate && candidate.score > this.options.minDetectionScore) {
        if (this.options.debug) {
            console.log(`[Detector] Success! Score: ${candidate.score.toFixed(3)}`);
        }
        bestCandidate = candidate;
      }
    } catch (error) {
      console.error('[Detector] Error:', error);
    } finally {
      edges?.delete();
    }
    
    return { found: !!bestCandidate, candidate: bestCandidate };
  }

  private _preprocessImage(src: Mat): Mat {
    const gray = new this.cv.Mat();
    const blurred = new this.cv.Mat();
    const edges = new this.cv.Mat();
    const morphKernel = this.cv.getStructuringElement(
      this.cv.MORPH_RECT, 
      new this.cv.Size(this.options.morphKernelSize, this.options.morphKernelSize),
      new this.cv.Point(-1, -1)
    );

    try {
      this.cv.cvtColor(src, gray, this.cv.COLOR_RGBA2GRAY);
      this.cv.GaussianBlur(gray, blurred, new this.cv.Size(this.options.blurKernelSize, this.options.blurKernelSize), 0, 0, this.cv.BORDER_DEFAULT);
      this.cv.Canny(blurred, edges, this.options.cannyThreshold1, this.options.cannyThreshold2);
      this.cv.morphologyEx(
        edges, edges, this.cv.MORPH_CLOSE, morphKernel,
        new this.cv.Point(-1, -1), // anchor
        1,                         // iterations
        this.cv.BORDER_CONSTANT,   // borderType
        this.cv.morphologyDefaultBorderValue() // borderValue
      );
      return edges.clone();
    } finally {
      gray.delete();
      blurred.delete();
      morphKernel.delete();
    }
  }

  private _findBestCandidate(edges: Mat): DetectionResult['candidate'] {
    const contours = new this.cv.MatVector();
    const hierarchy = new this.cv.Mat();
    
    try {
      // 
      this.cv.findContours(edges, contours, hierarchy, this.cv.RETR_EXTERNAL, this.cv.CHAIN_APPROX_SIMPLE);

      let bestCandidate: DetectionResult['candidate'] = undefined;
      let maxScore = -1;
      const minPixelArea = 1000;   // [수정 2] 최소 픽셀 면적 기준 추가 (노이즈 제거용)

      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const approx = new this.cv.Mat();
        
        try {
           // [수정 2] 노이즈 필터링: 너무 작은 윤곽선은 계산 전에 미리 제외
          if (this.cv.contourArea(cnt) < minPixelArea) {
            continue;
          }
          const perimeter = this.cv.arcLength(cnt, true);
          this.cv.approxPolyDP(cnt, approx, this.options.approxPolyEpsilonFactor * perimeter, true);

          if (approx.rows !== 4 || !this.cv.isContourConvex(approx)) {
            continue;
          }

          const angles = this._getAngles(approx);
          if (!angles.every(a => a >= this.options.minAngle && a <= this.options.maxAngle)) {
            continue;
          }

          const rotatedRect = this.cv.minAreaRect(approx);
          const { width, height } = rotatedRect.size;
          const aspectRatio = Math.max(width, height) / Math.min(width, height);
          
          const score = this._calculateScore(aspectRatio, angles);

          if (score > maxScore) {
            bestCandidate?.contour.delete();
            maxScore = score;

            bestCandidate = { contour: approx.clone(), score: score };
          }
        } finally {
          cnt.delete();
          approx.delete();
        }
      }
      return bestCandidate;
    } finally {
      contours.delete();
      hierarchy.delete();
    }
  }
  
  private _calculateScore(aspectRatio: number, angles: number[]): number {
    const ratioDiff = Math.abs(aspectRatio - this.options.targetRatio) / this.options.targetRatio;
    const ratioScore = Math.max(0, 1 - ratioDiff / this.options.ratioTolerance);
    const angleScore = angles.reduce((sum, angle) => {
        const diff = Math.abs(angle - 90) / (90 - this.options.minAngle);
        return sum + Math.max(0, 1 - diff);
    }, 0) / 4;

    return (ratioScore * this.options.scoreWeightRatio) +
           (angleScore * this.options.scoreWeightAngle);
  }

  private _getAngles(poly: Mat): number[] {
    const points = [];
    for (let i = 0; i < poly.rows; i++) {
        points.push({ x: poly.data32S[i * 2], y: poly.data32S[i * 2 + 1] });
    }

    const angles = [];
    for (let i = 0; i < 4; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % 4];
        const p3 = points[(i + 2) % 4];
        const ux = p1.x - p2.x, uy = p1.y - p2.y;
        const vx = p3.x - p2.x, vy = p3.y - p2.y;
        const dot = ux * vx + uy * vy;
        const magU = Math.sqrt(ux * ux + uy * uy);
        const magV = Math.sqrt(vx * vx + vy * vy);
        if (magU * magV === 0) { angles.push(0); continue; }
        const cosTheta = dot / (magU * magV);
        angles.push(Math.acos(Math.max(-1, Math.min(1, cosTheta))) * 180.0 / Math.PI);
    }
    return angles;
  }
}