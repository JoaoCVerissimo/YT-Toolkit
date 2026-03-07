import { NextRequest, NextResponse } from 'next/server'
import { extractVideoId, getTranscript } from '@/lib/youtube'
import { summarize } from '@/lib/summarizer'
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

    const transcript = await getTranscript(videoId)
    const { summary, keyPoints } = await summarize(transcript, {
      ...(apiKey && { apiKey }),
      model,
    })

    return NextResponse.json({ summary, keyPoints, transcript })
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to summarize video.') },
      { status: 500 },
    )
  }
}
