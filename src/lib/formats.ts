type AudioQuality = '64k' | '128k' | '192k' | '256k' | '320k'
type VideoQuality =
  | '144'
  | '240'
  | '360'
  | '480'
  | '720'
  | '1080'
  | '1440'
  | '2160'
  | 'best'
type VideoProfile = 'compatible' | 'best'

export type { AudioQuality, VideoQuality, VideoProfile }

export const AUDIO_QUALITIES: AudioQuality[] = [
  '64k',
  '128k',
  '192k',
  '256k',
  '320k',
]
export const VIDEO_QUALITIES: VideoQuality[] = [
  '144',
  '240',
  '360',
  '480',
  '720',
  '1080',
  '1440',
  '2160',
  'best',
]

// ---------------------------------------------------------------------------
// ytdl-core format types
// ---------------------------------------------------------------------------

export type YtdlFormat = {
  hasVideo?: boolean
  hasAudio?: boolean
  qualityLabel?: string | null
  container?: string | null
  contentLength?: string | null
  bitrate?: number | null
  audioBitrate?: number | null
}

// ---------------------------------------------------------------------------
// yt-dlp format types
// ---------------------------------------------------------------------------

export type YtDlpFormat = {
  acodec?: string | null
  abr?: number | null
  audio_ext?: string | null
  ext?: string | null
  filesize?: number | null
  filesize_approx?: number | null
  format_note?: string | null
  height?: number | null
  resolution?: string | null
  tbr?: number | null
  vbr?: number | null
  vcodec?: string | null
}

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
// Audio size estimation
// ---------------------------------------------------------------------------

export function estimateAudioSize(
  durationSeconds: number,
  bitrateKbps: number,
): string {
  const bytes = (durationSeconds * bitrateKbps * 1000) / 8
  return formatBytes(bytes)
}

// ---------------------------------------------------------------------------
// ytdl-core helpers
// ---------------------------------------------------------------------------

export function extractQualityHeight(qualityLabel?: string | null): number {
  if (!qualityLabel) return 0
  const match = qualityLabel.match(/(\d{3,4})p/)
  return match ? Number.parseInt(match[1], 10) : 0
}

export function estimateMp4Size(formats: YtdlFormat[]): string {
  const compatibleVideoFormats = formats.filter(
    (format) =>
      format.hasVideo &&
      !format.hasAudio &&
      format.container === 'mp4' &&
      format.qualityLabel,
  )
  const compatibleAudioFormats = formats.filter(
    (format) =>
      format.hasAudio && !format.hasVideo && format.container === 'm4a',
  )

  const bestVideo = compatibleVideoFormats.sort(
    (left, right) =>
      extractQualityHeight(right.qualityLabel) -
      extractQualityHeight(left.qualityLabel),
  )[0]
  const bestAudio = compatibleAudioFormats.sort(
    (left, right) => (right.audioBitrate || 0) - (left.audioBitrate || 0),
  )[0]

  const videoBytes = Number.parseInt(bestVideo?.contentLength || '0', 10)
  const audioBytes = Number.parseInt(bestAudio?.contentLength || '0', 10)
  const total = videoBytes + audioBytes

  return total > 0 ? formatBytes(total) : 'Unknown'
}

export function getAvailableFormats(info: unknown): YtdlFormat[] {
  const maybeInfo = info as {
    formats?: YtdlFormat[]
    player_response?: {
      streamingData?: {
        formats?: YtdlFormat[]
        adaptiveFormats?: YtdlFormat[]
      }
    }
  }

  if (Array.isArray(maybeInfo.formats) && maybeInfo.formats.length > 0) {
    return maybeInfo.formats
  }

  const streamingFormats =
    maybeInfo.player_response?.streamingData?.formats || []
  const adaptiveFormats =
    maybeInfo.player_response?.streamingData?.adaptiveFormats || []

  return [...streamingFormats, ...adaptiveFormats]
}

// ---------------------------------------------------------------------------
// yt-dlp helpers
// ---------------------------------------------------------------------------

function getEstimatedBytesFromKbps(
  durationSeconds: number,
  bitrateKbps?: number | null,
): number {
  if (!bitrateKbps || bitrateKbps <= 0) return 0
  return Math.round((durationSeconds * bitrateKbps * 1000) / 8)
}

function getYtDlpFormatSize(
  format: YtDlpFormat,
  durationSeconds: number,
): number {
  return (
    format.filesize ||
    format.filesize_approx ||
    getEstimatedBytesFromKbps(
      durationSeconds,
      format.tbr || format.vbr || format.abr,
    ) ||
    0
  )
}

export function getYtDlpHeight(format: YtDlpFormat): number {
  if (typeof format.height === 'number') {
    return format.height
  }

  if (format.resolution) {
    const match = format.resolution.match(/(\d{3,4})x(\d{3,4})/)
    if (match) {
      return Number.parseInt(match[2], 10)
    }
  }

  if (format.format_note) {
    const match = format.format_note.match(/(\d{3,4})p/)
    if (match) {
      return Number.parseInt(match[1], 10)
    }
  }

  return 0
}

function hasVideoCodec(format: YtDlpFormat): boolean {
  return Boolean(format.vcodec && format.vcodec !== 'none')
}

function hasAudioCodec(format: YtDlpFormat): boolean {
  return Boolean(format.acodec && format.acodec !== 'none')
}

function isCompatibleVideoFormat(format: YtDlpFormat): boolean {
  return (
    format.ext === 'mp4' &&
    Boolean(
      format.vcodec?.startsWith('avc1') || format.vcodec?.startsWith('h264'),
    )
  )
}

function isCompatibleAudioFormat(format: YtDlpFormat): boolean {
  return (
    (format.audio_ext === 'm4a' || format.ext === 'm4a') &&
    Boolean(
      format.acodec?.startsWith('mp4a') || format.acodec?.startsWith('aac'),
    )
  )
}

export function getYtDlpHighestQuality(formats: YtDlpFormat[]): string {
  const best = formats
    .filter((format) => hasVideoCodec(format))
    .sort((left, right) => getYtDlpHeight(right) - getYtDlpHeight(left))[0]

  const height = best ? getYtDlpHeight(best) : 0
  return height > 0 ? `${height}p` : 'Unknown'
}

export function estimateMp4SizeFromYtDlp(
  formats: YtDlpFormat[],
  durationSeconds: number,
): string {
  const muxed = formats
    .filter(
      (format) =>
        hasVideoCodec(format) && hasAudioCodec(format) && format.ext === 'mp4',
    )
    .sort((left, right) => getYtDlpHeight(right) - getYtDlpHeight(left))[0]

  if (muxed) {
    const muxedSize = getYtDlpFormatSize(muxed, durationSeconds)
    if (muxedSize > 0) {
      return formatBytes(muxedSize)
    }
  }

  const video = formats
    .filter(
      (format) =>
        hasVideoCodec(format) && !hasAudioCodec(format) && format.ext === 'mp4',
    )
    .sort((left, right) => getYtDlpHeight(right) - getYtDlpHeight(left))[0]
  const audio = formats
    .filter(
      (format) =>
        hasAudioCodec(format) &&
        !hasVideoCodec(format) &&
        format.audio_ext === 'm4a',
    )
    .sort(
      (left, right) =>
        getYtDlpFormatSize(right, durationSeconds) -
        getYtDlpFormatSize(left, durationSeconds),
    )[0]

  const total =
    getYtDlpFormatSize(
      video || { filesize: 0, filesize_approx: 0 },
      durationSeconds,
    ) +
    getYtDlpFormatSize(
      audio || { filesize: 0, filesize_approx: 0 },
      durationSeconds,
    )
  return total > 0 ? formatBytes(total) : 'Unknown'
}

export function estimateMp4SizeForSelection(
  formats: YtDlpFormat[],
  durationSeconds: number,
  videoQuality: VideoQuality,
  videoProfile: VideoProfile,
): string {
  const maxHeight =
    videoQuality === 'best'
      ? Number.POSITIVE_INFINITY
      : Number.parseInt(videoQuality, 10)

  const heightFiltered = formats
    .filter((format) => hasVideoCodec(format))
    .filter((format) => {
      const height = getYtDlpHeight(format)
      return height === 0 || height <= maxHeight
    })

  const filterChain: Array<(f: YtDlpFormat) => boolean> =
    videoProfile === 'compatible'
      ? [isCompatibleVideoFormat, (f) => f.ext === 'mp4', () => true]
      : [(f) => f.ext === 'mp4', () => true]

  for (const filter of filterChain) {
    const videoCandidates = heightFiltered
      .filter(filter)
      .sort((left, right) => {
        const heightDiff = getYtDlpHeight(right) - getYtDlpHeight(left)
        if (heightDiff !== 0) return heightDiff
        return (
          getYtDlpFormatSize(right, durationSeconds) -
          getYtDlpFormatSize(left, durationSeconds)
        )
      })

    if (videoCandidates.length === 0) continue

    const videoOnly = videoCandidates.find((format) => !hasAudioCodec(format))
    if (videoOnly) {
      const audio = formats
        .filter((format) => hasAudioCodec(format) && !hasVideoCodec(format))
        .filter((format) =>
          videoProfile === 'compatible'
            ? isCompatibleAudioFormat(format)
            : true,
        )
        .sort(
          (left, right) =>
            getYtDlpFormatSize(right, durationSeconds) -
            getYtDlpFormatSize(left, durationSeconds),
        )[0]

      const total =
        getYtDlpFormatSize(videoOnly, durationSeconds) +
        getYtDlpFormatSize(
          audio || { filesize: 0, filesize_approx: 0 },
          durationSeconds,
        )
      if (total > 0) return formatBytes(total)
    }

    const muxed = videoCandidates.find((format) => hasAudioCodec(format))
    if (muxed) {
      const size = getYtDlpFormatSize(muxed, durationSeconds)
      if (size > 0) return formatBytes(size)
    }
  }

  return 'Unknown'
}
