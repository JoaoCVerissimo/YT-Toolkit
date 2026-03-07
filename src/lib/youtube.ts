import ytdl from '@distube/ytdl-core'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

type YtdlFormat = {
  hasVideo?: boolean
  hasAudio?: boolean
  qualityLabel?: string | null
  container?: string | null
  contentLength?: string | null
  bitrate?: number | null
  audioBitrate?: number | null
}

type AudioQuality = '64k' | '128k' | '192k' | '256k' | '320k'
type VideoQuality = '144' | '240' | '360' | '480' | '720' | '1080' | '1440' | '2160' | 'best'
type VideoProfile = 'compatible' | 'best'

const AUDIO_QUALITIES: AudioQuality[] = ['64k', '128k', '192k', '256k', '320k']
const VIDEO_QUALITIES: VideoQuality[] = [
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

type YtDlpFormat = {
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

type YtDlpSubtitleTrack = {
  ext?: string
  url?: string
}

type YtDlpInfo = {
  duration?: number | null
  formats?: YtDlpFormat[]
  thumbnail?: string | null
  thumbnails?: Array<{ url?: string | null }>
  title?: string | null
  subtitles?: Record<string, YtDlpSubtitleTrack[]>
  automatic_captions?: Record<string, YtDlpSubtitleTrack[]>
}

function getYtDlpPath(): string {
  const candidate = join(
    process.cwd(),
    'node_modules',
    'youtube-dl-exec',
    'bin',
    'yt-dlp',
  )

  return existsSync(candidate) ? candidate : 'yt-dlp'
}

async function getYtDlpInfo(url: string): Promise<YtDlpInfo | null> {
  return await new Promise((resolve) => {
    const child = spawn(getYtDlpPath(), [
      '--dump-single-json',
      '--no-warnings',
      '--no-playlist',
      url,
    ])

    let stdout = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    child.once('close', (code) => {
      if (code !== 0) {
        resolve(null)
        return
      }

      try {
        resolve(JSON.parse(stdout) as YtDlpInfo)
      } catch {
        resolve(null)
      }
    })

    child.once('error', () => {
      resolve(null)
    })
  })
}

function formatBytes(bytes: number): string {
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

function extractQualityHeight(qualityLabel?: string | null): number {
  if (!qualityLabel) return 0
  const match = qualityLabel.match(/(\d{3,4})p/)
  return match ? Number.parseInt(match[1], 10) : 0
}

function estimateAudioSize(
  durationSeconds: number,
  bitrateKbps: number,
): string {
  const bytes = (durationSeconds * bitrateKbps * 1000) / 8
  return formatBytes(bytes)
}

function estimateMp4Size(formats: YtdlFormat[]): string {
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

function getYtDlpHeight(format: YtDlpFormat): number {
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

function getYtDlpHighestQuality(formats: YtDlpFormat[]): string {
  const best = formats
    .filter((format) => hasVideoCodec(format))
    .sort((left, right) => getYtDlpHeight(right) - getYtDlpHeight(left))[0]

  const height = best ? getYtDlpHeight(best) : 0
  return height > 0 ? `${height}p` : 'Unknown'
}

function estimateMp4SizeFromYtDlp(
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

function estimateMp4SizeForSelection(
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

  // Mirror yt-dlp's fallback chain: preferred codec/container → any mp4 → any format
  const filterChain: Array<(f: YtDlpFormat) => boolean> =
    videoProfile === 'compatible'
      ? [isCompatibleVideoFormat, (f) => f.ext === 'mp4', () => true]
      : [(f) => f.ext === 'mp4', () => true]

  for (const filter of filterChain) {
    const videoCandidates = heightFiltered.filter(filter).sort((left, right) => {
      const heightDiff = getYtDlpHeight(right) - getYtDlpHeight(left)
      if (heightDiff !== 0) return heightDiff
      return (
        getYtDlpFormatSize(right, durationSeconds) -
        getYtDlpFormatSize(left, durationSeconds)
      )
    })

    if (videoCandidates.length === 0) continue

    // Prefer video-only + audio (matches yt-dlp's bestvideo+bestaudio selectors)
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

    // Fallback to muxed format if no separate streams available
    const muxed = videoCandidates.find((format) => hasAudioCodec(format))
    if (muxed) {
      const size = getYtDlpFormatSize(muxed, durationSeconds)
      if (size > 0) return formatBytes(size)
    }
  }

  return 'Unknown'
}

function getAvailableFormats(info: unknown): YtdlFormat[] {
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

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function cleanVideoUrl(url: string): string {
  const videoId = extractVideoId(url)
  if (!videoId) throw new Error('Invalid YouTube URL')
  return `https://www.youtube.com/watch?v=${videoId}`
}

// --- Video info via ytdl-core ---

export async function getVideoInfo(url: string): Promise<{
  title: string
  duration: string
  durationSeconds: number
  thumbnail: string
  highestQuality: string
  estimatedMp3Size: string
  estimatedMp4Size: string
  estimatedMp3Sizes: Record<AudioQuality, string>
  estimatedMp4Sizes: Record<VideoProfile, Record<VideoQuality, string>>
}> {
  const cleanUrl = cleanVideoUrl(url)
  const ytDlpInfo = await getYtDlpInfo(cleanUrl)
  const basicInfo = await ytdl.getBasicInfo(cleanUrl)
  let info = basicInfo

  try {
    info = await ytdl.getInfo(cleanUrl)
  } catch {
    info = basicInfo
  }
  const details = info.videoDetails
  const formats = getAvailableFormats(info)

  const totalSeconds = parseInt(details.lengthSeconds, 10)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const duration =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${minutes}:${String(seconds).padStart(2, '0')}`

  const thumbnails = details.thumbnails
  const thumbnail =
    ytDlpInfo?.thumbnail ||
    ytDlpInfo?.thumbnails?.[ytDlpInfo.thumbnails.length - 1]?.url ||
    (thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : '')

  const highestQuality = ytDlpInfo?.formats?.length
    ? getYtDlpHighestQuality(ytDlpInfo.formats)
    : formats
        .filter((format) => format.hasVideo && format.qualityLabel)
        .sort(
          (left, right) =>
            extractQualityHeight(right.qualityLabel) -
            extractQualityHeight(left.qualityLabel),
        )[0]?.qualityLabel

  const estimatedMp3Size = estimateAudioSize(totalSeconds, 192)
  const estimatedMp4Size = ytDlpInfo?.formats?.length
    ? estimateMp4SizeFromYtDlp(ytDlpInfo.formats, totalSeconds)
    : estimateMp4Size(formats)
  const estimatedMp3Sizes = Object.fromEntries(
    AUDIO_QUALITIES.map((quality) => [
      quality,
      estimateAudioSize(totalSeconds, Number.parseInt(quality, 10)),
    ]),
  ) as Record<AudioQuality, string>
  const estimatedMp4Sizes = {
    compatible: Object.fromEntries(
      VIDEO_QUALITIES.map((quality) => [
        quality,
        ytDlpInfo?.formats?.length
          ? estimateMp4SizeForSelection(
              ytDlpInfo.formats,
              totalSeconds,
              quality,
              'compatible',
            )
          : estimatedMp4Size,
      ]),
    ) as Record<VideoQuality, string>,
    best: Object.fromEntries(
      VIDEO_QUALITIES.map((quality) => [
        quality,
        ytDlpInfo?.formats?.length
          ? estimateMp4SizeForSelection(
              ytDlpInfo.formats,
              totalSeconds,
              quality,
              'best',
            )
          : estimatedMp4Size,
      ]),
    ) as Record<VideoQuality, string>,
  } satisfies Record<VideoProfile, Record<VideoQuality, string>>

  return {
    title: ytDlpInfo?.title || details.title,
    duration,
    durationSeconds: totalSeconds,
    thumbnail,
    highestQuality: highestQuality || 'Unknown',
    estimatedMp3Size,
    estimatedMp4Size,
    estimatedMp3Sizes,
    estimatedMp4Sizes,
  }
}

// --- Transcript fetching via yt-dlp ---

const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
}

export async function getTranscript(videoId: string): Promise<string> {
  const url = `https://www.youtube.com/watch?v=${videoId}`

  // Use yt-dlp to get subtitle info via JSON metadata
  const info = await new Promise<YtDlpInfo | null>((resolve) => {
    const child = spawn(getYtDlpPath(), [
      '--dump-single-json',
      '--no-warnings',
      '--no-playlist',
      url,
    ])

    let stdout = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.once('close', (code) => {
      if (code !== 0) { resolve(null); return }
      try { resolve(JSON.parse(stdout) as YtDlpInfo) } catch { resolve(null) }
    })
    child.once('error', () => resolve(null))
  })

  if (!info) {
    throw new Error(`Failed to get video info for: ${videoId}`)
  }

  // Look for subtitles: prefer manual captions, then auto-generated
  const subs = info.subtitles || {}
  const autoSubs = info.automatic_captions || {}

  // Find English caption URL (manual first, then auto)
  let captionUrl: string | null = null
  for (const source of [subs, autoSubs]) {
    const enTracks = source['en'] || source['en-US'] || source['en-GB']
    if (enTracks?.length) {
      // Prefer srv1 (XML) format, fall back to first available
      const srv1 = enTracks.find((t: { ext?: string }) => t.ext === 'srv1')
      captionUrl = srv1?.url || enTracks[0]?.url || null
      if (captionUrl) break
    }
  }

  // If no English, try first available language
  if (!captionUrl) {
    for (const source of [subs, autoSubs]) {
      const langs = Object.keys(source)
      if (langs.length > 0) {
        const tracks = source[langs[0]]
        if (tracks?.length) {
          const srv1 = tracks.find((t: { ext?: string }) => t.ext === 'srv1')
          captionUrl = srv1?.url || tracks[0]?.url || null
          if (captionUrl) break
        }
      }
    }
  }

  if (!captionUrl) {
    throw new Error(`No transcript available for: ${videoId}`)
  }

  const response = await fetch(captionUrl)
  if (!response.ok) {
    throw new Error(`Failed to download transcript for: ${videoId}`)
  }

  const text = await response.text()

  // Try XML format first (srv1)
  const xmlMatches = [...text.matchAll(RE_XML_TRANSCRIPT)]
  if (xmlMatches.length > 0) {
    return xmlMatches.map((m) => decodeHtmlEntities(m[3])).join(' ')
  }

  // Fall back to JSON3 or plain text
  try {
    const json = JSON.parse(text)
    const events = json.events || []
    return events
      .filter((e: { segs?: Array<{ utf8?: string }> }) => e.segs)
      .flatMap((e: { segs: Array<{ utf8?: string }> }) =>
        e.segs.map((s) => s.utf8 || ''),
      )
      .join('')
      .replace(/\n/g, ' ')
      .trim()
  } catch {
    // Plain text subtitle
    const cleaned = text.replace(/\d+\n[\d:,.-]+ --> [\d:,.-]+\n/g, '').trim()
    if (!cleaned) {
      throw new Error(`Transcript is empty for: ${videoId}`)
    }
    return cleaned.replace(/\n/g, ' ')
  }
}
