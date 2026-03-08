import ytdl from '@distube/ytdl-core'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import {
  AUDIO_QUALITIES,
  VIDEO_QUALITIES,
  estimateAudioSize,
  estimateMp4Size,
  estimateMp4SizeForSelection,
  estimateMp4SizeFromYtDlp,
  extractQualityHeight,
  getAvailableFormats,
  getYtDlpHighestQuality,
  type AudioQuality,
  type VideoProfile,
  type VideoQuality,
  type YtDlpFormat,
  type YtdlFormat,
} from './formats'

export { getTranscript } from './transcript'

// ---------------------------------------------------------------------------
// yt-dlp info fetching
// ---------------------------------------------------------------------------

type YtDlpInfo = {
  duration?: number | null
  formats?: YtDlpFormat[]
  thumbnail?: string | null
  thumbnails?: Array<{ url?: string | null }>
  title?: string | null
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
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.once('close', (code) => {
      if (code !== 0) {
        console.error('[yt-toolkit] yt-dlp info failed (exit', code + '):', stderr.slice(-500))
        resolve(null)
        return
      }

      try {
        resolve(JSON.parse(stdout) as YtDlpInfo)
      } catch {
        resolve(null)
      }
    })

    child.once('error', (err) => {
      console.error('[yt-toolkit] yt-dlp spawn error:', err.message)
      resolve(null)
    })
  })
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Video info
// ---------------------------------------------------------------------------

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

  // ytdl-core often fails on cloud providers (YouTube blocks datacenter IPs),
  // so treat it as optional and fall back to yt-dlp data.
  let ytdlDetails: {
    title: string
    lengthSeconds: string
    thumbnails: Array<{ url: string }>
  } | null = null
  let ytdlFormats: YtdlFormat[] = []

  try {
    const basicInfo = await ytdl.getBasicInfo(cleanUrl)
    let info = basicInfo
    try {
      info = await ytdl.getInfo(cleanUrl)
    } catch {
      info = basicInfo
    }
    ytdlDetails = info.videoDetails
    ytdlFormats = getAvailableFormats(info)
  } catch (error) {
    console.error(
      '[yt-toolkit] ytdl-core failed:',
      error instanceof Error ? error.message : error,
    )
  }

  if (!ytDlpInfo && !ytdlDetails) {
    throw new Error('Could not retrieve video info from any source.')
  }

  const totalSeconds = ytDlpInfo?.duration
    ? Math.round(ytDlpInfo.duration)
    : parseInt(ytdlDetails?.lengthSeconds || '0', 10)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const duration =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${minutes}:${String(seconds).padStart(2, '0')}`

  const ytdlThumbnails = ytdlDetails?.thumbnails || []
  const thumbnail =
    ytDlpInfo?.thumbnail ||
    ytDlpInfo?.thumbnails?.[ytDlpInfo.thumbnails.length - 1]?.url ||
    (ytdlThumbnails.length > 0
      ? ytdlThumbnails[ytdlThumbnails.length - 1].url
      : '')

  const highestQuality = ytDlpInfo?.formats?.length
    ? getYtDlpHighestQuality(ytDlpInfo.formats)
    : ytdlFormats
        .filter((format) => format.hasVideo && format.qualityLabel)
        .sort(
          (left, right) =>
            extractQualityHeight(right.qualityLabel) -
            extractQualityHeight(left.qualityLabel),
        )[0]?.qualityLabel

  const estimatedMp3SizeValue = estimateAudioSize(totalSeconds, 192)
  const estimatedMp4SizeValue = ytDlpInfo?.formats?.length
    ? estimateMp4SizeFromYtDlp(ytDlpInfo.formats, totalSeconds)
    : estimateMp4Size(ytdlFormats)
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
          : estimatedMp4SizeValue,
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
          : estimatedMp4SizeValue,
      ]),
    ) as Record<VideoQuality, string>,
  } satisfies Record<VideoProfile, Record<VideoQuality, string>>

  return {
    title: ytDlpInfo?.title || ytdlDetails?.title || 'Unknown',
    duration,
    durationSeconds: totalSeconds,
    thumbnail,
    highestQuality: highestQuality || 'Unknown',
    estimatedMp3Size: estimatedMp3SizeValue,
    estimatedMp4Size: estimatedMp4SizeValue,
    estimatedMp3Sizes,
    estimatedMp4Sizes,
  }
}
