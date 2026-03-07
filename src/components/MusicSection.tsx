import type { IdentifiedTrack } from '@/lib/types'

interface MusicSectionProps {
  tracks: IdentifiedTrack[]
  showToast: (msg: string) => void
}

export function MusicSection({ tracks, showToast }: MusicSectionProps) {
  return (
    <div className="mb-6 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <h3 className="mb-3 text-lg font-semibold">Music Identified</h3>
      {tracks.length === 0 ? (
        <p className="text-sm text-gray-500">
          No music could be identified in this video.
        </p>
      ) : (
        <ul className="space-y-3">
          {tracks.map((track, i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900"
            >
              <div>
                <p className="font-medium">{track.title}</p>
                <p className="text-sm text-gray-500">{track.artist}</p>
                {track.context && (
                  <p className="mt-1 text-xs text-gray-400">{track.context}</p>
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
  )
}
