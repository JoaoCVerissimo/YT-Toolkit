import { GoogleGenAI } from '@google/genai'
import { DEFAULT_MODEL } from './models'

export interface IdentifiedTrack {
  title: string
  artist: string
  context?: string
}

export async function identifyMusic(
  youtubeUrl: string,
  options?: { apiKey?: string; model?: string },
): Promise<IdentifiedTrack[]> {
  const apiKey = options?.apiKey || process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('No Gemini API key configured. Add your key in Settings.')
  }

  const model = options?.model || DEFAULT_MODEL
  const ai = new GoogleGenAI({ apiKey })

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            fileData: {
              fileUri: youtubeUrl,
              mimeType: 'video/mp4',
            },
          },
          {
            text: `Identify all songs and music tracks used in this YouTube video.
For each track, provide the song title, artist name, and a brief context of how it appears (e.g. "background music", "main song", "intro music", "played at 2:30").

Respond in this exact JSON format, no markdown fences:
{"tracks": [{"title": "Song Name", "artist": "Artist Name", "context": "how it appears"}]}

If you cannot identify any music or the video has no music, respond with:
{"tracks": []}`,
          },
        ],
      },
    ],
  })

  const raw = response.text?.trim() || ''

  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed.tracks)) return []
    return parsed.tracks
      .filter(
        (t: Record<string, unknown>) =>
          typeof t.title === 'string' && typeof t.artist === 'string',
      )
      .map((t: Record<string, unknown>) => ({
        title: t.title as string,
        artist: t.artist as string,
        ...(typeof t.context === 'string' && { context: t.context }),
      }))
  } catch {
    return []
  }
}
