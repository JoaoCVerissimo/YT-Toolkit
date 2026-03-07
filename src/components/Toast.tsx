interface ToastProps {
  message: string
  toastKey: number
  exiting: boolean
}

export function Toast({ message, toastKey, exiting }: ToastProps) {
  return (
    <div className="pointer-events-none fixed right-6 top-6 z-50">
      <div
        key={toastKey}
        className={`pointer-events-auto rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-gray-100 dark:text-gray-900 ${exiting ? 'toast-exit' : 'toast-enter'}`}
      >
        {message}
      </div>
    </div>
  )
}
