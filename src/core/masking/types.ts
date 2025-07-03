export type DocumentType = '주민등록증' | '여권' | '운전면허증';

export interface Word {
  text: string;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

export interface Pattern {
  regex: RegExp;
  blurCount: number; // 마스킹할 글자 수 (0이면 전체)
  startIndex: number; // 마스킹 시작 인덱스(0-based)
  type: string; // 패턴 의미(주민등록번호 등)
  documents: DocumentType[]; // 해당되는 문서 유형
}

export interface MaskRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type MaskingStatus = 'idle' | 'detecting' | 'masking' | 'error'; 