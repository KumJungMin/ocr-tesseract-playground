import type { DocumentType } from '../types';

/**
 * OCR 전체 텍스트를 기반으로 문서 유형을 추론합니다.
 * 점수 기반 매칭(키워드 포함 여부)으로 가장 높은 유형을 반환합니다.
 */
export function detectDocumentType(text: string): DocumentType | null {
  const upper = text.toUpperCase();
  const keywords: Record<DocumentType, string[]> = {
    주민등록증: ['주민', '등록', '증'],
    여권: ['PASSPORT', '여권'],
    운전면허증: ['운전', '면허', '증', '운전면허', 'DRIVER', 'LICENSE'],
  } as const;

  let maxScore = 0;
  let detected: DocumentType | null = null;

  (Object.keys(keywords) as DocumentType[]).forEach((type) => {
    const score = keywords[type].reduce((sum, kw) => {
      if (upper.includes(kw)) return sum + 1;
      const chars = kw.split('');
      const scattered = chars.every((c) => upper.includes(c));
      return sum + (scattered ? 0.5 : 0);
    }, 0);

    if (score > maxScore) {
      maxScore = score;
      detected = type;
    }
  });

  return maxScore > 0 ? detected : null;
} 