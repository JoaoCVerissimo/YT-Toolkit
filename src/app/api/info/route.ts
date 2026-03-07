import { NextRequest, NextResponse } from 'next/server'
import { extractVideoId, getVideoInfo } from '@/lib/youtube'
import { parseBodyUrl, safeErrorMessage } from '@/lib/api-utils'

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
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to fetch video info.') },
      { status: 500 },
    )
  }
}
