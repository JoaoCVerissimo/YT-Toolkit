import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let cookieFilePath: string | null = null

/**
 * Normalize raw cookie content — some platforms (Render) may store
 * multiline env vars with literal "\n" instead of actual newlines.
 */
function normalizeCookies(raw: string): string {
  if (raw.includes('\t')) return raw // already has real tabs/newlines
  return raw.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
}

function getRawCookies(): string | null {
  // Option 1: path to a Netscape cookies.txt file (best for local dev)
  const filePath = process.env.YOUTUBE_COOKIES_FILE
  if (filePath && existsSync(filePath)) {
    return readFileSync(filePath, 'utf-8')
  }

  // Option 2: raw cookie content (for production / Render)
  const raw = process.env.YOUTUBE_COOKIES
  if (raw) return normalizeCookies(raw)

  return null
}

/**
 * Returns the path to a Netscape-format cookie file for yt-dlp.
 * Returns null if no cookies are configured.
 */
export function getYtDlpCookieFile(): string | null {
  // If pointing to a file directly, just use that path
  const filePath = process.env.YOUTUBE_COOKIES_FILE
  if (filePath && existsSync(filePath)) return filePath

  const raw = process.env.YOUTUBE_COOKIES
  if (!raw) return null

  // Write raw content to a temp file once, reuse path
  if (cookieFilePath && existsSync(cookieFilePath)) return cookieFilePath

  const dir = join(tmpdir(), 'yt-toolkit')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const path = join(dir, 'cookies.txt')
  writeFileSync(path, normalizeCookies(raw), 'utf-8')
  cookieFilePath = path

  // Log cookie count for diagnostics
  const lines = normalizeCookies(raw).split('\n').filter(
    (l) => l.trim() && !l.trim().startsWith('#'),
  )
  console.log(`[yt-toolkit] cookies loaded: ${lines.length} entries → ${path}`)

  return path
}

/**
 * Returns a cookie header string for Innertube.
 * Parses Netscape-format cookies into "key=value; key=value" format.
 */
export function getInnertubeCookieString(): string | undefined {
  const raw = getRawCookies()
  if (!raw) return undefined

  const pairs: string[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const parts = trimmed.split('\t')
    if (parts.length >= 7) {
      pairs.push(`${parts[5]}=${parts[6]}`)
    }
  }

  return pairs.length > 0 ? pairs.join('; ') : undefined
}
