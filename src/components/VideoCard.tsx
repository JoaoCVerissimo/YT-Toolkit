import {
  getAudioQualityLabel,
  getBrowserModeLabel,
  getVideoProfileLabel,
  getVideoQualityLabel,
  type AudioFormat,
  type AudioQuality,
  type DownloadMode,
  type VideoInfo,
  type VideoProfile,
  type VideoQuality,
} from '@/lib/types'
import Image from 'next/image'

interface VideoCardProps {
  videoInfo: VideoInfo
  downloadMode: DownloadMode
  audioFormat: AudioFormat
  audioQuality: AudioQuality
  videoQuality: VideoQuality
  videoProfile: VideoProfile
  selectedMp4Estimate: string
  selectedMp3Estimate: string
  loading: string | null
  areActionsDisabled: boolean
  activeDownloadFormat: string | null
  isDownloading: boolean
  onSummarize: () => void
  onIdentifyMusic: () => void
  onDownload: (format: 'mp3' | 'mp4' | 'm4a' | 'webm') => void
}

export function VideoCard({
  videoInfo,
  downloadMode,
  audioFormat,
  audioQuality,
  videoQuality,
  videoProfile,
  selectedMp4Estimate,
  selectedMp3Estimate,
  loading,
  areActionsDisabled,
  activeDownloadFormat,
  isDownloading,
  onSummarize,
  onIdentifyMusic,
  onDownload,
}: VideoCardProps) {
  return (
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
          <h2 className="mb-1 text-xl font-semibold">{videoInfo.title}</h2>
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
                Selected output quality: {getVideoQualityLabel(videoQuality)}
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
                    Selected output quality: {getAudioQualityLabel(audioQuality)}
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
                      onClick={onSummarize}
                      disabled={loading === 'summary' || areActionsDisabled}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading === 'summary' ? 'Summarizing...' : 'Summarize'}
                    </button>
                    <button
                      onClick={onIdentifyMusic}
                      disabled={loading === 'music' || areActionsDisabled}
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
                      onClick={() => onDownload('mp4')}
                      disabled={areActionsDisabled}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {activeDownloadFormat === 'mp4'
                        ? 'Downloading MP4...'
                        : 'Download MP4'}
                    </button>
                    <button
                      onClick={() => onDownload(audioFormat)}
                      disabled={areActionsDisabled}
                      className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {activeDownloadFormat && activeDownloadFormat !== 'mp4'
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
                      onClick={onSummarize}
                      disabled={loading === 'summary' || areActionsDisabled}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading === 'summary' ? 'Summarizing...' : 'Summarize'}
                    </button>
                    <button
                      onClick={onIdentifyMusic}
                      disabled={loading === 'music' || areActionsDisabled}
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
                      onClick={() => onDownload('mp4')}
                      disabled={areActionsDisabled}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {activeDownloadFormat === 'mp4'
                        ? 'Downloading MP4...'
                        : 'Download MP4'}
                    </button>
                    <button
                      onClick={() => onDownload(audioFormat)}
                      disabled={areActionsDisabled}
                      className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {activeDownloadFormat && activeDownloadFormat !== 'mp4'
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
              {activeDownloadFormat?.toUpperCase()} download in progress...
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
