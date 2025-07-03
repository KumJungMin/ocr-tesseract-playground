import type { TesseractResult } from './useOCR'

// TODO: 역할에 따라 파일 분리
export type DocumentType = '주민등록증' | '여권' | '운전면허증'
export interface Word {
  text: string
  bbox: {
    x0: number
    y0: number
    x1: number
    y1: number
  }
}
export interface Pattern {
  regex: RegExp
  blurCount: number
  startIndex: number
  type: string
  documents: DocumentType[]
}
export interface MaskRegion {
  x: number
  y: number
  w: number
  h: number
}

export function useMasking() {
  // 2) 전체 텍스트에서 문서 유형 식별
  function detectDocumentType(text: string): DocumentType | null {
    const upper = text.toUpperCase()
    const keywords: Record<DocumentType, string[]> = {
      '주민등록증': ['주민', '등록', '증'],
      '여권': ['PASSPORT', '여권'],
      '운전면허증': ['운전', '면허', '증', '운전면허', 'DRIVER', 'LICENSE']
    }
    let maxScore = 0
    let detected: DocumentType | null = null
    for (const type in keywords) {
      const score = keywords[type as DocumentType].reduce((sum, kw) => {
        if (upper.includes(kw)) return sum + 1
        const chars = kw.split('')
        const scattered = chars.every(c => upper.includes(c))
        return sum + (scattered ? 0.5 : 0)
      }, 0)
      if (score > maxScore) {
        maxScore = score
        detected = type as DocumentType
      }
    }
    return maxScore > 0 ? detected : null
  }

  // 3) 문서 유형에 맞는 패턴 필터링
  function getApplicablePatterns(type: DocumentType): Pattern[] {
    const patterns: Pattern[] = [
      {
        regex: /^\d{6}-\d{7}$/, blurCount: 7, startIndex: 7, type: '주민등록번호', documents: ['주민등록증', '운전면허증']
      },
      {
        regex: /^\d{2}-\d{2}-\d{6}-\d{2}$/, blurCount: 6, startIndex: 6, type: '운전면허번호', documents: ['운전면허증']
      },
      {
        regex: /^[A-Z]\d{8}$/, blurCount: 4, startIndex: 5, type: '여권번호', documents: ['여권']
      }
    ]
    return patterns.filter(p => p.documents.includes(type))
  }

  // 4) 단어 시퀀스에서 패턴 매칭 및 마스킹 좌표 계산
  function findMaskRegions(words: Word[], patterns: Pattern[]): MaskRegion[] {
    const regions: MaskRegion[] = []
    for (let i = 0; i < words.length; i++) {
      const { combinedText, combinedBbox, nextIndex } = combineWords(words, i)
      if (!combinedText) continue

      const p = patterns.find(pat => pat.regex.test(combinedText))
      if (p) {
        const region = createMaskRegion(combinedText, combinedBbox, p)
        if (region) {
          regions.push(region)
          i = nextIndex
        }
      }
    }
    return regions
  }

  function combineWords(words: Word[], startIndex: number): { 
    combinedText: string, 
    combinedBbox: { x0: number, y0: number, x1: number, y1: number },
    nextIndex: number 
  } {
    const MAX_WORDS_TO_COMBINE = 3
    let combinedText = ''
    let combinedBbox = { x0: 0, y0: 0, x1: 0, y1: 0 }
    let isFirstCombine = true
    let nextIndex = startIndex

    for (let j = 0; j < MAX_WORDS_TO_COMBINE && startIndex + j < words.length; j++) {
      const currentWord = words[startIndex + j]
      if (!currentWord.text || !currentWord.bbox) continue

      const cleanedText = currentWord.text.replace(/\s+/g, '')
      if (isFirstCombine) {
        combinedText = cleanedText
        combinedBbox = { ...currentWord.bbox }
        isFirstCombine = false
      } else {
        if (!canCombineWords(words[startIndex + j - 1], currentWord)) break
        
        combinedText += cleanedText
        combinedBbox.x1 = currentWord.bbox.x1
        combinedBbox.y0 = Math.min(combinedBbox.y0, currentWord.bbox.y0)
        combinedBbox.y1 = Math.max(combinedBbox.y1, currentWord.bbox.y1)
      }
      nextIndex = startIndex + j
    }

    return { combinedText, combinedBbox, nextIndex }
  }

  /**
   *  단어를 결합할 수 있는지 여부를 판단하는 함수
   *  - y 좌표 중심이 너무 멀리 떨어져 있지 않아야 함
   *  - 이전 단어와 현재 단어 사이의 간격이 평균 문자 너비의 2배 이하이어야 함
   *  - 이전 단어의 마지막 문자와 현재 단어의 첫 문자 사이에 공백이 없어야 함
   */ 
  function canCombineWords(prevWord: Word, currentWord: Word): boolean {
    const yCenter1 = (prevWord.bbox.y0 + prevWord.bbox.y1) / 2
    const yCenter2 = (currentWord.bbox.y0 + currentWord.bbox.y1) / 2
    if (Math.abs(yCenter1 - yCenter2) > 10) return false

    const gap = currentWord.bbox.x0 - prevWord.bbox.x1
    const avgCharWidth = (prevWord.bbox.x1 - prevWord.bbox.x0) / prevWord.text.length
    return gap <= avgCharWidth * 2
  }

  function createMaskRegion(
    text: string, 
    bbox: { x0: number, y0: number, x1: number, y1: number }, 
    pattern: Pattern,
  ): MaskRegion | null {
    const totalW = bbox.x1 - bbox.x0
    const charW = totalW / text.length

    return {
      x: bbox.x0 + (charW * pattern.startIndex),
      y: bbox.y0,
      w: pattern.blurCount === 0 ? totalW : (charW * pattern.blurCount),
      h: bbox.y1 - bbox.y0
    }
  }

  async function applyMask(ctx: CanvasRenderingContext2D, ocrData: TesseractResult) {
    const words = extractWords(ocrData.data.blocks)
    const docType = detectDocumentType(words.map(w=>w.text).join(' '))
    const patterns = docType ? getApplicablePatterns(docType) : []
    const regions = findMaskRegions(words, patterns)
    regions.forEach(r => applyBlur(ctx, r))
  }

  function applyBlur(ctx: CanvasRenderingContext2D, region: MaskRegion) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(region.x, region.y, region.w, region.h)
  }

  return { applyMask, detectDocumentType, getApplicablePatterns, findMaskRegions, extractWords }
} 

// 1) OCR 데이터에서 단어(flat) 추출
function extractWords(blocks: TesseractResult['data']['blocks']): Word[] {
  return (blocks as any[])
    .flatMap((block: any) => block.paragraphs)
    .flatMap((paragraph: any) => paragraph.lines)
    .flatMap((line: any) => line.words)
    .map((w: any) => ({ text: w.text, bbox: w.bbox }))
}