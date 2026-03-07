import { GoogleGenAI } from '@google/genai'
import { DEFAULT_MODEL } from './models'

export async function summarize(
  transcript: string,
  options?: { apiKey?: string; model?: string },
): Promise<{ summary: string; keyPoints: string[] }> {
  if (!transcript.trim()) {
    return { summary: 'No content available to summarize.', keyPoints: [] }
  }

  const apiKey = options?.apiKey || process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('No Gemini API key configured. Add your key in Settings.')
  }

  const model = options?.model || DEFAULT_MODEL
  const ai = new GoogleGenAI({ apiKey })

  // Truncate very long transcripts to stay within token limits
  const maxChars = 30000
  const text =
    transcript.length > maxChars
      ? transcript.slice(0, maxChars) + '... [truncated]'
      : transcript

  const response = await ai.models.generateContent({
    model,
    contents: `You are a video content summarizer. Given the following video transcript, provide:
1. A clear, concise summary (2-3 paragraphs)
2. 5-7 key points as bullet points

Respond in this exact JSON format, no markdown fences:
{"summary": "...", "keyPoints": ["point 1", "point 2", ...]}

Transcript:
${text}`,
  })

  const raw = response.text?.trim() || ''
  return parseSummaryResponse(raw)
}

export async function summarizeFromVideo(
  youtubeUrl: string,
  options?: { apiKey?: string; model?: string },
): Promise<{ summary: string; keyPoints: string[] }> {
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
            text: `You are a video content summarizer. Analyze this YouTube video and provide:
1. A clear, concise summary (2-3 paragraphs)
2. 5-7 key points as bullet points

Respond in this exact JSON format, no markdown fences:
{"summary": "...", "keyPoints": ["point 1", "point 2", ...]}`,
          },
        ],
      },
    ],
  })

  const raw = response.text?.trim() || ''
  return parseSummaryResponse(raw)
}

function parseSummaryResponse(raw: string): {
  summary: string
  keyPoints: string[]
} {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    const parsed = JSON.parse(cleaned)
    return {
      summary: parsed.summary || 'Failed to generate summary.',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
    }
  } catch {
    return { summary: raw, keyPoints: [] }
  }
}
