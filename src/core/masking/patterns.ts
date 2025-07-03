import type { Pattern, DocumentType } from './types';

export const patternList: Pattern[] = [
  {
    regex: /^\d{6}-\d{7}$/, // 주민등록번호
    blurCount: 7,
    startIndex: 7,
    type: '주민등록번호',
    documents: ['주민등록증', '운전면허증'],
  },
  {
    regex: /^\d{2}-\d{2}-\d{6}-\d{2}$/, // 운전면허번호
    blurCount: 6,
    startIndex: 6,
    type: '운전면허번호',
    documents: ['운전면허증'],
  },
  {
    regex: /^[A-Z]\d{8}$/, // 여권번호 (예: M12345678)
    blurCount: 4,
    startIndex: 5,
    type: '여권번호',
    documents: ['여권'],
  },
];

export function getApplicablePatterns(type: DocumentType): Pattern[] {
  return patternList.filter((p) => p.documents.includes(type));
} 