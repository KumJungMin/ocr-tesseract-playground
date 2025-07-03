import { ref } from 'vue';
import type { TesseractResult } from '@/core/ocr/useOCR';
import type { MaskingStatus, Word } from './types';
import { detectDocumentType } from './utils/documentDetector';
import { getApplicablePatterns } from './patterns';
import { extractWords } from './utils/textUtils';
import { findMaskRegions, applyBlur } from './utils/maskUtils';

/**
 * 텍스트 마스킹 기능을 제공하는 Vue Composable
 * 
 * 이 composable은 OCR 결과를 분석하여 민감한 개인정보를 자동으로 감지하고
 * Canvas에 블러 효과를 적용하여 마스킹하는 기능을 제공합니다.
 * 
 * 주요 기능:
 * 1. OCR 결과에서 텍스트 추출 및 분석
 * 2. 문서 유형 자동 감지 (신분증, 운전면허증 등)
 * 3. 민감한 정보 영역 자동 감지
 * 4. Canvas에 블러 효과 적용
 * 5. 실시간 상태 모니터링
 * 
 * 마스킹 과정:
 * 1. OCR 결과에서 단어 추출
 * 2. 문서 유형 감지
 * 3. 해당 문서 유형의 마스킹 패턴 적용
 * 4. 민감한 정보 영역 찾기
 * 5. Canvas에 블러 효과 적용
 * 
 * 상태 관리:
 * - idle: 마스킹 작업 대기 중
 * - detecting: 문서 유형 감지 중
 * - masking: 마스킹 적용 중
 * - error: 오류 발생
 * 
 * @returns 마스킹 관련 함수들과 상태 객체
 */
export function useMasking() {
  /** 마스킹 작업 현재 상태 */
  const status = ref<MaskingStatus>('idle');
  /** 마스킹 관련 오류 정보 */
  const error = ref<Error | null>(null);

  /**
   * Canvas에 마스킹을 적용합니다.
   * 
   * 이 메서드는 OCR 결과를 분석하여 민감한 개인정보를 자동으로 감지하고
   * 해당 영역에 블러 효과를 적용하여 마스킹합니다.
   * 
   * 마스킹 적용 과정:
   * 1. OCR 결과에서 단어 추출
   * 2. 문서 유형 자동 감지 (신분증, 운전면허증 등)
   * 3. 해당 문서 유형의 마스킹 패턴 가져오기
   * 4. 민감한 정보 영역 찾기
   * 5. Canvas에 블러 효과 적용
   * 
   * @param ctx - 마스킹을 적용할 Canvas 컨텍스트
   * @param ocrData - OCR 인식 결과 데이터
   * @returns Promise<void> - 마스킹 적용 완료
   */
  async function applyMask(
    ctx: CanvasRenderingContext2D,
    ocrData: TesseractResult,
  ) {
    try {
      // 1단계: 문서 유형 감지
      status.value = 'detecting';
      const words = extractWords(ocrData.data.blocks);
      const docType = detectDocumentType(words.map((w: Word) => w.text).join(' '));
      const patterns = docType ? getApplicablePatterns(docType) : [];

      // 2단계: 마스킹 적용
      status.value = 'masking';
      const regions = findMaskRegions(words, patterns);
      regions.forEach((r) => applyBlur(ctx, r));
      
      // 3단계: 완료
      status.value = 'idle';
    } catch (e: any) {
      // 오류 처리
      status.value = 'error';
      error.value = e instanceof Error ? e : new Error('Unknown masking error');
      console.error(e);
    }
  }

  return {
    /** 마스킹 작업 현재 상태 (반응형) */
    status,

    /** 마스킹 관련 오류 정보 (반응형) */
    error,

    /** Canvas에 마스킹을 적용하는 함수 */
    applyMask,

    /** 문서 유형을 감지하는 함수 */
    detectDocumentType,

    /** 문서 유형에 적용 가능한 마스킹 패턴을 가져오는 함수 */
    getApplicablePatterns,

    /** 민감한 정보 영역을 찾는 함수 */
    findMaskRegions,
    
    /** OCR 결과에서 단어를 추출하는 함수 */
    extractWords,
  };
} 