import { AVAILABLE_MODELS, DEFAULT_MODEL } from './models'

export function safeErrorMessage(
  error: unknown,
  fallback: string,
): string {
  const real = error instanceof Error ? error.message : String(error)

  if (process.env.NODE_ENV === 'development') {
    return real
  }

  console.error(`[youtube-savior] ${fallback}:`, real)
  return fallback
}

export function parseBodyUrl(body: Record<string, unknown>): string | null {
  const url = body?.url
  if (typeof url !== 'string') return null
  const trimmed = url.trim()
  return trimmed.length > 0 && trimmed.length <= 2048 ? trimmed : null
}

export function parseBodyApiKey(body: Record<string, unknown>): string {
  const key = body?.apiKey
  if (typeof key !== 'string') return ''
  return key.trim().slice(0, 256)
}

export function parseBodyModel(body: Record<string, unknown>): string {
  const model = body?.model
  if (typeof model !== 'string') return DEFAULT_MODEL
  const valid = AVAILABLE_MODELS.some((m) => m.id === model)
  return valid ? model : DEFAULT_MODEL
}
