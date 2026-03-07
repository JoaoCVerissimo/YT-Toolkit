# YouTube Savior

A self-hosted web app for summarizing and downloading YouTube videos. Built with Next.js and powered by yt-dlp.

## Features

### Video information

- Fetches video metadata (title, duration, thumbnail, available qualities)
- Estimates download sizes for each quality and format combination

### AI-powered summarization

- Generates concise summaries and key points from video transcripts using Google Gemini
- Configurable model selection
- Supports manual and automatic captions via yt-dlp

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

- All preferences (API key, model, download mode, quality, format) are stored locally in the browser via `localStorage`
- Dark mode support

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (bundled via `youtube-dl-exec` or available on PATH)
- [ffmpeg](https://ffmpeg.org/) (bundled via `ffmpeg-static` or available on PATH) — required for MP3 conversion and MP4 merging
- A [Gemini API key](https://aistudio.google.com/apikey) (free, required only for summarization)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack

- [Next.js](https://nextjs.org/) (App Router)
- [Tailwind CSS](https://tailwindcss.com/)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) via `youtube-dl-exec`
- [ffmpeg](https://ffmpeg.org/) via `ffmpeg-static`
- [Google Gemini](https://ai.google.dev/) for AI summarization
- [jsPDF](https://github.com/parallax/jsPDF) for PDF export
