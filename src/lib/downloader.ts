import { ChildProcess, spawn } from 'child_process'
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'fs'
import { stat } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { Readable } from 'stream'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DownloadFormat = 'mp3' | 'mp4' | 'm4a' | 'webm'
type AudioQuality = '64k' | '128k' | '192k' | '256k' | '320k'
type VideoQuality =
  | '144'
  | '240'
  | '360'
  | '480'
  | '720'
  | '1080'
  | '1440'
  | '2160'
  | 'best'
type VideoProfile = 'compatible' | 'best'
type DownloadState = 'pending' | 'downloading' | 'completed' | 'failed'

type DownloadJob = {
  state: DownloadState
  error?: string
  progress?: number
  updatedAt: number
}

export interface DownloadParams {
  cleanUrl: string
  format: DownloadFormat
  downloadId: string
  safeTitle: string
  audioQuality: AudioQuality
  videoQuality: VideoQuality
  videoProfile: VideoProfile
  signal: AbortSignal
}

// ---------------------------------------------------------------------------
// Job tracking
// ---------------------------------------------------------------------------

const downloadJobs = new Map<string, DownloadJob>()
const activeProcesses = new Map<string, ChildProcess>()
const DOWNLOAD_JOB_TTL_MS = 5 * 60 * 1000
const STALE_JOB_AGE_MS = 10 * 60 * 1000
const STALE_FILE_AGE_MS = 15 * 60 * 1000
const CLEANUP_INTERVAL_MS = 60 * 1000

function sweepStaleJobs() {
  const now = Date.now()

  for (const [id, job] of downloadJobs) {
    const age = now - job.updatedAt

    // Completed/failed jobs: remove after TTL (already served their purpose)
    if (job.state === 'completed' || job.state === 'failed') {
      if (age > DOWNLOAD_JOB_TTL_MS) {
        downloadJobs.delete(id)
      }
      continue
    }

    // Pending/downloading jobs: only kill if no process is still running
    // (process died silently without finalizing the job)
    if (age > STALE_JOB_AGE_MS) {
      const child = activeProcesses.get(id)
      if (!child || child.exitCode !== null || child.killed) {
        downloadJobs.delete(id)
        activeProcesses.delete(id)
      }
    }
  }

  // Clean orphaned process entries that no longer have a matching job
  for (const [id] of activeProcesses) {
    if (!downloadJobs.has(id)) {
      activeProcesses.delete(id)
    }
  }
}

function sweepStaleTmpFiles() {
  const dir = join(tmpdir(), 'yt-toolkit')
  if (!existsSync(dir)) return

  const now = Date.now()
  try {
    for (const file of readdirSync(dir)) {
      try {
        const filePath = join(dir, file)
        if (now - statSync(filePath).mtimeMs > STALE_FILE_AGE_MS) {
          unlinkSync(filePath)
        }
      } catch {
        // ignore per-file errors
      }
    }
  } catch {
    // ignore readdir errors
  }
}

setInterval(() => {
  sweepStaleJobs()
  sweepStaleTmpFiles()
}, CLEANUP_INTERVAL_MS)

function setDownloadJob(jobId: string, state: DownloadState, error?: string) {
  downloadJobs.set(jobId, { state, error, updatedAt: Date.now() })
}

function finalizeDownloadJob(
  jobId: string,
  state: Exclude<DownloadState, 'pending'>,
  error?: string,
) {
  const existing = downloadJobs.get(jobId)
  if (
    existing &&
    (existing.state === 'completed' || existing.state === 'failed')
  ) {
    return
  }

  setDownloadJob(jobId, state, error)

  setTimeout(() => {
    const current = downloadJobs.get(jobId)
    if (current && current.state === state) {
      downloadJobs.delete(jobId)
    }
  }, DOWNLOAD_JOB_TTL_MS)
}

function registerDownloadProcess(jobId: string, child: ChildProcess) {
  activeProcesses.set(jobId, child)

  const clearProcess = () => {
    if (activeProcesses.get(jobId) === child) {
      activeProcesses.delete(jobId)
    }
  }

  child.once('close', clearProcess)
  child.once('error', clearProcess)
}

// ---------------------------------------------------------------------------
// Public job helpers
// ---------------------------------------------------------------------------

export function cancelDownload(downloadId: string): boolean {
  const child = activeProcesses.get(downloadId)
  if (child) {
    finalizeDownloadJob(downloadId, 'failed', 'Download cancelled')
    child.kill('SIGTERM')
    return true
  }
  return false
}

export function getDownloadStatus(downloadId: string): {
  state: string
  error?: string
  progress?: number
} {
  const job = downloadJobs.get(downloadId)
  if (!job || Date.now() - job.updatedAt > DOWNLOAD_JOB_TTL_MS) {
    if (job) downloadJobs.delete(downloadId)
    return { state: 'completed' }
  }
  return {
    state: job.state,
    ...(job.error && { error: job.error }),
    ...(job.progress != null && { progress: job.progress }),
  }
}

// ---------------------------------------------------------------------------
// Tool paths
// ---------------------------------------------------------------------------

function getYtDlpPath(): string {
  const candidate = join(
    process.cwd(),
    'node_modules',
    'youtube-dl-exec',
    'bin',
    'yt-dlp',
  )
  if (existsSync(candidate)) return candidate
  return 'yt-dlp'
}

function getFfmpegLocation(): string {
  const candidate = join(
    process.cwd(),
    'node_modules',
    'ffmpeg-static',
    'ffmpeg',
  )
  if (existsSync(candidate)) return dirname(candidate)
  return ''
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function getTmpDir(): string {
  const dir = join(tmpdir(), 'yt-toolkit')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function cleanUp(...paths: string[]) {
  for (const path of paths) {
    try {
      if (existsSync(path)) unlinkSync(path)
    } catch {
      // ignore cleanup failures
    }
  }
}

function findOutputFile(dir: string, prefix: string): string | null {
  const match = readdirSync(dir).find((file) => file.startsWith(prefix))
  return match ? join(dir, match) : null
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function getVideoFormatSelector(
  videoQuality: VideoQuality,
  videoProfile: VideoProfile,
): string {
  if (videoProfile === 'best') {
    if (videoQuality === 'best') {
      return 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
    }

    return `bestvideo[ext=mp4][height<=${videoQuality}]+bestaudio[ext=m4a]/best[ext=mp4][height<=${videoQuality}]/best[height<=${videoQuality}]`
  }

  if (videoQuality === 'best') {
    return 'bestvideo[vcodec^=avc1][ext=mp4]+bestaudio[acodec^=mp4a][ext=m4a]/best[vcodec^=avc1][ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
  }

  return `bestvideo[vcodec^=avc1][ext=mp4][height<=${videoQuality}]+bestaudio[acodec^=mp4a][ext=m4a]/best[vcodec^=avc1][ext=mp4][height<=${videoQuality}]/bestvideo[ext=mp4][height<=${videoQuality}]+bestaudio[ext=m4a]/best[ext=mp4][height<=${videoQuality}]/best[height<=${videoQuality}]`
}

function buildYtDlpArgs(
  format: DownloadFormat,
  cleanUrl: string,
  ffmpegLocation: string,
  outputTarget: string,
  audioQuality: AudioQuality,
  videoQuality: VideoQuality,
  videoProfile: VideoProfile,
) {
  const args: string[] = ['--concurrent-fragments', '4']

  if (ffmpegLocation) {
    args.push('--ffmpeg-location', ffmpegLocation)
  }

  if (format === 'mp3') {
    args.push(
      '-f',
      'bestaudio/best',
      '-x',
      '--audio-format',
      'mp3',
      '--audio-quality',
      audioQuality,
      '-o',
      outputTarget,
    )
  } else if (format === 'm4a') {
    args.push('-f', 'bestaudio[ext=m4a]/bestaudio', '-o', outputTarget)
  } else if (format === 'webm') {
    args.push('-f', 'bestaudio[ext=webm]/bestaudio', '-o', outputTarget)
  } else {
    args.push(
      '-f',
      getVideoFormatSelector(videoQuality, videoProfile),
      '--merge-output-format',
      'mp4',
      '-o',
      outputTarget,
    )
  }

  args.push(cleanUrl)
  return args
}

const CONTENT_TYPES: Record<DownloadFormat, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  webm: 'audio/webm',
  mp4: 'video/mp4',
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

export function parseAudioQuality(value: string | null): AudioQuality {
  const allowed: AudioQuality[] = ['64k', '128k', '192k', '256k', '320k']
  return allowed.includes(value as AudioQuality)
    ? (value as AudioQuality)
    : '192k'
}

export function parseVideoQuality(value: string | null): VideoQuality {
  const allowed: VideoQuality[] = [
    '144',
    '240',
    '360',
    '480',
    '720',
    '1080',
    '1440',
    '2160',
    'best',
  ]
  return allowed.includes(value as VideoQuality)
    ? (value as VideoQuality)
    : 'best'
}

export function parseVideoProfile(value: string | null): VideoProfile {
  return value === 'best' ? 'best' : 'compatible'
}

export function sanitizeFilename(
  input: string | null,
  fallback: string,
): string {
  const sanitized = (input || '')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .slice(0, 100)

  return sanitized || fallback
}

// ---------------------------------------------------------------------------
// Download execution
// ---------------------------------------------------------------------------

async function downloadToFile(params: DownloadParams): Promise<Response> {
  const {
    cleanUrl,
    format,
    downloadId,
    safeTitle,
    audioQuality,
    videoQuality,
    videoProfile,
    signal,
  } = params
  const ytdlp = getYtDlpPath()
  const ffmpegLocation = getFfmpegLocation()
  const tmpDir = getTmpDir()
  const id = Date.now().toString(36)
  const videoId = cleanUrl.replace(/.*v=/, '').replace(/&.*/, '')
  const outputPrefix = `${id}_${videoId}`
  const outputTemplate = join(tmpDir, `${outputPrefix}.%(ext)s`)

  const args = buildYtDlpArgs(
    format,
    cleanUrl,
    ffmpegLocation,
    outputTemplate,
    audioQuality,
    videoQuality,
    videoProfile,
  )
  const child = spawn(ytdlp, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: tmpDir,
  })
  registerDownloadProcess(downloadId, child)
  setDownloadJob(downloadId, 'downloading')

  // yt-dlp writes progress to stdout; parse percentage from it
  child.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString()
    const match = text.match(/(\d+(?:\.\d+)?)%/)
    if (match) {
      const job = downloadJobs.get(downloadId)
      if (job && job.state === 'downloading') {
        job.progress = parseFloat(match[1])
        job.updatedAt = Date.now()
      }
    }
  })

  let stderr = ''
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString()
    if (stderr.length > 4000) stderr = stderr.slice(-4000)
  })

  signal.addEventListener('abort', () => {
    finalizeDownloadJob(downloadId, 'failed', 'Download cancelled')
    child.kill('SIGTERM')
  })

  child.once('error', (error) => {
    if (!stderr) stderr = error.message
  })

  const actualFile = await new Promise<string>((resolve, reject) => {
    child.once('close', (code) => {
      if (code !== 0) {
        console.error(`[yt-toolkit] download failed (${downloadId}):`, stderr)
        finalizeDownloadJob(downloadId, 'failed', 'Download failed.')
        reject(new Error('Download failed'))
        return
      }

      const file = findOutputFile(tmpDir, outputPrefix)
      if (!file) {
        reject(new Error('Downloaded file was not created'))
        return
      }

      resolve(file)
    })
  })

  const fileInfo = await stat(actualFile)
  finalizeDownloadJob(downloadId, 'completed')

  const fileStream = createReadStream(actualFile)
  fileStream.once('close', () => cleanUp(actualFile))

  const webStream = Readable.toWeb(fileStream) as ReadableStream

  return new Response(webStream, {
    headers: {
      'Content-Type': CONTENT_TYPES[format],
      'Content-Disposition': `attachment; filename="${safeTitle}.${format}"`,
      'Cache-Control': 'no-store',
      'Content-Length': String(fileInfo.size),
    },
  })
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function executeDownload(
  params: DownloadParams,
): Promise<Response> {
  return downloadToFile(params)
}
