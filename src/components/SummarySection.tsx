'use client'

import type { SummaryData, VideoInfo } from '@/lib/types'
import { useState } from 'react'

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

interface SummarySectionProps {
  summaryData: SummaryData
  videoInfo: VideoInfo | null
  showToast: (msg: string) => void
}

export function SummarySection({
  summaryData,
  videoInfo,
  showToast,
}: SummarySectionProps) {
  const [showTranscript, setShowTranscript] = useState(false)

  async function copySummary() {
    await navigator.clipboard.writeText(summaryData.summary)
    showToast('Summary copied to clipboard.')
  }

  function downloadSummaryText() {
    triggerDownload(
      `${videoInfo?.title || 'youtube-summary'}-summary.txt`,
      summaryData.summary,
      'text/plain;charset=utf-8',
    )
    showToast('Summary downloaded as TXT.')
  }

  function exportResults(format: 'txt' | 'md') {
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

  return (
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
  )
}
