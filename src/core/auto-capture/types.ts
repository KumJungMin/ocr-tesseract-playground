import type { AutoCaptureOptions } from '@/core/libs/opencv/idCardDetector';

export enum AutoCaptureStatus {
  Idle = 'idle',
  Initializing = 'initializing',
  Detecting = 'detecting',
  TargetFound = 'target-found',
  Error = 'error',
}

export type { AutoCaptureOptions }; 