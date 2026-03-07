import { AVAILABLE_MODELS } from '@/lib/models'
import type { Theme } from '@/hooks/useSettings'
import {
  AUDIO_FORMAT_OPTIONS,
  AUDIO_QUALITY_OPTIONS,
  VIDEO_PROFILE_OPTIONS,
  VIDEO_QUALITY_OPTIONS,
  type AudioFormat,
  type AudioQuality,
  type DownloadMode,
  type VideoProfile,
  type VideoQuality,
} from '@/lib/types'

interface SettingsPanelProps {
  apiKey: string
  model: string
  downloadMode: DownloadMode
  audioQuality: AudioQuality
  videoQuality: VideoQuality
  videoProfile: VideoProfile
  audioFormat: AudioFormat
  theme: Theme
  saveApiKey: (key: string) => void
  saveModel: (model: string) => void
  saveDownloadMode: (mode: DownloadMode) => void
  saveAudioQuality: (quality: AudioQuality) => void
  saveVideoQuality: (quality: VideoQuality) => void
  saveVideoProfile: (profile: VideoProfile) => void
  saveAudioFormat: (format: AudioFormat) => void
  saveTheme: (theme: Theme) => void
}

export function SettingsPanel({
  apiKey,
  model,
  downloadMode,
  audioQuality,
  videoQuality,
  videoProfile,
  audioFormat,
  theme,
  saveApiKey,
  saveModel,
  saveDownloadMode,
  saveAudioQuality,
  saveVideoQuality,
  saveVideoProfile,
  saveAudioFormat,
  saveTheme,
}: SettingsPanelProps) {
  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-3 text-lg font-semibold">Settings</h3>
      <div className="space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-base font-semibold">Common</h4>
            <button
              onClick={() => saveTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-lg p-1.5 transition-colors hover:bg-gray-200 dark:hover:bg-gray-800"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              )}
            </button>
          </div>
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
                . Stored only for this session — cleared when you close the tab.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Model</label>
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
                <option value="follow">Show in browser immediately</option>
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
                This controls the codec and container preference for MP4 output.
                Higher compatibility prefers H.264/AAC inside MP4.
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
                    AUDIO_FORMAT_OPTIONS.find((o) => o.value === audioFormat)
                      ?.description
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
  )
}
