import { NextRequest, NextResponse } from 'next/server'
import { extractVideoId, getVideoInfo } from '@/lib/youtube'
import { parseBodyUrl } from '@/lib/api-utils'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const url = parseBodyUrl(body)
    if (!url) {
      return NextResponse.json(
        { error: 'A valid YouTube URL is required.' },
        { status: 400 },
      )
    }

    const videoId = extractVideoId(url)
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL.' },
        { status: 400 },
      )
    }

    const info = await getVideoInfo(url)
    return NextResponse.json({ videoId, ...info })
  } catch (error) {
    console.error('[api/info] error:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to fetch video info.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
