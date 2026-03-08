# YT Toolkit

A self-hosted web app to download, summarize, and analyze YouTube videos. Built with Next.js, powered by yt-dlp and Google Gemini.

> **Note:** YouTube actively blocks requests from data center IPs. Downloads, transcripts, and AI features that depend on yt-dlp **only work when running locally** (residential IP). The video info endpoint works everywhere thanks to the YouTube Data API / oEmbed fallback. See [Hosting Limitations](#hosting-limitations) for details.

## Features

### Video information

- Fetches video metadata (title, duration, thumbnail) via YouTube Data API v3 or oEmbed
- Estimates MP3 download sizes based on duration and bitrate

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

### Environment variables

| Variable          | Required | Description                                                                                |
| ----------------- | -------- | ------------------------------------------------------------------------------------------ |
| `YOUTUBE_API_KEY` | No       | YouTube Data API v3 key. Enables duration data in video info. Free tier: 10,000 units/day. |

Users provide their own Gemini API key through the app's settings UI — no server-side key is needed.

#### Getting a YouTube API key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Enable the **YouTube Data API v3** from the API Library
4. Go to **Credentials** and create an **API key**
5. Set the key as `YOUTUBE_API_KEY` in your environment (`.env.local` for local dev, or in your hosting provider's settings)

Without this key the app still works — it falls back to oEmbed, which returns title and thumbnail but no duration.

## Hosting Limitations

YouTube aggressively blocks requests from data center IP ranges (AWS, GCP, Render, Railway, Fly.io, etc.). This affects any tool that connects directly to YouTube to stream or download content.

| Feature              | Local (residential IP) | Data center hosting                |
| -------------------- | ---------------------- | ---------------------------------- |
| Video info           | Works                  | Works (YouTube Data API / oEmbed)  |
| MP3/MP4 downloads    | Works                  | Blocked by YouTube                 |
| Transcripts          | Works                  | Blocked by YouTube                 |
| AI summarization     | Works                  | Blocked (needs transcript)         |
| Music identification | Works                  | Blocked (needs video access)       |

**Why?** Downloads and transcripts rely on yt-dlp, which must fetch content directly from YouTube. YouTube detects and blocks these requests from known data center IP ranges, regardless of cookies or authentication.

**Workarounds** (not implemented):

- Use a residential proxy service (adds cost and complexity)
- Self-host on a residential connection (e.g. home server, Raspberry Pi)

## Tech Stack

- [Next.js](https://nextjs.org/) (App Router)
- [Tailwind CSS](https://tailwindcss.com/)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) via `youtube-dl-exec`
- [ffmpeg](https://ffmpeg.org/) via `ffmpeg-static`
- [Google Gemini](https://ai.google.dev/) for AI summarization and music identification
- [jsPDF](https://github.com/parallax/jsPDF) for PDF export
