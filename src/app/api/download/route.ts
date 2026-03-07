import { safeErrorMessage } from '@/lib/api-utils'
import {
  cancelDownload,
  executeDownload,
  getDownloadStatus,
  parseAudioQuality,
  parseDownloadMode,
  parseVideoProfile,
  parseVideoQuality,
  sanitizeFilename,
} from '@/lib/downloader'
import { cleanVideoUrl, extractVideoId } from '@/lib/youtube'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams

    // Cancel a running download
    if (params.get('cancel') === '1') {
      const jobId = params.get('downloadId') || ''
      if (!jobId) {
        return NextResponse.json(
          { error: 'Missing download ID' },
          { status: 400 },
        )
      }
      cancelDownload(jobId)
      return NextResponse.json({ ok: true })
    }

    // Check download status
    if (params.get('status') === '1') {
      const jobId = params.get('downloadId') || ''
      if (!jobId) {
        return NextResponse.json(
          { error: 'Missing download ID' },
          { status: 400 },
        )
      }
      return NextResponse.json(getDownloadStatus(jobId))
    }

    // Validate URL
    const url = (params.get('url') || '').trim()
    if (!url || url.length > 2048) {
      return NextResponse.json(
        { error: 'A valid YouTube URL is required.' },
        { status: 400 },
      )
    }

    const videoId = extractVideoId(url)
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 },
      )
    }

    // Validate format
    const format = params.get('format') || ''
    if (!['mp3', 'mp4', 'm4a', 'webm'].includes(format)) {
      return NextResponse.json(
        { error: 'Unsupported format' },
        { status: 400 },
      )
    }

    // Parse options
    const rawDownloadId = params.get('downloadId') || ''
    const downloadId =
      rawDownloadId && /^[a-zA-Z0-9_-]{1,64}$/.test(rawDownloadId)
        ? rawDownloadId
        : crypto.randomUUID()

    return await executeDownload({
      cleanUrl: cleanVideoUrl(url),
      format: format as 'mp3' | 'mp4' | 'm4a' | 'webm',
      downloadMode: parseDownloadMode(params.get('downloadMode')),
      downloadId,
      safeTitle: sanitizeFilename(params.get('title'), `youtube-${videoId}`),
      audioQuality: parseAudioQuality(params.get('audioQuality')),
      videoQuality: parseVideoQuality(params.get('videoQuality')),
      videoProfile: parseVideoProfile(params.get('videoProfile')),
      signal: req.signal,
    })
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Download failed.') },
      { status: 500 },
    )
  }
}
