type AudioQuality = '64k' | '128k' | '192k' | '256k' | '320k'

export type { AudioQuality }

export const AUDIO_QUALITIES: AudioQuality[] = [
  '64k',
  '128k',
  '192k',
  '256k',
  '320k',
]

// ---------------------------------------------------------------------------
// Byte formatting
// ---------------------------------------------------------------------------

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Unknown'

  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }

  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

// ---------------------------------------------------------------------------
// Size estimation
// ---------------------------------------------------------------------------

export function estimateAudioSize(
  durationSeconds: number,
  bitrateKbps: number,
): string {
  const bytes = (durationSeconds * bitrateKbps * 1000) / 8
  return formatBytes(bytes)
}
