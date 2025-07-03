import DetectionWorker from '@/core/auto-capture/workers/detection.worker?worker';

export type DetectionWorkerFactory = () => Worker;

export const defaultDetectionWorkerFactory: DetectionWorkerFactory = () => new DetectionWorker(); 