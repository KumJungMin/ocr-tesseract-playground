import Tesseract from 'tesseract.js'

/**
 * Tesseract OCR 결과 인터페이스
 * 
 * Tesseract.js에서 반환하는 OCR 결과의 구조를 정의합니다.
 * blocks 배열에는 인식된 텍스트 블록들이 포함됩니다.
 */
export interface TesseractResult {
  /** OCR 인식 결과 데이터 */
  data: {
    /** 인식된 텍스트 블록들의 배열 */
    blocks: Tesseract.Block[]
  }
}

/**
 * OCR (광학 문자 인식) 기능을 제공하는 Vue Composable
 * 
 * 이 composable은 Tesseract.js를 사용하여 이미지에서 텍스트를 추출하는 기능을 제공합니다.
 * 한국어와 영어를 동시에 인식할 수 있으며, Worker 기반으로 백그라운드에서 처리됩니다.
 * 
 * 주요 기능:
 * 1. Tesseract Worker 초기화 및 관리
 * 2. 이미지에서 텍스트 인식
 * 3. 메모리 효율적인 Worker 생명주기 관리
 * 
 * 사용 패턴:
 * - initialize(): Worker 초기화 (자동으로 호출됨)
 * - recognize(): 이미지에서 텍스트 인식
 * - terminate(): Worker 정리 (메모리 해제)
 */
export function useOCR() {
  /** Tesseract Worker 인스턴스 (메모리 효율성을 위해 lazy initialization) */
  let worker: Tesseract.Worker | null = null

  /**
   * Tesseract Worker를 초기화합니다.
   * 
   * 이 메서드는 한국어와 영어를 동시에 인식할 수 있는 Worker를 생성합니다.
   * Worker는 한 번 생성되면 재사용되며, 메모리 효율성을 위해 필요할 때만 생성됩니다.
   * 
   * @returns Promise<void> - Worker 초기화 완료
   */
  async function initialize() {
    if (!worker) {
      // 한국어 + 영어 언어 모델로 Worker 생성
      worker = await Tesseract.createWorker('kor+eng')
    }
  }

  /**
   * Tesseract Worker를 종료하고 메모리를 해제합니다.
   * 
   * 이 메서드는 Worker가 사용하는 메모리를 해제하여 메모리 누수를 방지합니다.
   * 더 이상 OCR 기능을 사용하지 않을 때 호출해야 합니다.
   * 
   * @returns Promise<void> - Worker 종료 완료
   */
  async function terminate() {
    if (worker) {
      await worker.terminate()  // Worker 종료
      worker = null             
    }
  }

  /**
   * 이미지에서 텍스트를 인식합니다.
   * 
   * 이 메서드는 Canvas 요소의 이미지에서 텍스트를 추출합니다.
   * Worker가 아직 초기화되지 않은 경우 자동으로 초기화한 후 인식을 수행합니다.
   * 
   * 인식 과정:
   * 1. Worker 초기화 확인 (필요시 자동 초기화)
   * 2. Canvas 이미지에서 텍스트 블록 추출
   * 3. 구조화된 결과 반환
   * 
   * @param canvas - 텍스트를 인식할 이미지가 그려진 Canvas 요소
   * @returns Promise<TesseractResult> - 인식된 텍스트 블록들을 포함한 결과
   */
  async function recognize(canvas: HTMLCanvasElement) {
    // Worker가 없으면 자동으로 초기화
    if (!worker) await initialize()
    
    // 텍스트 인식 수행 (blocks 옵션으로 구조화된 결과 요청)
    return await worker!.recognize(canvas, {}, { blocks: true }) as TesseractResult
  }

  return { initialize, terminate, recognize }
} 