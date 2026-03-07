interface LoadingOverlayProps {
  title: string
  subtitle?: string
  progress?: number | null
}

export function LoadingOverlay({ title, subtitle, progress }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-gray-700 bg-gray-900 p-10">
        {progress != null ? (
          <div className="relative h-14 w-14">
            <svg className="h-14 w-14 -rotate-90" viewBox="0 0 50 50" fill="none">
              <circle
                cx="25"
                cy="25"
                r="20"
                stroke="currentColor"
                strokeWidth="4"
                className="text-gray-700"
              />
              <circle
                cx="25"
                cy="25"
                r="20"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                className="text-red-500 transition-all duration-300"
                strokeDasharray={`${(progress / 100) * 125.66} 125.66`}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
              {Math.round(progress)}%
            </span>
          </div>
        ) : (
          <svg
            className="h-14 w-14 animate-spin"
            viewBox="0 0 50 50"
            fill="none"
          >
            <circle
              cx="25"
              cy="25"
              r="20"
              stroke="currentColor"
              strokeWidth="4"
              className="text-gray-700"
            />
            <path
              d="M25 5a20 20 0 0 1 20 20"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              className="text-red-500"
            />
          </svg>
        )}
        <div className="text-center">
          <p className="text-xl font-bold text-white">{title}</p>
          {subtitle && (
            <p className="mt-2 text-sm text-gray-400">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  )
}
