import { DEFAULT_MODEL } from '@/lib/models'
import {
  AUDIO_FORMAT_OPTIONS,
  AUDIO_QUALITY_OPTIONS,
  VIDEO_QUALITY_OPTIONS,
  type AudioFormat,
  type AudioQuality,
  type DownloadMode,
  type VideoProfile,
  type VideoQuality,
} from '@/lib/types'
import { useEffect, useState } from 'react'

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
  if (typeof window === 'undefined') return 'fast'
  const saved = localStorage.getItem('download_mode')
  return saved === 'follow' ? 'follow' : 'fast'
}

function getStoredAudioQuality(): AudioQuality {
  if (typeof window === 'undefined') return '192k'
  const saved = localStorage.getItem('audio_quality')
  return AUDIO_QUALITY_OPTIONS.some((o) => o.value === saved)
    ? (saved as AudioQuality)
    : '192k'
}

function getStoredVideoQuality(): VideoQuality {
  if (typeof window === 'undefined') return 'best'
  const saved = localStorage.getItem('video_quality')
  return VIDEO_QUALITY_OPTIONS.some((o) => o.value === saved)
    ? (saved as VideoQuality)
    : 'best'
}

function getStoredVideoProfile(): VideoProfile {
  if (typeof window === 'undefined') return 'compatible'
  const saved = localStorage.getItem('video_profile')
  return saved === 'best' ? 'best' : 'compatible'
}

function getStoredAudioFormat(): AudioFormat {
  if (typeof window === 'undefined') return 'mp3'
  const saved = localStorage.getItem('audio_format')
  return AUDIO_FORMAT_OPTIONS.some((o) => o.value === saved)
    ? (saved as AudioFormat)
    : 'mp3'
}

export type Theme = 'light' | 'dark'

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const saved = localStorage.getItem('theme')
  return saved === 'light' ? 'light' : 'dark'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function useSettings() {
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
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

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

  function saveTheme(t: Theme) {
    setTheme(t)
    localStorage.setItem('theme', t)
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
    theme,
    saveTheme,
  }
}
