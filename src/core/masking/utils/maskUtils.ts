import type { Word, Pattern, MaskRegion } from '../types';
import { combineWords } from './textUtils';

export function createMaskRegion(
  text: string,
  bbox: { x0: number; y0: number; x1: number; y1: number },
  pattern: Pattern,
): MaskRegion | null {
  const totalW = bbox.x1 - bbox.x0;
  const charW = totalW / text.length;

  return {
    x: bbox.x0 + charW * pattern.startIndex,
    y: bbox.y0,
    w: pattern.blurCount === 0 ? totalW : charW * pattern.blurCount,
    h: bbox.y1 - bbox.y0,
  };
}

export function findMaskRegions(words: Word[], patterns: Pattern[]): MaskRegion[] {
  const regions: MaskRegion[] = [];
  for (let i = 0; i < words.length; i++) {
    const { combinedText, combinedBbox, nextIndex } = combineWords(words, i);
    if (!combinedText) continue;

    const p = patterns.find((pat) => pat.regex.test(combinedText));
    if (p) {
      const region = createMaskRegion(combinedText, combinedBbox, p);
      if (region) {
        regions.push(region);
        i = nextIndex;
      }
    }
  }
  return regions;
}

export function applyBlur(ctx: CanvasRenderingContext2D, region: MaskRegion) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(region.x, region.y, region.w, region.h);
} 