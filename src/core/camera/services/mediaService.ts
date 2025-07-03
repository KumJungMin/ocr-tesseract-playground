export type GetUserMediaFn = (constraints: MediaStreamConstraints) => Promise<MediaStream>

export const defaultGetUserMedia: GetUserMediaFn = (constraints) => {
  return navigator.mediaDevices.getUserMedia(constraints)
} 