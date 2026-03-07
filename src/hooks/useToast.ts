import { useCallback, useEffect, useRef, useState } from 'react'

export function useToast(duration = 2000) {
  const [toast, setToast] = useState<string | null>(null)
  const [toastExiting, setToastExiting] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [toastKey, setToastKey] = useState(0)

  const showToast = useCallback(
    (msg: string) => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
      setToastKey((k) => k + 1)
      setToastExiting(false)
      setToast(msg)
      toastTimer.current = setTimeout(() => {
        setToastExiting(true)
        setTimeout(() => {
          setToast(null)
          setToastExiting(false)
        }, 200)
      }, duration)
    },
    [duration],
  )

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  return { toast, toastExiting, toastKey, showToast }
}
