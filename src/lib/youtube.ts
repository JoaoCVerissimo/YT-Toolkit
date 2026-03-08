import {
  AUDIO_QUALITIES,
  VIDEO_QUALITIES,
  estimateAudioSize,
  type AudioQuality,
  type VideoProfile,
  type VideoQuality,
} from './formats'

export { getTranscript } from './transcript'

// ---------------------------------------------------------------------------
// Common types
// ---------------------------------------------------------------------------

type BasicInfo = {
  title: string
  durationSeconds: number
  thumbnail: string
}

// ---------------------------------------------------------------------------
// Source 1: YouTube Data API v3 (official, works from any IP, needs API key)
// ---------------------------------------------------------------------------

function parseISO8601Duration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  return hours * 3600 + minutes * 60 + seconds
}

async function getYouTubeApiInfo(
  videoId: string,
): Promise<BasicInfo | null> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return null

  try {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      id: videoId,
      key: apiKey,
    })
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${params}`,
    )
    if (!res.ok) {
      console.error(
        '[yt-toolkit] YouTube Data API failed:',
        res.status,
        await res.text().catch(() => ''),
      )
      return null
    }

    const data = await res.json()
    const item = data.items?.[0]
    if (!item) return null

    const thumbnails = item.snippet?.thumbnails || {}
    const thumbnail =
      thumbnails.maxres?.url ||
      thumbnails.high?.url ||
      thumbnails.medium?.url ||
      thumbnails.default?.url ||
      ''

    return {
      title: item.snippet?.title || 'Unknown',
      durationSeconds: parseISO8601Duration(
        item.contentDetails?.duration || '',
      ),
      thumbnail,
    }
  } catch (error) {
    console.error(
      '[yt-toolkit] YouTube Data API error:',
      error instanceof Error ? error.message : error,
    )
    return null
  }
}

// ---------------------------------------------------------------------------
// Source 2: YouTube oEmbed (no API key, works from any IP, no duration)
// ---------------------------------------------------------------------------

async function getOEmbedInfo(videoId: string): Promise<BasicInfo | null> {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    const res = await fetch(url)
    if (!res.ok) return null

    const data = await res.json()
    return {
      title: data.title || 'Unknown',
      durationSeconds: 0,
      thumbnail: data.thumbnail_url || '',
    }
  } catch {
    return null
  }
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
// Duration formatting
// ---------------------------------------------------------------------------

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Video info (fallback chain: YouTube Data API → oEmbed)
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
  const videoId = extractVideoId(cleanUrl)!

  const info =
    (await getYouTubeApiInfo(videoId)) || (await getOEmbedInfo(videoId))

  if (!info) {
    throw new Error('Could not retrieve video info from any source.')
  }

  const { title, durationSeconds: totalSeconds, thumbnail } = info

  const estimatedMp3SizeValue = estimateAudioSize(totalSeconds, 192)
  const estimatedMp3Sizes = Object.fromEntries(
    AUDIO_QUALITIES.map((quality) => [
      quality,
      estimateAudioSize(totalSeconds, Number.parseInt(quality, 10)),
    ]),
  ) as Record<AudioQuality, string>

  const estimatedMp4Sizes = {
    compatible: Object.fromEntries(
      VIDEO_QUALITIES.map((quality) => [quality, 'Unknown']),
    ) as Record<VideoQuality, string>,
    best: Object.fromEntries(
      VIDEO_QUALITIES.map((quality) => [quality, 'Unknown']),
    ) as Record<VideoQuality, string>,
  } satisfies Record<VideoProfile, Record<VideoQuality, string>>

  return {
    title,
    duration: formatDuration(totalSeconds),
    durationSeconds: totalSeconds,
    thumbnail,
    highestQuality: 'Unknown',
    estimatedMp3Size: estimatedMp3SizeValue,
    estimatedMp4Size: 'Unknown',
    estimatedMp3Sizes,
    estimatedMp4Sizes,
  }
}
