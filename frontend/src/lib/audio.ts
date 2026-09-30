// Audio processing utilities for real-time visualization and VAD

export function calculateRMS(dataArray: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const val = (dataArray[i] - 128) / 128;
    sum += val * val;
  }
  return Math.sqrt(sum / dataArray.length);
}

export function normalizeVolume(rms: number, maxThreshold = 0.4): number {
  return Math.min(1.0, rms / maxThreshold);
}
