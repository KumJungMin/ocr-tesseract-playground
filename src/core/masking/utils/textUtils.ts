import type { Word } from '../types';
import type { TesseractResult } from '@/core/ocr/useOCR';

/**
 * OCR 데이터에서 단어(flat) 배열 추출
 */
export function extractWords(blocks: TesseractResult['data']['blocks']): Word[] {
  return (blocks as any[])
    .flatMap((block: any) => block.paragraphs)
    .flatMap((paragraph: any) => paragraph.lines)
    .flatMap((line: any) => line.words)
    .map((w: any) => ({ text: w.text, bbox: w.bbox }));
}

/** 최대 단어 결합 수 */
const MAX_WORDS_TO_COMBINE = 3;

export function canCombineWords(prevWord: Word, currentWord: Word): boolean {
  const yCenter1 = (prevWord.bbox.y0 + prevWord.bbox.y1) / 2;
  const yCenter2 = (currentWord.bbox.y0 + currentWord.bbox.y1) / 2;
  if (Math.abs(yCenter1 - yCenter2) > 10) return false;

  const gap = currentWord.bbox.x0 - prevWord.bbox.x1;
  const avgCharWidth =
    (prevWord.bbox.x1 - prevWord.bbox.x0) / prevWord.text.length;
  return gap <= avgCharWidth * 2;
}

export function combineWords(
  words: Word[],
  startIndex: number,
): {
  combinedText: string;
  combinedBbox: { x0: number; y0: number; x1: number; y1: number };
  nextIndex: number;
} {
  let combinedText = '';
  let combinedBbox = { x0: 0, y0: 0, x1: 0, y1: 0 };
  let isFirstCombine = true;
  let nextIndex = startIndex;

  for (let j = 0; j < MAX_WORDS_TO_COMBINE && startIndex + j < words.length; j++) {
    const currentWord = words[startIndex + j];
    if (!currentWord.text || !currentWord.bbox) continue;

    const cleanedText = currentWord.text.replace(/\s+/g, '');
    if (isFirstCombine) {
      combinedText = cleanedText;
      combinedBbox = { ...currentWord.bbox };
      isFirstCombine = false;
    } else {
      if (!canCombineWords(words[startIndex + j - 1], currentWord)) break;

      combinedText += cleanedText;
      combinedBbox.x1 = currentWord.bbox.x1;
      combinedBbox.y0 = Math.min(combinedBbox.y0, currentWord.bbox.y0);
      combinedBbox.y1 = Math.max(combinedBbox.y1, currentWord.bbox.y1);
    }
    nextIndex = startIndex + j;
  }

  return { combinedText, combinedBbox, nextIndex };
} 