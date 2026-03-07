import { NextRequest, NextResponse } from 'next/server'
import { cleanVideoUrl, extractVideoId } from '@/lib/youtube'
import { identifyMusic } from '@/lib/music-identifier'
import {
  parseBodyApiKey,
  parseBodyModel,
  parseBodyUrl,
  safeErrorMessage,
} from '@/lib/api-utils'

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

    const apiKey = parseBodyApiKey(body)
    const model = parseBodyModel(body)
    const cleanUrl = cleanVideoUrl(url)

    const tracks = await identifyMusic(cleanUrl, {
      ...(apiKey && { apiKey }),
      model,
    })

    return NextResponse.json({ tracks })
  } catch (error) {
    return NextResponse.json(
      {
        error: safeErrorMessage(
          error,
          'Failed to identify music in this video.',
        ),
      },
      { status: 500 },
    )
  }
}
