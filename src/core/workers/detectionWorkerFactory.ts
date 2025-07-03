import DetectionWorker from '@/core/libs/opencv/workers/detection.worker?worker';

export type DetectionWorkerFactory = () => Worker;

export const defaultDetectionWorkerFactory: DetectionWorkerFactory = () => new DetectionWorker(); 