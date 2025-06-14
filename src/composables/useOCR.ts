import Tesseract from 'tesseract.js'

export interface TesseractResult {
  data: {
    blocks: Tesseract.Block[]
  }
}

export function useOCR() {
  let worker: Tesseract.Worker | null = null

  async function initialize() {
    if (!worker) {
      worker = await Tesseract.createWorker('kor+eng')
    }
  }

  async function terminate() {
    if (worker) {
      await worker.terminate()
      worker = null
    }
  }

  async function recognize(canvas: HTMLCanvasElement) {
    if (!worker) await initialize()
    return await worker!.recognize(canvas, {}, { blocks: true }) as TesseractResult
  }

  return { initialize, terminate, recognize }
} 