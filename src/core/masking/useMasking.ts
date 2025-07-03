import { ref } from 'vue';
import type { TesseractResult } from '@/core/composables/useOCR';
import type { MaskingStatus, Word } from './types';
import { detectDocumentType } from './utils/documentDetector';
import { getApplicablePatterns } from './patterns';
import { extractWords } from './utils/textUtils';
import { findMaskRegions, applyBlur } from './utils/maskUtils';

export function useMasking() {
  const status = ref<MaskingStatus>('idle');
  const error = ref<Error | null>(null);

  async function applyMask(
    ctx: CanvasRenderingContext2D,
    ocrData: TesseractResult,
  ) {
    try {
      status.value = 'detecting';
      const words = extractWords(ocrData.data.blocks);
      const docType = detectDocumentType(words.map((w: Word) => w.text).join(' '));
      const patterns = docType ? getApplicablePatterns(docType) : [];

      status.value = 'masking';
      const regions = findMaskRegions(words, patterns);
      regions.forEach((r) => applyBlur(ctx, r));
      status.value = 'idle';
    } catch (e: any) {
      status.value = 'error';
      error.value = e instanceof Error ? e : new Error('Unknown masking error');
      console.error(e);
    }
  }

  return {
    status,
    error,
    applyMask,
    detectDocumentType,
    getApplicablePatterns,
    findMaskRegions,
    extractWords,
  };
} 