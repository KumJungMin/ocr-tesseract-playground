import type OpenCV from 'opencv-ts';
import type { Mat } from 'opencv-ts';

/**
 * 자동 캡처 옵션 인터페이스
 * 신분증 감지 알고리즘의 동작을 제어하는 매개변수들을 정의합니다.
 */
export interface AutoCaptureOptions {
  /** 목표 종횡비 (신분증의 가로/세로 비율). 기본값: 1.586 (신분증 표준 비율) */
  targetRatio?: number;
  /** 종횡비 허용 오차. 기본값: 0.25 (25% 오차 허용) */
  ratioTolerance?: number;
  /** 윤곽선 근사화 정밀도 계수. 기본값: 0.02 (2% 정밀도) */
  approxPolyEpsilonFactor?: number;
  /** 최소 각도 (도). 기본값: 52.0 (비스듬한 카드 허용) */
  minAngle?: number;
  /** 최대 각도 (도). 기본값: 110.0 (비스듬한 카드 허용) */
  maxAngle?: number;
  /** 가우시안 블러 커널 크기. 기본값: 5 */
  blurKernelSize?: number;
  /** Canny 엣지 검출 첫 번째 임계값. 기본값: 50 */
  cannyThreshold1?: number;
  /** Canny 엣지 검출 두 번째 임계값. 기본값: 150 */
  cannyThreshold2?: number;
  /** 모폴로지 연산 커널 크기. 기본값: 5 */
  morphKernelSize?: number;
  /** 최소 감지 점수. 기본값: 0.18 (18% 이상이면 신분증으로 판단) */
  minDetectionScore?: number;
  /** 감지 간격 (밀리초). 기본값: 150ms */
  detectionInterval?: number;
  /** 연속 감지 프레임 수. 기본값: 5 (5프레임 연속 감지되면 캡처) */
  consecutiveFrames?: number;
  /** 종횡비 점수 가중치. 기본값: 0.4 (40%) */
  scoreWeightRatio?: number;
  /** 각도 점수 가중치. 기본값: 0.3 (30%) */
  scoreWeightAngle?: number;
  /** 디버그 모드 활성화. 기본값: false */
  debug?: boolean;
}

/**
 * 감지 결과 객체의 타입 정의
 * 신분증 감지 알고리즘의 결과를 나타냅니다.
 */
export interface DetectionResult {
  /** 신분증이 감지되었는지 여부 */
  found: boolean;
  /** 감지된 후보 객체 (감지된 경우에만 존재) */
  candidate?: {
    /** 감지된 윤곽선 (OpenCV Mat 객체) */
    contour: Mat;
    /** 감지 신뢰도 점수 (0.0 ~ 1.0) */
    score: number;
  };
}

/**
 * OpenCV를 사용하여 이미지에서 신분증을 감지하는 클래스
 * 
 * 이 클래스는 컴퓨터 비전 기술을 사용하여 카메라 프레임에서 신분증을 자동으로 감지합니다.
 * 주요 처리 과정:
 * 1. 이미지 전처리 (그레이스케일 변환, 블러, 엣지 검출)
 * 2. 윤곽선 검출 및 사각형 후보 찾기
 * 3. 각도 및 종횡비 검증
 * 4. 점수 계산 및 최적 후보 선택
 * ```
 */
export class IdCardDetector {
  /** OpenCV 인스턴스 */
  public readonly cv: typeof OpenCV;
  /** 감지 옵션 (모든 옵션이 기본값으로 채워진 상태) */
  public readonly options: Required<AutoCaptureOptions>;

  /**
   * IdCardDetector 인스턴스를 생성합니다.
   * 
   * @param cv - OpenCV 인스턴스 (Worker에서 전달받은 cv 객체)
   * @param options - 감지 옵션 (선택사항)
   */
  constructor(cv: typeof OpenCV, options: AutoCaptureOptions = {}) {
    this.cv = cv;
    this.options = {
      // 모바일 환경에 최적화된 기본값
      targetRatio: 1.586,        // 신분증 표준 종횡비
      ratioTolerance: 0.25,      // 오차 허용치를 높여 비스듬한 카드도 인식
      approxPolyEpsilonFactor: 0.02,
      minAngle: 52.0,            // 각도 허용치도 넓힘
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

  /**
   * 입력 이미지에서 신분증을 감지합니다.
   * 
   * 이 메서드는 다음과 같은 단계로 신분증을 감지합니다:
   * 1. 이미지 전처리 (그레이스케일, 블러, 엣지 검출)
   * 2. 윤곽선 검출 및 사각형 후보 찾기
   * 3. 각도 및 종횡비 검증
   * 4. 점수 계산 및 최적 후보 선택
   * 
   * @param srcMat - 감지할 이미지 (OpenCV Mat 객체, RGBA 형식)
   * @returns 감지 결과 객체
   */
  public detect(srcMat: Mat): DetectionResult {
    let edges: Mat | undefined;
    let bestCandidate: DetectionResult['candidate'] = undefined;

    try {
      // 1단계: 이미지 전처리 (그레이스케일, 블러, 엣지 검출)
      edges = this._preprocessImage(srcMat);
      
      // 2단계: 최적 후보 찾기
      const candidate = this._findBestCandidate(edges);
      
      // 3단계: 점수 검증
      if (candidate && candidate.score > this.options.minDetectionScore) {
        if (this.options.debug) {
            console.log(`[Detector] Success! Score: ${candidate.score.toFixed(3)}`);
        }
        bestCandidate = candidate;
      }
    } catch (error) {
      console.error('[Detector] Error:', error);
    } finally {
      // 메모리 정리
      edges?.delete();
    }
    
    return { found: !!bestCandidate, candidate: bestCandidate };
  }

  /**
   * 이미지 전처리를 수행합니다.
   * 
   * 전처리 과정:
   * 1. RGBA → 그레이스케일 변환
   * 2. 가우시안 블러로 노이즈 제거
   * 3. Canny 엣지 검출
   * 4. 모폴로지 연산으로 엣지 연결
   * 
   * @param src - 원본 이미지 (RGBA 형식)
   * @returns 전처리된 엣지 이미지
   * @private
   */
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
      // 1. 그레이스케일 변환
      this.cv.cvtColor(src, gray, this.cv.COLOR_RGBA2GRAY);
      
      // 2. 가우시안 블러로 노이즈 제거
      this.cv.GaussianBlur(gray, blurred, new this.cv.Size(this.options.blurKernelSize, this.options.blurKernelSize), 0, 0, this.cv.BORDER_DEFAULT);
      
      // 3. Canny 엣지 검출
      this.cv.Canny(blurred, edges, this.options.cannyThreshold1, this.options.cannyThreshold2);
      
      // 4. 모폴로지 연산으로 엣지 연결 (CLOSE 연산)
      this.cv.morphologyEx(
        edges, edges, this.cv.MORPH_CLOSE, morphKernel,
        new this.cv.Point(-1, -1), // anchor
        1,                         // iterations
        this.cv.BORDER_CONSTANT,   // borderType
        this.cv.morphologyDefaultBorderValue() // borderValue
      );
      
      return edges.clone();
    } finally {
      // 메모리 정리
      gray.delete();
      blurred.delete();
      morphKernel.delete();
    }
  }

  /**
   * 엣지 이미지에서 최적의 신분증 후보를 찾습니다.
   * 
   * 후보 검색 과정:
   * 1. 윤곽선 검출
   * 2. 각 윤곽선에 대해 사각형 근사화
   * 3. 면적, 각도, 종횡비 검증
   * 4. 점수 계산 및 최적 후보 선택
   * 
   * @param edges - 전처리된 엣지 이미지
   * @returns 최적 후보 객체 또는 undefined
   * @private
   */
  private _findBestCandidate(edges: Mat): DetectionResult['candidate'] {
    const contours = new this.cv.MatVector();
    const hierarchy = new this.cv.Mat();
    
    try {
      // 1. 윤곽선 검출
      this.cv.findContours(edges, contours, hierarchy, this.cv.RETR_EXTERNAL, this.cv.CHAIN_APPROX_SIMPLE);

      let bestCandidate: DetectionResult['candidate'] = undefined;
      let maxScore = -1;
      const minPixelArea = 1000;   // 최소 픽셀 면적 기준 (노이즈 제거용)

      // 2. 각 윤곽선에 대해 검증
      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const approx = new this.cv.Mat();
        
        try {
          // 2-1. 면적 검증 (너무 작은 윤곽선 제외)
          if (this.cv.contourArea(cnt) < minPixelArea) {
            continue;
          }
          
          // 2-2. 사각형 근사화
          const perimeter = this.cv.arcLength(cnt, true);
          this.cv.approxPolyDP(cnt, approx, this.options.approxPolyEpsilonFactor * perimeter, true);

          // 2-3. 사각형 검증 (4개 점, 볼록한 형태)
          if (approx.rows !== 4 || !this.cv.isContourConvex(approx)) {
            continue;
          }

          // 2-4. 각도 검증
          const angles = this._getAngles(approx);
          if (!angles.every(a => a >= this.options.minAngle && a <= this.options.maxAngle)) {
            continue;
          }

          // 2-5. 종횡비 계산
          const rotatedRect = this.cv.minAreaRect(approx);
          const { width, height } = rotatedRect.size;
          const aspectRatio = Math.max(width, height) / Math.min(width, height);
          
          // 2-6. 점수 계산
          const score = this._calculateScore(aspectRatio, angles);

          // 2-7. 최적 후보 업데이트
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
  
  /**
   * 후보의 점수를 계산합니다.
   * 
   * 점수 계산 공식:
   * - 종횡비 점수: 목표 비율과의 차이에 기반 (40% 가중치)
   * - 각도 점수: 90도와의 차이에 기반 (30% 가중치)
   * 
   * @param aspectRatio - 후보의 종횡비
   * @param angles - 후보의 4개 각도 (도 단위)
   * @returns 0.0 ~ 1.0 범위의 점수
   * @private
   */
  private _calculateScore(aspectRatio: number, angles: number[]): number {
    // 종횡비 점수 계산
    const ratioDiff = Math.abs(aspectRatio - this.options.targetRatio) / this.options.targetRatio;
    const ratioScore = Math.max(0, 1 - ratioDiff / this.options.ratioTolerance);
    
    // 각도 점수 계산 (90도에 가까울수록 높은 점수)
    const angleScore = angles.reduce((sum, angle) => {
        const diff = Math.abs(angle - 90) / (90 - this.options.minAngle);
        return sum + Math.max(0, 1 - diff);
    }, 0) / 4;

    // 가중 평균 계산
    return (ratioScore * this.options.scoreWeightRatio) +
           (angleScore * this.options.scoreWeightAngle);
  }

  /**
   * 사각형의 4개 각도를 계산합니다.
   * 
   * 각 점에서 두 이웃 점과의 벡터를 사용하여 각도를 계산합니다.
   * 
   * @param poly - 4개 점으로 구성된 사각형 (OpenCV Mat)
   * @returns 4개 각도 배열 (도 단위)
   * @private
   */
  private _getAngles(poly: Mat): number[] {
    // 점들을 배열로 변환
    const points = [];
    for (let i = 0; i < poly.rows; i++) {
        points.push({ x: poly.data32S[i * 2], y: poly.data32S[i * 2 + 1] });
    }

    // 각 점에서의 각도 계산
    const angles = [];
    for (let i = 0; i < 4; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % 4];
        const p3 = points[(i + 2) % 4];
        
        // 두 벡터 계산
        const ux = p1.x - p2.x, uy = p1.y - p2.y;
        const vx = p3.x - p2.x, vy = p3.y - p2.y;
        
        // 내적 계산
        const dot = ux * vx + uy * vy;
        const magU = Math.sqrt(ux * ux + uy * uy);
        const magV = Math.sqrt(vx * vx + vy * vy);
        
        // 각도 계산 (라디안 → 도)
        if (magU * magV === 0) { 
            angles.push(0); 
            continue; 
        }
        const cosTheta = dot / (magU * magV);
        angles.push(Math.acos(Math.max(-1, Math.min(1, cosTheta))) * 180.0 / Math.PI);
    }
    return angles;
  }
}