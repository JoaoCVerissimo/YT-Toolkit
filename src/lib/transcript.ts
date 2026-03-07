import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

type YtDlpSubtitleTrack = {
  ext?: string
  url?: string
}

type YtDlpSubtitleInfo = {
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

const RE_XML_TRANSCRIPT =
  /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g

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

function findCaptionUrl(
  sources: Record<string, YtDlpSubtitleTrack[]>[],
): string | null {
  // Try English first
  for (const source of sources) {
    const enTracks = source['en'] || source['en-US'] || source['en-GB']
    if (enTracks?.length) {
      const srv1 = enTracks.find((t) => t.ext === 'srv1')
      const url = srv1?.url || enTracks[0]?.url || null
      if (url) return url
    }
  }

  // Fall back to first available language
  for (const source of sources) {
    const langs = Object.keys(source)
    if (langs.length > 0) {
      const tracks = source[langs[0]]
      if (tracks?.length) {
        const srv1 = tracks.find((t) => t.ext === 'srv1')
        const url = srv1?.url || tracks[0]?.url || null
        if (url) return url
      }
    }
  }

  return null
}

function parseTranscriptText(text: string): string {
  // Try XML format first (srv1)
  const xmlMatches = [...text.matchAll(RE_XML_TRANSCRIPT)]
  if (xmlMatches.length > 0) {
    return xmlMatches.map((m) => decodeHtmlEntities(m[3])).join(' ')
  }

  // Try JSON3
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
    // Plain text subtitle (e.g. SRT)
    const cleaned = text.replace(/\d+\n[\d:,.-]+ --> [\d:,.-]+\n/g, '').trim()
    if (!cleaned) return ''
    return cleaned.replace(/\n/g, ' ')
  }
}

export async function getTranscript(videoId: string): Promise<string> {
  const url = `https://www.youtube.com/watch?v=${videoId}`

  const info = await new Promise<YtDlpSubtitleInfo | null>((resolve) => {
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
        resolve(JSON.parse(stdout) as YtDlpSubtitleInfo)
      } catch {
        resolve(null)
      }
    })
    child.once('error', () => resolve(null))
  })

  if (!info) {
    throw new Error(`Failed to get video info for: ${videoId}`)
  }

  const captionUrl = findCaptionUrl([
    info.subtitles || {},
    info.automatic_captions || {},
  ])

  if (!captionUrl) {
    throw new Error(`No transcript available for: ${videoId}`)
  }

  const response = await fetch(captionUrl)
  if (!response.ok) {
    throw new Error(`Failed to download transcript for: ${videoId}`)
  }

  const text = await response.text()
  const transcript = parseTranscriptText(text)

  if (!transcript) {
    throw new Error(`Transcript is empty for: ${videoId}`)
  }

  return transcript
}
