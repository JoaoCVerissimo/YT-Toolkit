# YT Toolkit

A self-hosted web app to download, summarize, and analyze YouTube videos. Built with Next.js, powered by yt-dlp and Google Gemini.

## Features

### Video information

- Fetches video metadata (title, duration, thumbnail, available qualities)
- Estimates download sizes for each quality and format combination

### AI-powered tools (via Google Gemini)

- **Summarization** — generates concise summaries and key points from video transcripts or directly from the video
- **Music identification** — identifies songs and music tracks used in a video with artist, title, and context
- Falls back to direct video analysis when no transcript/captions are available
- Configurable model selection (Gemini 3 Flash, 3.1 Flash Lite, 3.1 Pro)

### Export options

- Copy summary to clipboard
- Download summary as TXT
- Export full results (summary + key points + transcript) as TXT, Markdown, or PDF

### Video download (MP4)

- Quality ceiling from 144p to 4K (2160p)
- Compatibility profile: H.264/AAC (broadest support) or best available codecs
- Merge and remux handled server-side via ffmpeg

### Audio download

- **MP3** — converted from source audio with configurable bitrate (64k–320k); universally compatible
- **M4A** — original AAC audio, no conversion, fast download
- **WebM** — original Opus audio, no conversion, best quality per bitrate

### Download modes

- **Fastest delivery** — file is fully prepared on the server before the browser receives it
- **Browser follow** — streams to the browser as it is generated; the download bar appears immediately

### Settings

- All preferences (API key, model, download mode, quality, format) are stored locally in the browser
- Dark mode support

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (bundled via `youtube-dl-exec` or available on PATH)
- [ffmpeg](https://ffmpeg.org/) (bundled via `ffmpeg-static` or available on PATH) — required for MP3 conversion and MP4 merging
- A [Gemini API key](https://aistudio.google.com/apikey) (free, required only for AI features)

## Live Demo

Deployed on [Render](https://render.com/) — [yt-toolkit.onrender.com](https://yt-toolkit-sazr.onrender.com/)

## Getting Started

### Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Deploy to Render

1. Connect your GitHub repo on [Render](https://render.com/)
2. Use the following settings:

| Setting            | Value                                            |
| ------------------ | ------------------------------------------------ |
| **Root Directory** | _(leave blank)_                                  |
| **Build Command**  | `npm install; pip install yt-dlp; npm run build` |
| **Start Command**  | `npm run start`                                  |

> `yt-dlp` is installed via pip at build time since `youtube-dl-exec` requires the system binary.

No environment variables are required — users provide their own Gemini API key through the app's settings.

## Tech Stack

- [Next.js](https://nextjs.org/) (App Router)
- [Tailwind CSS](https://tailwindcss.com/)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) via `youtube-dl-exec`
- [ffmpeg](https://ffmpeg.org/) via `ffmpeg-static`
- [Google Gemini](https://ai.google.dev/) for AI summarization and music identification
- [jsPDF](https://github.com/parallax/jsPDF) for PDF export
