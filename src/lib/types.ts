export type DownloadMode = 'fast' | 'follow'
export type AudioQuality = '64k' | '128k' | '192k' | '256k' | '320k'
export type VideoQuality =
  | '144'
  | '240'
  | '360'
  | '480'
  | '720'
  | '1080'
  | '1440'
  | '2160'
  | 'best'
export type VideoProfile = 'compatible' | 'best'
export type AudioFormat = 'mp3' | 'm4a' | 'webm'

export interface VideoInfo {
  videoId: string
  title: string
  duration: string
  durationSeconds: number
  thumbnail: string
  highestQuality: string
  estimatedMp3Size: string
  estimatedMp4Size: string
  estimatedMp3Sizes: Record<AudioQuality, string>
  estimatedMp4Sizes: Record<VideoProfile, Record<VideoQuality, string>>
}

export interface IdentifiedTrack {
  title: string
  artist: string
  context?: string
}

export interface SummaryData {
  summary: string
  keyPoints: string[]
  transcript?: string
}

export const AUDIO_QUALITY_OPTIONS: Array<{
  value: AudioQuality
  label: string
}> = [
  { value: '64k', label: '64 kbps (lowest)' },
  { value: '128k', label: '128 kbps' },
  { value: '192k', label: '192 kbps (default)' },
  { value: '256k', label: '256 kbps' },
  { value: '320k', label: '320 kbps (highest)' },
]

export const AUDIO_FORMAT_OPTIONS: Array<{
  value: AudioFormat
  label: string
  description: string
}> = [
  {
    value: 'mp3',
    label: 'MP3 (converted)',
    description:
      'Converted from source audio. Universally compatible but slower to prepare.',
  },
  {
    value: 'm4a',
    label: 'M4A (original)',
    description:
      'Original AAC audio in MP4 container. Fast download, no conversion needed. Plays on most devices.',
  },
  {
    value: 'webm',
    label: 'WebM (original)',
    description:
      'Original Opus audio in WebM container. Fast download, best quality per bitrate but less compatible.',
  },
]

export const VIDEO_QUALITY_OPTIONS: Array<{
  value: VideoQuality
  label: string
}> = [
  { value: '144', label: '144p (lowest)' },
  { value: '240', label: '240p' },
  { value: '360', label: '360p' },
  { value: '480', label: '480p' },
  { value: '720', label: '720p' },
  { value: '1080', label: '1080p' },
  { value: '1440', label: '1440p (2K)' },
  { value: '2160', label: '2160p (4K)' },
  { value: 'best', label: 'Best available (default)' },
]

export const VIDEO_PROFILE_OPTIONS: Array<{
  value: VideoProfile
  label: string
  description: string
}> = [
  {
    value: 'compatible',
    label: 'Highest compatibility',
    description:
      'Prefers broadly compatible H.264 video with AAC audio inside MP4 containers.',
  },
  {
    value: 'best',
    label: 'Best available',
    description:
      'Prefers the highest available MP4 quality, even when codecs vary across devices and apps.',
  },
]

export function getVideoQualityLabel(value: VideoQuality): string {
  return (
    VIDEO_QUALITY_OPTIONS.find((option) => option.value === value)?.label ||
    value
  )
}

export function getAudioQualityLabel(value: AudioQuality): string {
  return (
    AUDIO_QUALITY_OPTIONS.find((option) => option.value === value)?.label ||
    value
  )
}

export function getVideoProfileLabel(value: VideoProfile): string {
  return (
    VIDEO_PROFILE_OPTIONS.find((option) => option.value === value)?.label ||
    value
  )
}

export function getBrowserModeLabel(value: DownloadMode): string {
  return value === 'follow' ? 'Browser follow (streaming)' : 'Fastest delivery'
}
