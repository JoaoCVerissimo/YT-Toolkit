'use client'

import { AVAILABLE_MODELS, DEFAULT_MODEL } from '@/lib/models'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

type DownloadMode = 'fast' | 'follow'
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
type AudioFormat = 'mp3' | 'm4a' | 'webm'

const AUDIO_QUALITY_OPTIONS: Array<{ value: AudioQuality; label: string }> = [
  { value: '64k', label: '64 kbps (lowest)' },
  { value: '128k', label: '128 kbps' },
  { value: '192k', label: '192 kbps (default)' },
  { value: '256k', label: '256 kbps' },
  { value: '320k', label: '320 kbps (highest)' },
]

const AUDIO_FORMAT_OPTIONS: Array<{
  value: AudioFormat
  label: string
  description: string
}> = [
  {
    value: 'mp3',
    label: 'MP3 (converted)',
    description:
      'Converted from source audio. Universally compatible but slower to prepare.',
  },
  {
    value: 'm4a',
    label: 'M4A (original)',
    description:
      'Original AAC audio in MP4 container. Fast download, no conversion needed. Plays on most devices.',
  },
  {
    value: 'webm',
    label: 'WebM (original)',
    description:
      'Original Opus audio in WebM container. Fast download, best quality per bitrate but less compatible.',
  },
]

const VIDEO_QUALITY_OPTIONS: Array<{ value: VideoQuality; label: string }> = [
  { value: '144', label: '144p (lowest)' },
  { value: '240', label: '240p' },
  { value: '360', label: '360p' },
  { value: '480', label: '480p' },
  { value: '720', label: '720p' },
  { value: '1080', label: '1080p' },
  { value: '1440', label: '1440p (2K)' },
  { value: '2160', label: '2160p (4K)' },
  { value: 'best', label: 'Best available (default)' },
]

const VIDEO_PROFILE_OPTIONS: Array<{
  value: VideoProfile
  label: string
  description: string
}> = [
  {
    value: 'compatible',
    label: 'Highest compatibility',
    description:
      'Prefers broadly compatible H.264 video with AAC audio inside MP4 containers.',
  },
  {
    value: 'best',
    label: 'Best available',
    description:
      'Prefers the highest available MP4 quality, even when codecs vary across devices and apps.',
  },
]

function getVideoQualityLabel(value: VideoQuality): string {
  return (
    VIDEO_QUALITY_OPTIONS.find((option) => option.value === value)?.label ||
    value
  )
}

function getAudioQualityLabel(value: AudioQuality): string {
  return (
    AUDIO_QUALITY_OPTIONS.find((option) => option.value === value)?.label ||
    value
  )
}

function getVideoProfileLabel(value: VideoProfile): string {
  return (
    VIDEO_PROFILE_OPTIONS.find((option) => option.value === value)?.label ||
    value
  )
}

function getBrowserModeLabel(value: DownloadMode): string {
  return value === 'follow' ? 'Browser follow (streaming)' : 'Fastest delivery'
}

interface VideoInfo {
  videoId: string
  title: string
  duration: string
  durationSeconds: number
  thumbnail: string
  highestQuality: string
  estimatedMp3Size: string
  estimatedMp4Size: string
  estimatedMp3Sizes: Record<AudioQuality, string>
  estimatedMp4Sizes: Record<VideoProfile, Record<VideoQuality, string>>
}

interface IdentifiedTrack {
  title: string
  artist: string
  context?: string
}

interface SummaryData {
  summary: string
  keyPoints: string[]
  transcript?: string
}

function getStoredValue(
  key: string,
  fallback: string,
  storage: 'local' | 'session' = 'local',
): string {
  if (typeof window === 'undefined') {
    return fallback
  }

  const store = storage === 'session' ? sessionStorage : localStorage
  return store.getItem(key) || fallback
}

function getStoredDownloadMode(): DownloadMode {
  if (typeof window === 'undefined') {
    return 'fast'
  }

  const savedDownloadMode = localStorage.getItem('download_mode')
  return savedDownloadMode === 'follow' ? 'follow' : 'fast'
}

function getStoredAudioQuality(): AudioQuality {
  if (typeof window === 'undefined') {
    return '192k'
  }

  const savedAudioQuality = localStorage.getItem('audio_quality')
  return AUDIO_QUALITY_OPTIONS.some(
    (option) => option.value === savedAudioQuality,
  )
    ? (savedAudioQuality as AudioQuality)
    : '192k'
}

function getStoredVideoQuality(): VideoQuality {
  if (typeof window === 'undefined') {
    return 'best'
  }

  const savedVideoQuality = localStorage.getItem('video_quality')
  return VIDEO_QUALITY_OPTIONS.some(
    (option) => option.value === savedVideoQuality,
  )
    ? (savedVideoQuality as VideoQuality)
    : 'best'
}

function getStoredVideoProfile(): VideoProfile {
  if (typeof window === 'undefined') {
    return 'compatible'
  }

  const savedVideoProfile = localStorage.getItem('video_profile')
  return savedVideoProfile === 'best' ? 'best' : 'compatible'
}

function getStoredAudioFormat(): AudioFormat {
  if (typeof window === 'undefined') {
    return 'mp3'
  }

  const saved = localStorage.getItem('audio_format')
  return AUDIO_FORMAT_OPTIONS.some((o) => o.value === saved)
    ? (saved as AudioFormat)
    : 'mp3'
}

function buildResultsText(
  videoInfo: VideoInfo | null,
  summaryData: SummaryData,
) {
  const title = videoInfo?.title || 'YouTube video'
  const duration = videoInfo?.duration || 'Unknown'

  return [
    `Title: ${title}`,
    `Duration: ${duration}`,
    '',
    'Summary',
    summaryData.summary,
    '',
    'Key Points',
    ...summaryData.keyPoints.map((point) => `- ${point}`),
    '',
    'Transcript',
    summaryData.transcript,
  ].join('\n')
}

function buildResultsMarkdown(
  videoInfo: VideoInfo | null,
  summaryData: SummaryData,
) {
  const title = videoInfo?.title || 'YouTube video'
  const duration = videoInfo?.duration || 'Unknown'

  return [
    `# ${title}`,
    '',
    `- Duration: ${duration}`,
    '',
    '## Summary',
    '',
    summaryData.summary,
    '',
    '## Key Points',
    '',
    ...summaryData.keyPoints.map((point) => `- ${point}`),
    '',
    '## Transcript',
    '',
    summaryData.transcript,
  ].join('\n')
}

function triggerDownload(filename: string, content: BlobPart, type: string) {
  const blob = new Blob([content], { type })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 1000)
}

function useSettings() {
  const [apiKey, setApiKey] = useState(() =>
    getStoredValue('gemini_api_key', '', 'session'),
  )
  const [model, setModel] = useState(() =>
    getStoredValue('gemini_model', DEFAULT_MODEL),
  )
  const [downloadMode, setDownloadMode] = useState<DownloadMode>(() =>
    getStoredDownloadMode(),
  )
  const [audioQuality, setAudioQuality] = useState<AudioQuality>(() =>
    getStoredAudioQuality(),
  )
  const [videoQuality, setVideoQuality] = useState<VideoQuality>(() =>
    getStoredVideoQuality(),
  )
  const [videoProfile, setVideoProfile] = useState<VideoProfile>(() =>
    getStoredVideoProfile(),
  )
  const [audioFormat, setAudioFormat] = useState<AudioFormat>(() =>
    getStoredAudioFormat(),
  )

  function saveApiKey(key: string) {
    setApiKey(key)
    sessionStorage.setItem('gemini_api_key', key)
  }

  function saveModel(m: string) {
    setModel(m)
    localStorage.setItem('gemini_model', m)
  }

  function saveDownloadMode(mode: DownloadMode) {
    setDownloadMode(mode)
    localStorage.setItem('download_mode', mode)
  }

  function saveAudioQuality(quality: AudioQuality) {
    setAudioQuality(quality)
    localStorage.setItem('audio_quality', quality)
  }

  function saveVideoQuality(quality: VideoQuality) {
    setVideoQuality(quality)
    localStorage.setItem('video_quality', quality)

    // H.264 (compatible) caps at 1080p — auto-switch to "best" for higher qualities
    const height = quality === 'best' ? Infinity : parseInt(quality, 10)
    if (height > 1080 && videoProfile === 'compatible') {
      setVideoProfile('best')
      localStorage.setItem('video_profile', 'best')
    }
  }

  function saveVideoProfile(profile: VideoProfile) {
    setVideoProfile(profile)
    localStorage.setItem('video_profile', profile)

    // Cap quality at 1080p when switching to compatible (H.264 limit)
    if (profile === 'compatible') {
      const height =
        videoQuality === 'best' ? Infinity : parseInt(videoQuality, 10)
      if (height > 1080) {
        setVideoQuality('1080')
        localStorage.setItem('video_quality', '1080')
      }
    }
  }

  function saveAudioFormat(format: AudioFormat) {
    setAudioFormat(format)
    localStorage.setItem('audio_format', format)
  }

  return {
    apiKey,
    model,
    downloadMode,
    audioQuality,
    videoQuality,
    videoProfile,
    audioFormat,
    saveApiKey,
    saveModel,
    saveDownloadMode,
    saveAudioQuality,
    saveVideoQuality,
    saveVideoProfile,
    saveAudioFormat,
  }
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [toastExiting, setToastExiting] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastKey = useRef(0)

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastKey.current += 1
    setToastExiting(false)
    setToast(msg)
    toastTimer.current = setTimeout(() => {
      setToastExiting(true)
      setTimeout(() => {
        setToast(null)
        setToastExiting(false)
      }, 200)
    }, 2000)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])
  const [showTranscript, setShowTranscript] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [activeDownloadId, setActiveDownloadId] = useState<string | null>(null)
  const [activeDownloadFormat, setActiveDownloadFormat] = useState<
    'mp3' | 'mp4' | 'm4a' | 'webm' | null
  >(null)
  const [musicTracks, setMusicTracks] = useState<IdentifiedTrack[] | null>(null)

  const {
    apiKey,
    model,
    downloadMode,
    audioQuality,
    videoQuality,
    videoProfile,
    saveApiKey,
    saveModel,
    saveDownloadMode,
    saveAudioQuality,
    saveVideoQuality,
    saveVideoProfile,
    audioFormat,
    saveAudioFormat,
  } = useSettings()

  const isDownloading = activeDownloadId !== null
  const areActionsDisabled = isDownloading
  const selectedMp4Estimate =
    videoInfo?.estimatedMp4Sizes?.[videoProfile]?.[videoQuality] ||
    videoInfo?.estimatedMp4Size ||
    'Unknown'
  const selectedMp3Estimate =
    videoInfo?.estimatedMp3Sizes?.[audioQuality] ||
    videoInfo?.estimatedMp3Size ||
    'Unknown'

  async function fetchInfo() {
    if (areActionsDisabled) return

    setError(null)

    setSummaryData(null)
    setMusicTracks(null)
    setVideoInfo(null)
    setLoading('info')

    try {
      const res = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setVideoInfo(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  async function fetchMusic() {
    if (areActionsDisabled) return

    setError(null)

    setLoading('music')

    try {
      const res = await fetch('/api/identify-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          ...(apiKey && { apiKey }),
          model,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMusicTracks(data.tracks)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to identify music',
      )
    } finally {
      setLoading(null)
    }
  }

  async function fetchSummary() {
    if (areActionsDisabled) return

    setError(null)

    setLoading('summary')

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          ...(apiKey && { apiKey }),
          model,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSummaryData(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to summarize')
    } finally {
      setLoading(null)
    }
  }

  async function exportAsPdf() {
    if (!summaryData) return

    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const text = buildResultsText(videoInfo, summaryData)
    const lines = doc.splitTextToSize(text, 180)

    let y = 20
    lines.forEach((line: string) => {
      if (y > 270) {
        doc.addPage()
        y = 20
      }

      doc.text(line, 15, y)
      y += 7
    })

    doc.save(`${videoInfo?.title || 'youtube-summary'}.pdf`)
    showToast('PDF exported.')
  }

  async function copySummary() {
    if (!summaryData) return

    await navigator.clipboard.writeText(summaryData.summary)
    showToast('Summary copied to clipboard.')
  }

  function downloadSummaryText() {
    if (!summaryData) return

    triggerDownload(
      `${videoInfo?.title || 'youtube-summary'}-summary.txt`,
      summaryData.summary,
      'text/plain;charset=utf-8',
    )
    showToast('Summary downloaded as TXT.')
  }

  function exportResults(format: 'txt' | 'md') {
    if (!summaryData) return

    const baseName = videoInfo?.title || 'youtube-summary'
    const content =
      format === 'txt'
        ? buildResultsText(videoInfo, summaryData)
        : buildResultsMarkdown(videoInfo, summaryData)

    triggerDownload(
      `${baseName}.${format}`,
      content,
      format === 'txt'
        ? 'text/plain;charset=utf-8'
        : 'text/markdown;charset=utf-8',
    )
    showToast(`Exported as ${format.toUpperCase()}.`)
  }

  function download(format: 'mp3' | 'mp4' | 'm4a' | 'webm') {
    if (!videoInfo || isDownloading) return

    setError(null)

    const downloadId = crypto.randomUUID()
    const params = new URLSearchParams({
      url,
      format,
      downloadMode,
      downloadId,
      audioQuality,
      videoQuality,
      videoProfile,
      title: videoInfo.title,
    })

    const downloadUrl = `/api/download?${params.toString()}`
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = ''
    document.body.appendChild(a)
    a.click()
    a.remove()

    setActiveDownloadId(downloadId)
    setActiveDownloadFormat(format)
    void pollDownloadStatus(downloadId)
  }

  async function pollDownloadStatus(downloadId: string) {
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const MAX_POLLS = 600 // ~10 min at 1s intervals

    for (let i = 0; i < MAX_POLLS; i++) {
      try {
        const res = await fetch(
          `/api/download?status=1&downloadId=${encodeURIComponent(downloadId)}`,
          { cache: 'no-store' },
        )
        const data = await res.json()

        if (data.state === 'failed') {
          setError(data.error || 'Download failed')
          break
        }

        if (data.state === 'completed') break
      } catch {
        // Network error — stop polling silently, browser still has the download
        break
      }

      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    setActiveDownloadId(null)
    setActiveDownloadFormat(null)
  }

  return (
    <main className="bg-background text-foreground min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-2 flex items-center justify-center gap-3">
          <h1 className="text-center text-4xl font-bold">YouTube Savior</h1>
          <button
            onClick={() => setShowSettings(!showSettings)}
            disabled={areActionsDisabled}
            className="rounded-lg p-2 transition-colors hover:bg-gray-200 dark:hover:bg-gray-800"
            title="Settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
        <p className="mb-8 text-center text-gray-500">
          Summarize and download YouTube videos
        </p>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <h3 className="mb-3 text-lg font-semibold">Settings</h3>
            <div className="space-y-6">
              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                <h4 className="mb-3 text-base font-semibold">Common</h4>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Gemini API Key
                    </label>
                    <input
                      type="password"
                      placeholder="Enter your Gemini API key..."
                      value={apiKey}
                      onChange={(e) => saveApiKey(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Get a free key from{' '}
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 underline"
                      >
                        Google AI Studio
                      </a>
                      . Stored only for this session — cleared when you close
                      the tab.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Model
                    </label>
                    <select
                      value={model}
                      onChange={(e) => saveModel(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
                    >
                      {AVAILABLE_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Browser download behavior
                    </label>
                    <select
                      value={downloadMode}
                      onChange={(e) =>
                        saveDownloadMode(e.target.value as DownloadMode)
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
                    >
                      <option value="fast">Fastest delivery</option>
                      <option value="follow">
                        Show in browser immediately
                      </option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      {downloadMode === 'fast'
                        ? 'The file is fully prepared on the server before delivery. Faster overall but the browser download bar only appears once ready.'
                        : 'The file streams to the browser as it is generated. The download bar appears immediately but delivery is significantly slower.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                  <h4 className="mb-3 text-base font-semibold">MP4 video</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Quality ceiling
                      </label>
                      <select
                        value={videoQuality}
                        onChange={(e) =>
                          saveVideoQuality(e.target.value as VideoQuality)
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
                      >
                        {VIDEO_QUALITY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Compatibility profile
                      </label>
                      <select
                        value={videoProfile}
                        onChange={(e) =>
                          saveVideoProfile(e.target.value as VideoProfile)
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
                      >
                        {VIDEO_PROFILE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        {
                          VIDEO_PROFILE_OPTIONS.find(
                            (option) => option.value === videoProfile,
                          )?.description
                        }
                      </p>
                    </div>
                    <p className="text-xs text-gray-500">
                      This controls the codec and container preference for MP4
                      output. Higher compatibility prefers H.264/AAC inside MP4.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                  <h4 className="mb-3 text-base font-semibold">Audio</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Audio format
                      </label>
                      <select
                        value={audioFormat}
                        onChange={(e) =>
                          saveAudioFormat(e.target.value as AudioFormat)
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
                      >
                        {AUDIO_FORMAT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        {
                          AUDIO_FORMAT_OPTIONS.find(
                            (o) => o.value === audioFormat,
                          )?.description
                        }
                      </p>
                    </div>
                    {audioFormat === 'mp3' && (
                      <div>
                        <label className="mb-1 block text-sm font-medium">
                          MP3 quality
                        </label>
                        <select
                          value={audioQuality}
                          onChange={(e) =>
                            saveAudioQuality(e.target.value as AudioQuality)
                          }
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
                        >
                          {AUDIO_QUALITY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* URL Input */}
        <div className="mb-6 flex gap-2">
          <input
            type="text"
            placeholder="Paste a YouTube URL..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && url && fetchInfo()}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 focus:ring-2 focus:ring-red-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
          <button
            onClick={fetchInfo}
            disabled={!url || loading === 'info' || areActionsDisabled}
            className="rounded-lg bg-red-600 px-6 py-3 font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading === 'info' ? 'Loading...' : 'Go'}
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-100 p-4 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Video Info Card */}
        {videoInfo && (
          <div className="mb-6 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Image
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                width={288}
                height={162}
                className="aspect-video w-full shrink-0 rounded-lg object-cover sm:w-48"
              />
              <div className="flex-1">
                <h2 className="mb-1 text-xl font-semibold">
                  {videoInfo.title}
                </h2>
                <p className="mb-1 text-sm text-gray-500">
                  Duration: {videoInfo.duration}
                </p>
                <p className="mb-4 text-sm text-gray-500">
                  Highest source quality: {videoInfo.highestQuality}
                </p>
                <p className="mb-4 text-sm text-gray-500">
                  Browser behavior: {getBrowserModeLabel(downloadMode)}
                </p>

                <div className="mb-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                    <h3 className="mb-2 text-sm font-semibold">MP4 video</h3>
                    <p className="text-sm text-gray-500">
                      Selected output quality:{' '}
                      {getVideoQualityLabel(videoQuality)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Profile: {getVideoProfileLabel(videoProfile)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Estimated size: {selectedMp4Estimate}
                    </p>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                    <h3 className="mb-2 text-sm font-semibold">
                      {audioFormat.toUpperCase()} audio
                    </h3>
                    {audioFormat === 'mp3' ? (
                      <>
                        <p className="text-sm text-gray-500">
                          Selected output quality:{' '}
                          {getAudioQualityLabel(audioQuality)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Estimated size: {selectedMp3Estimate}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Original quality, no conversion
                      </p>
                    )}
                  </div>
                </div>

                <table className="border-separate border-spacing-y-1.5">
                  <thead className="hidden sm:table-header-group">
                    <tr>
                      <th className="pb-1 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                        AI
                      </th>
                      <th className="pb-1 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                        Download
                      </th>
                    </tr>
                  </thead>
                  <tbody className="sm:hidden">
                    <tr>
                      <td className="pr-3 text-xs font-medium uppercase tracking-wide text-gray-400">
                        AI
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={fetchSummary}
                            disabled={
                              loading === 'summary' || areActionsDisabled
                            }
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                          >
                            {loading === 'summary'
                              ? 'Summarizing...'
                              : 'Summarize'}
                          </button>
                          <button
                            onClick={fetchMusic}
                            disabled={
                              loading === 'music' || areActionsDisabled
                            }
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {loading === 'music'
                              ? 'Identifying...'
                              : 'Identify Music'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="pr-3 text-xs font-medium uppercase tracking-wide text-gray-400">
                        Download
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => download('mp4')}
                            disabled={areActionsDisabled}
                            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {activeDownloadFormat === 'mp4'
                              ? 'Downloading MP4...'
                              : 'Download MP4'}
                          </button>
                          <button
                            onClick={() => download(audioFormat)}
                            disabled={areActionsDisabled}
                            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {activeDownloadFormat &&
                            activeDownloadFormat !== 'mp4'
                              ? `Downloading ${activeDownloadFormat.toUpperCase()}...`
                              : `Download ${audioFormat.toUpperCase()}`}
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                  <tbody className="hidden sm:table-row-group">
                    <tr>
                      <td className="pr-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={fetchSummary}
                            disabled={
                              loading === 'summary' || areActionsDisabled
                            }
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                          >
                            {loading === 'summary'
                              ? 'Summarizing...'
                              : 'Summarize'}
                          </button>
                          <button
                            onClick={fetchMusic}
                            disabled={
                              loading === 'music' || areActionsDisabled
                            }
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {loading === 'music'
                              ? 'Identifying...'
                              : 'Identify Music'}
                          </button>
                        </div>
                      </td>
                      <td className="align-top">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => download('mp4')}
                            disabled={areActionsDisabled}
                            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {activeDownloadFormat === 'mp4'
                              ? 'Downloading MP4...'
                              : 'Download MP4'}
                          </button>
                          <button
                            onClick={() => download(audioFormat)}
                            disabled={areActionsDisabled}
                            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {activeDownloadFormat &&
                            activeDownloadFormat !== 'mp4'
                              ? `Downloading ${activeDownloadFormat.toUpperCase()}...`
                              : `Download ${audioFormat.toUpperCase()}`}
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
                {isDownloading && (
                  <p className="mt-3 text-sm text-gray-500">
                    {activeDownloadFormat?.toUpperCase()} download in
                    progress...
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Music Identification Results */}
        {musicTracks !== null && (
          <div className="mb-6 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <h3 className="mb-3 text-lg font-semibold">Music Identified</h3>
            {musicTracks.length === 0 ? (
              <p className="text-sm text-gray-500">
                No music could be identified in this video.
              </p>
            ) : (
              <ul className="space-y-3">
                {musicTracks.map((track, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900"
                  >
                    <div>
                      <p className="font-medium">
                        {track.title}
                      </p>
                      <p className="text-sm text-gray-500">
                        {track.artist}
                      </p>
                      {track.context && (
                        <p className="mt-1 text-xs text-gray-400">
                          {track.context}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(
                          `${track.title} - ${track.artist}`,
                        )
                        showToast('Copied to clipboard.')
                      }}
                      className="shrink-0 rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                      title="Copy song name"
                    >
                      Copy
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Summary Section */}
        {summaryData && (
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">Summary</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={copySummary}
                    className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                  >
                    Copy Summary
                  </button>
                  <button
                    onClick={downloadSummaryText}
                    className="rounded-lg bg-slate-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
                  >
                    Download Summary
                  </button>
                </div>
              </div>
              <p className="leading-relaxed text-gray-700 dark:text-gray-300">
                {summaryData.summary}
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
              <h3 className="mb-3 text-lg font-semibold">Export</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => exportResults('txt')}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  Export TXT
                </button>
                <button
                  onClick={() => exportResults('md')}
                  className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
                >
                  Export MD
                </button>
                <button
                  onClick={exportAsPdf}
                  className="rounded-lg bg-emerald-800 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-900"
                >
                  Export PDF
                </button>
              </div>
            </div>

            {summaryData.keyPoints.length > 0 && (
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="mb-2 text-lg font-semibold">Key Points</h3>
                <ul className="list-inside list-disc space-y-1 text-gray-700 dark:text-gray-300">
                  {summaryData.keyPoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {summaryData.transcript && (
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="mb-2 text-lg font-semibold transition-colors hover:text-blue-500"
                >
                  {showTranscript ? 'Hide' : 'Show'} Full Transcript
                </button>
                {showTranscript && (
                  <p className="mt-2 max-h-96 overflow-y-auto text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                    {summaryData.transcript}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div className="pointer-events-none fixed right-6 top-6 z-50">
          <div
            key={toastKey.current}
            className={`pointer-events-auto rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-gray-100 dark:text-gray-900 ${toastExiting ? 'toast-exit' : 'toast-enter'}`}
          >
            {toast}
          </div>
        </div>
      )}
    </main>
  )
}
