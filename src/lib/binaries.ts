import { existsSync } from 'fs'
import { dirname, join } from 'path'

/**
 * Returns the Electron resources path when running inside a packaged app.
 * The main process sets RESOURCES_PATH so the forked Next.js server can
 * find bundled binaries.
 */
function getResourcesPath(): string | null {
  return process.env.RESOURCES_PATH || null
}

/**
 * Finds a binary in a directory, trying both plain and .exe names.
 * We can't rely on process.platform because Next.js bakes it in at
 * build time (on Mac), not at runtime (on Windows).
 */
function findBinary(dir: string, name: string): string | null {
  for (const candidate of [`${name}.exe`, name]) {
    const p = join(dir, candidate)
    if (existsSync(p)) return p
  }
  return null
}

export function getYtDlpPath(): string {
  // Packaged Electron app
  const res = getResourcesPath()
  if (res) {
    const p = findBinary(join(res, 'bin'), 'yt-dlp')
    if (p) return p
  }

  // node_modules (dev / web)
  const candidate = join(
    process.cwd(),
    'node_modules',
    'youtube-dl-exec',
    'bin',
    'yt-dlp',
  )
  if (existsSync(candidate)) return candidate

  // System PATH
  return 'yt-dlp'
}

export function getFfmpegDir(): string {
  // Packaged Electron app
  const res = getResourcesPath()
  if (res) {
    const p = findBinary(join(res, 'bin'), 'ffmpeg')
    if (p) return dirname(p)
  }

  // node_modules (dev / web)
  const candidate = join(
    process.cwd(),
    'node_modules',
    'ffmpeg-static',
    'ffmpeg',
  )
  if (existsSync(candidate)) return dirname(candidate)

  // System PATH (yt-dlp will find ffmpeg itself)
  return ''
}
