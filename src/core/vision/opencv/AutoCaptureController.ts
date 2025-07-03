import { IdCardDetector } from './idCardDetector'
import type { DetectionResult } from './idCardDetector';
import type { Mat } from 'opencv-ts';

/**
 * 감지 진행률을 알려주는 콜백 함수 타입
 * @param progress - 감지 진행률 (0.0 ~ 1.0)
 */
type DetectCallback = (progress: number) => void;

/**
 * 이미지 캡처 완료 시 호출되는 콜백 함수 타입
 * @param imageData - 캡처된 이미지 데이터
 */
type CaptureCallback = (imageData: ImageData) => void;

/**
 * 자동 캡처 컨트롤러 옵션 인터페이스
 * 컨트롤러의 동작을 제어하는 매개변수들을 정의합니다.
 */
export interface ControllerOptions {
  /** 감지 간격 (밀리초). 기본값: 100ms */
  detectionInterval?: number;
  /** 연속 감지 프레임 수. 기본값: 3 (3프레임 연속 감지되면 캡처) */
  consecutiveFrames?: number;
}

/**
 * 자동 캡처 컨트롤러 클래스
 * 
 * 이 클래스는 비디오 스트림에서 신분증을 자동으로 감지하고 캡처하는 기능을 제공합니다.
 * 주요 기능:
 * 1. 비디오 프레임을 주기적으로 분석
 * 2. 신분증 감지 알고리즘 실행
 * 3. 연속 감지 시 자동 캡처
 * 4. 진행률 및 결과 콜백 제공
 * 
 * 동작 과정:
 * 1. start() 호출 시 requestAnimationFrame으로 프레임 처리 루프 시작
 * 2. 각 프레임에서 IdCardDetector를 사용하여 신분증 감지
 * 3. 연속으로 감지되면 자동으로 이미지 캡처
 * 4. 콜백을 통해 진행률과 결과를 상위 컴포넌트에 전달
 */
export class AutoCaptureController {
  /** 신분증 감지기 인스턴스 */
  private detector: IdCardDetector;
  /** 컨트롤러 옵션 (모든 옵션이 기본값으로 채워진 상태) */
  private options: Required<ControllerOptions>;
  /** 감지 진행률 콜백 함수 */
  private onDetect: DetectCallback;
  /** 캡처 완료 콜백 함수 */
  private onCapture: CaptureCallback;
  /** 현재 캡처 중인지 여부 */
  private isCapturing: boolean = false;
  /** 연속 감지 횟수 */
  private consecutiveDetections: number = 0;
  /** 마지막 감지 시간 (타임스탬프) */
  private lastDetectionTime: number = 0;
  /** requestAnimationFrame ID (루프 제어용) */
  private animationFrameId: number | null = null;
  /** 비디오 프레임을 저장할 OpenCV Mat 객체 */
  private srcMat: Mat;

  /**
   * AutoCaptureController 인스턴스를 생성합니다.
   * 
   * @param detector - 신분증 감지기 인스턴스
   * @param onDetect - 감지 진행률을 받을 콜백 함수
   * @param onCapture - 캡처 완료 시 호출될 콜백 함수
   * @param options - 컨트롤러 옵션 (선택사항)
   */
  constructor(
    detector: IdCardDetector,
    onDetect: DetectCallback,
    onCapture: CaptureCallback,
    options: ControllerOptions = {}
  ) {
    this.detector = detector;
    this.options = {
      detectionInterval: 100,    // 100ms마다 감지
      consecutiveFrames: 3,      // 3프레임 연속 감지 시 캡처
      ...options,
    };
    this.onDetect = onDetect;
    this.onCapture = onCapture;
    // OpenCV Mat 객체 생성 (비디오 프레임 저장용)
    this.srcMat = new this.detector.cv.Mat();
  }

  /**
   * 자동 캡처를 시작합니다.
   * 
   * 이 메서드는 requestAnimationFrame을 사용하여 비디오 프레임을 지속적으로 분석합니다.
   * 감지 간격을 고려하여 성능을 최적화하고, 연속 감지 시 자동으로 이미지를 캡처합니다.
   * 
   * @param videoEl - 분석할 비디오 엘리먼트
   */
  public start(videoEl: HTMLVideoElement): void {
    if (this.isCapturing) return;  // 이미 실행 중이면 무시
    this.isCapturing = true;
    this.consecutiveDetections = 0;  // 연속 감지 카운터 초기화
    
    // 프레임 처리 루프 정의
    const loop = (): void => {
      if (!this.isCapturing) return;  // 중지되었으면 루프 종료
      this.processFrame(videoEl);     // 현재 프레임 처리
      this.animationFrameId = requestAnimationFrame(loop);  // 다음 프레임 예약
    };
    
    // 루프 시작
    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * 자동 캡처를 중지합니다.
   * 
   * 현재 실행 중인 프레임 처리 루프를 중단하고, 감지 진행률을 0으로 리셋합니다.
   */
  public stop(): void {
    this.isCapturing = false;  // 루프 중단 플래그 설정
    
    // requestAnimationFrame 취소
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // 감지 진행률 리셋
    this.onDetect(0);
  }

  /**
   * 컨트롤러를 완전히 정리합니다.
   * 
   * 자동 캡처를 중지하고 OpenCV Mat 객체의 메모리를 해제합니다.
   * 컨트롤러를 더 이상 사용하지 않을 때 호출해야 합니다.
   */
  public destroy(): void {
    this.stop();  // 먼저 중지
    
    // OpenCV Mat 객체 메모리 해제
    if (this.srcMat) {
      this.srcMat.delete();
    }
  }

  /**
   * 단일 비디오 프레임을 처리합니다.
   * 
   * 이 메서드는 다음과 같은 과정을 수행합니다:
   * 1. 감지 간격 확인 (성능 최적화)
   * 2. 비디오 프레임을 OpenCV Mat으로 변환
   * 3. 세로 방향 비디오인 경우 90도 회전
   * 4. 신분증 감지 알고리즘 실행
   * 5. 연속 감지 시 자동 캡처
   * 
   * @param videoEl - 처리할 비디오 엘리먼트
   * @private
   */
  private processFrame(videoEl: HTMLVideoElement): void {
    const now = Date.now();
    
    // 감지 간격 확인 (성능 최적화)
    if (now - this.lastDetectionTime < this.options.detectionInterval) {
      return;  // 아직 감지 간격이 되지 않았으면 스킵
    }
    this.lastDetectionTime = now;

    // 1. 비디오 프레임을 OpenCV Mat으로 변환
    const cap = new this.detector.cv.VideoCapture(videoEl);
    cap.read(this.srcMat);

    // 프레임이 비어있으면 처리하지 않음
    if (this.srcMat.empty()) {
      return;
    }
    
    // 2. 세로 방향 비디오인 경우 90도 회전 (모바일 카메라 대응)
    if (this.srcMat.rows > this.srcMat.cols) {
      // 90도 반시계 회전: transpose + flip(0)
      this.detector.cv.transpose(this.srcMat, this.srcMat);
      this.detector.cv.flip(this.srcMat, this.srcMat, 0);
    }

    let result: DetectionResult | null = null;
    try {
      // 3. 신분증 감지 알고리즘 실행
      result = this.detector.detect(this.srcMat);

      if (result.found) {
        // 신분증이 감지된 경우
        this.consecutiveDetections++;
        // 진행률 계산 (0.0 ~ 1.0)
        const progress = this.consecutiveDetections / this.options.consecutiveFrames;
        this.onDetect(progress);
        
        // 4. 연속 감지 시 자동 캡처
        if (this.consecutiveDetections >= this.options.consecutiveFrames) {
          this.stop();  // 캡처 후 자동 중지
          
          // OpenCV Mat을 Canvas로 변환하여 ImageData 추출
          const tempCanvas = document.createElement('canvas');
          this.detector.cv.imshow(tempCanvas, this.srcMat);
          const ctx = tempCanvas.getContext('2d');
          if (ctx) {
            const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            this.onCapture(imageData);  // 캡처 완료 콜백 호출
          }
        }
      } else {
        // 신분증이 감지되지 않은 경우
        this.consecutiveDetections = 0;  // 연속 감지 카운터 리셋
        this.onDetect(0);  // 진행률 0으로 리셋
      }
    } finally {
      // 5. 메모리 정리 (감지 결과의 윤곽선 객체 해제)
      if (result?.candidate?.contour) {
        result.candidate.contour.delete();
      }
    }
  }
}