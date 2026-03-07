import { safeErrorMessage } from '@/lib/api-utils'
import { cleanVideoUrl, extractVideoId } from '@/lib/youtube'
import { ChildProcess, spawn } from 'child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'fs'
import { NextRequest, NextResponse } from 'next/server'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { Readable } from 'stream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type DownloadFormat = 'mp3' | 'mp4' | 'm4a' | 'webm'
type DownloadMode = 'fast' | 'follow'
type AudioQuality = '64k' | '128k' | '192k' | '256k' | '320k'
type VideoQuality = '144' | '240' | '360' | '480' | '720' | '1080' | '1440' | '2160' | 'best'
type VideoProfile = 'compatible' | 'best'
type DownloadState = 'pending' | 'downloading' | 'completed' | 'failed'

type DownloadJob = {
  state: DownloadState
  error?: string
  updatedAt: number
}

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
  const dir = join(tmpdir(), 'youtube-savior')
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

function setDownloadJob(
  jobId: string,
  state: DownloadState,
  error?: string,
) {
  downloadJobs.set(jobId, {
    state,
    error,
    updatedAt: Date.now(),
  })
}

function getDownloadJob(jobId: string): DownloadJob | null {
  const job = downloadJobs.get(jobId)
  if (!job) return null

  if (Date.now() - job.updatedAt > DOWNLOAD_JOB_TTL_MS) {
    downloadJobs.delete(jobId)
    return null
  }

  return job
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

function finalizeDownloadJob(
  jobId: string,
  state: Exclude<DownloadState, 'pending'>,
  error?: string,
) {
  // Don't overwrite a job already in a terminal state (e.g. abort handler
  // sets "Download cancelled", then ffmpeg close fires with raw stderr)
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

function parseDownloadMode(value: string | null): DownloadMode {
  return value === 'follow' ? 'follow' : 'fast'
}

function parseAudioQuality(value: string | null): AudioQuality {
  const allowed: AudioQuality[] = ['64k', '128k', '192k', '256k', '320k']
  return allowed.includes(value as AudioQuality)
    ? (value as AudioQuality)
    : '192k'
}

function parseVideoQuality(value: string | null): VideoQuality {
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

function parseVideoProfile(value: string | null): VideoProfile {
  return value === 'best' ? 'best' : 'compatible'
}

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

function getFfmpegPath(): string {
  const candidate = join(
    process.cwd(),
    'node_modules',
    'ffmpeg-static',
    'ffmpeg',
  )
  if (existsSync(candidate)) return candidate
  return 'ffmpeg'
}

function getTmpDir(): string {
  const dir = join(tmpdir(), 'youtube-savior')
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

function sanitizeFilename(input: string | null, fallback: string): string {
  const sanitized = (input || '')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .slice(0, 100)

  return sanitized || fallback
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
  const args: string[] = []

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

export async function GET(req: NextRequest) {
  try {
    if (req.nextUrl.searchParams.get('cancel') === '1') {
      const jobId = req.nextUrl.searchParams.get('downloadId') || ''
      if (!jobId) {
        return NextResponse.json(
          { error: 'Missing download ID' },
          { status: 400 },
        )
      }

      const child = activeProcesses.get(jobId)
      if (child) {
        finalizeDownloadJob(jobId, 'failed', 'Download cancelled')
        child.kill('SIGTERM')
      }

      return NextResponse.json({ ok: true })
    }

    if (req.nextUrl.searchParams.get('status') === '1') {
      const jobId = req.nextUrl.searchParams.get('downloadId') || ''
      if (!jobId) {
        return NextResponse.json(
          { error: 'Missing download ID' },
          { status: 400 },
        )
      }

      const job = getDownloadJob(jobId)
      if (!job) {
        return NextResponse.json({ state: 'completed' })
      }

      return NextResponse.json({
        state: job.state,
        ...(job.error && { error: job.error }),
      })
    }

    const url = (req.nextUrl.searchParams.get('url') || '').trim()
    if (!url || url.length > 2048) {
      return NextResponse.json(
        { error: 'A valid YouTube URL is required.' },
        { status: 400 },
      )
    }

    const format = req.nextUrl.searchParams.get('format') || ''
    const downloadMode = parseDownloadMode(
      req.nextUrl.searchParams.get('downloadMode'),
    )
    const audioQuality = parseAudioQuality(
      req.nextUrl.searchParams.get('audioQuality'),
    )
    const videoQuality = parseVideoQuality(
      req.nextUrl.searchParams.get('videoQuality'),
    )
    const videoProfile = parseVideoProfile(
      req.nextUrl.searchParams.get('videoProfile'),
    )
    const rawDownloadId = req.nextUrl.searchParams.get('downloadId') || ''
    const downloadId =
      rawDownloadId && /^[a-zA-Z0-9_-]{1,64}$/.test(rawDownloadId)
        ? rawDownloadId
        : crypto.randomUUID()
    const videoId = extractVideoId(url)
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 },
      )
    }
    if (!['mp3', 'mp4', 'm4a', 'webm'].includes(format)) {
      return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
    }

    const cleanUrl = cleanVideoUrl(url)
    const normalizedFormat = format as DownloadFormat
    setDownloadJob(downloadId, 'pending')
    const safeTitle = sanitizeFilename(
      req.nextUrl.searchParams.get('title'),
      `youtube-${videoId}`,
    )

    const ytdlp = getYtDlpPath()
    const ffmpegLocation = getFfmpegLocation()
    const contentType: string = {
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      webm: 'audio/webm',
      mp4: 'video/mp4',
    }[normalizedFormat]

    if (downloadMode === 'follow') {
      if (normalizedFormat === 'm4a' || normalizedFormat === 'webm') {
        const ytdlpArgs: string[] = ['--no-playlist']
        if (ffmpegLocation) {
          ytdlpArgs.push('--ffmpeg-location', ffmpegLocation)
        }
        ytdlpArgs.push(
          '-f',
          `bestaudio[ext=${normalizedFormat}]/bestaudio`,
          '-o',
          '-',
          cleanUrl,
        )

        const ytdlpChild = spawn(ytdlp, ytdlpArgs, {
          stdio: ['ignore', 'pipe', 'pipe'],
        })

        registerDownloadProcess(downloadId, ytdlpChild)
        setDownloadJob(downloadId, 'downloading')

        let stderr = ''

        ytdlpChild.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString()
          if (stderr.length > 4000) stderr = stderr.slice(-4000)
        })

        ytdlpChild.once('close', (code) => {
          if (code !== 0) {
            console.error(`[youtube-savior] download failed (${downloadId}):`, stderr)
            finalizeDownloadJob(downloadId, 'failed', 'Download failed.')
          } else {
            finalizeDownloadJob(downloadId, 'completed')
          }
        })

        ytdlpChild.once('error', () => {})

        req.signal.addEventListener('abort', () => {
          finalizeDownloadJob(downloadId, 'failed', 'Download cancelled')
          ytdlpChild.kill('SIGTERM')
        })

        const webStream = Readable.toWeb(ytdlpChild.stdout) as ReadableStream

        return new Response(webStream, {
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${safeTitle}.${normalizedFormat}"`,
            'Cache-Control': 'no-store',
            'X-Accel-Buffering': 'no',
          },
        })
      }

      const ffmpegBin = getFfmpegPath()

      // yt-dlp: download raw stream to stdout (no post-processing)
      const ytdlpArgs: string[] = ['--no-playlist']
      if (ffmpegLocation) {
        ytdlpArgs.push('--ffmpeg-location', ffmpegLocation)
      }
      if (normalizedFormat === 'mp3') {
        ytdlpArgs.push('-f', 'bestaudio', '-o', '-', cleanUrl)
      } else {
        // Merge as MKV (pipe-friendly, no seeking needed) — ffmpeg remuxes to MP4
        ytdlpArgs.push(
          '-f',
          getVideoFormatSelector(videoQuality, videoProfile),
          '--merge-output-format',
          'mkv',
          '-o',
          '-',
          cleanUrl,
        )
      }

      // ffmpeg: reduce probe buffering so output starts sooner
      const ffmpegArgs = [
        '-hide_banner',
        '-loglevel',
        'error',
        '-probesize',
        '32768',
        '-analyzeduration',
        '0',
        '-i',
        'pipe:0',
      ]
      if (normalizedFormat === 'mp3') {
        ffmpegArgs.push('-vn', '-f', 'mp3', '-b:a', audioQuality)
      } else {
        ffmpegArgs.push(
          '-c',
          'copy',
          '-movflags',
          'frag_keyframe+empty_moov+default_base_moof',
          '-f',
          'mp4',
        )
      }
      ffmpegArgs.push('pipe:1')

      // Spawn pipeline: yt-dlp stdout → ffmpeg stdin → ffmpeg stdout → response
      const ytdlpChild = spawn(ytdlp, ytdlpArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const ffmpegChild = spawn(ffmpegBin, ffmpegArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      ytdlpChild.stdout.pipe(ffmpegChild.stdin)
      ffmpegChild.stdin.on('error', () => {})

      registerDownloadProcess(downloadId, ytdlpChild)
      setDownloadJob(downloadId, 'downloading')

      let stderr = ''

      ytdlpChild.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
        if (stderr.length > 4000) stderr = stderr.slice(-4000)
      })

      ffmpegChild.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
        if (stderr.length > 8000) stderr = stderr.slice(-8000)
      })

      const cleanup = () => {
        ytdlpChild.kill('SIGTERM')
        ffmpegChild.kill('SIGTERM')
      }

      ffmpegChild.once('close', (code) => {
        if (code !== 0) {
          console.error(`[youtube-savior] conversion failed (${downloadId}):`, stderr)
          finalizeDownloadJob(downloadId, 'failed', 'Download failed.')
        } else {
          finalizeDownloadJob(downloadId, 'completed')
        }
      })

      ytdlpChild.once('error', () => cleanup())
      ffmpegChild.once('error', () => cleanup())

      req.signal.addEventListener('abort', () => {
        finalizeDownloadJob(downloadId, 'failed', 'Download cancelled')
        cleanup()
      })

      const webStream = Readable.toWeb(ffmpegChild.stdout) as ReadableStream

      return new Response(webStream, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${safeTitle}.${normalizedFormat}"`,
          'Cache-Control': 'no-store',
          'X-Accel-Buffering': 'no',
        },
      })
    }

    const tmpDir = getTmpDir()
    const id = Date.now().toString(36)
    const outputPrefix = `${id}_${videoId}`
    const outputTemplate = join(tmpDir, `${outputPrefix}.%(ext)s`)
    const args = buildYtDlpArgs(
      normalizedFormat,
      cleanUrl,
      ffmpegLocation,
      outputTemplate,
      audioQuality,
      videoQuality,
      videoProfile,
    )
    const child = spawn(ytdlp, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    registerDownloadProcess(downloadId, child)
    setDownloadJob(downloadId, 'downloading')

    let stderr = ''

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
      if (stderr.length > 4000) {
        stderr = stderr.slice(-4000)
      }
    })

    req.signal.addEventListener('abort', () => {
      finalizeDownloadJob(downloadId, 'failed', 'Download cancelled')
      child.kill('SIGTERM')
    })

    child.once('error', (error) => {
      if (!stderr) {
        stderr = error.message
      }
    })

    const actualFile = await new Promise<string>((resolve, reject) => {
      child.once('close', (code) => {
        if (code !== 0) {
          console.error(`[youtube-savior] download failed (${downloadId}):`, stderr)
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

    const data = readFileSync(actualFile)
    finalizeDownloadJob(downloadId, 'completed')
    cleanUp(actualFile)

    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${safeTitle}.${normalizedFormat}"`,
        'Cache-Control': 'no-store',
        'Content-Length': String(data.byteLength),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Download failed.') },
      { status: 500 },
    )
  }
}
