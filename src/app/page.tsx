'use client'

import { LoadingOverlay } from '@/components/LoadingOverlay'
import { MusicSection } from '@/components/MusicSection'
import { SettingsPanel } from '@/components/SettingsPanel'
import { SummarySection } from '@/components/SummarySection'
import { Toast } from '@/components/Toast'
import { VideoCard } from '@/components/VideoCard'
import { useSettings } from '@/hooks/useSettings'
import { useToast } from '@/hooks/useToast'
import type { IdentifiedTrack, SummaryData, VideoInfo } from '@/lib/types'
import { useState } from 'react'

export default function Home() {
  const [url, setUrl] = useState('')
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [activeDownloadId, setActiveDownloadId] = useState<string | null>(null)
  const [activeDownloadFormat, setActiveDownloadFormat] = useState<
    'mp3' | 'mp4' | 'm4a' | 'webm' | null
  >(null)
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)
  const [musicTracks, setMusicTracks] = useState<IdentifiedTrack[] | null>(null)

  const { toast, toastExiting, toastKey, showToast } = useToast()
  const settings = useSettings()

  const isDownloading = activeDownloadId !== null
  const areActionsDisabled = isDownloading
  const selectedMp4Estimate =
    videoInfo?.estimatedMp4Sizes?.[settings.videoProfile]?.[
      settings.videoQuality
    ] ||
    videoInfo?.estimatedMp4Size ||
    'Unknown'
  const selectedMp3Estimate =
    videoInfo?.estimatedMp3Sizes?.[settings.audioQuality] ||
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

    if (!settings.apiKey) {
      setError('A Gemini API key is required for AI features. Add one in Settings.')
      return
    }

    setError(null)
    setLoading('music')

    try {
      const res = await fetch('/api/identify-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          ...(settings.apiKey && { apiKey: settings.apiKey }),
          model: settings.model,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMusicTracks(data.tracks)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to identify music')
    } finally {
      setLoading(null)
    }
  }

  async function fetchSummary() {
    if (areActionsDisabled) return

    if (!settings.apiKey) {
      setError('A Gemini API key is required for AI features. Add one in Settings.')
      return
    }

    setError(null)
    setLoading('summary')

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          ...(settings.apiKey && { apiKey: settings.apiKey }),
          model: settings.model,
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

  function download(format: 'mp3' | 'mp4' | 'm4a' | 'webm') {
    if (!videoInfo || isDownloading) return

    setError(null)

    const downloadId = crypto.randomUUID()
    const params = new URLSearchParams({
      url,
      format,
      downloadId,
      audioQuality: settings.audioQuality,
      videoQuality: settings.videoQuality,
      videoProfile: settings.videoProfile,
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
    setDownloadProgress(null)
    void pollDownloadStatus(downloadId)
  }

  async function pollDownloadStatus(downloadId: string) {
    await new Promise((resolve) => setTimeout(resolve, 500))

    const MAX_POLLS = 1200 // ~10 min at 500ms intervals

    for (let i = 0; i < MAX_POLLS; i++) {
      try {
        const res = await fetch(
          `/api/download?status=1&downloadId=${encodeURIComponent(downloadId)}`,
          { cache: 'no-store' },
        )
        const data = await res.json()

        if (data.progress != null) {
          setDownloadProgress(data.progress)
        }

        if (data.state === 'failed') {
          setError(data.error || 'Download failed')
          break
        }

        if (data.state === 'completed') break
      } catch {
        // Network error — stop polling silently, browser still has the download
        break
      }

      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    setActiveDownloadId(null)
    setActiveDownloadFormat(null)
    setDownloadProgress(null)
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-2 flex items-center justify-center gap-3">
          <h1 className="text-center text-4xl font-bold">YT Toolkit</h1>
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
        {showSettings && <SettingsPanel {...settings} />}

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
          <VideoCard
            videoInfo={videoInfo}
            audioFormat={settings.audioFormat}
            audioQuality={settings.audioQuality}
            videoQuality={settings.videoQuality}
            videoProfile={settings.videoProfile}
            selectedMp4Estimate={selectedMp4Estimate}
            selectedMp3Estimate={selectedMp3Estimate}
            loading={loading}
            areActionsDisabled={areActionsDisabled}
            activeDownloadFormat={activeDownloadFormat}
            isDownloading={isDownloading}
            onSummarize={fetchSummary}
            onIdentifyMusic={fetchMusic}
            onDownload={download}
          />
        )}

        {/* Music Identification Results */}
        {musicTracks !== null && (
          <MusicSection tracks={musicTracks} showToast={showToast} />
        )}

        {summaryData && (
          <SummarySection
            summaryData={summaryData}
            videoInfo={videoInfo}
            showToast={showToast}
          />
        )}
      </div>

      {toast && (
        <Toast message={toast} toastKey={toastKey} exiting={toastExiting} />
      )}

      {loading === 'info' && (
        <LoadingOverlay
          title="Fetching video info..."
          subtitle="Retrieving metadata from YouTube"
        />
      )}
      {loading === 'summary' && (
        <LoadingOverlay
          title="Summarizing video..."
          subtitle="AI is analyzing the content"
        />
      )}
      {loading === 'music' && (
        <LoadingOverlay
          title="Identifying music..."
          subtitle="AI is listening for tracks"
        />
      )}
      {isDownloading && (
        <LoadingOverlay
          title={`Downloading ${activeDownloadFormat?.toUpperCase()}...`}
          subtitle={downloadProgress != null ? `${Math.round(downloadProgress)}% complete` : 'Preparing your file'}
          progress={downloadProgress}
        />
      )}
    </main>
  )
}
