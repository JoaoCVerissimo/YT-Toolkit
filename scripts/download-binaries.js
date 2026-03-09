/**
 * Downloads platform-specific yt-dlp and ffmpeg binaries for Electron builds.
 *
 * Usage:
 *   node scripts/download-binaries.js win-x64
 *   node scripts/download-binaries.js mac-arm64
 *   node scripts/download-binaries.js mac-x64
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const PLATFORMS = {
  'win-x64': {
    ytdlp:
      'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
    ytdlpFile: 'yt-dlp.exe',
    ffmpeg:
      'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
    ffmpegFile: 'ffmpeg.exe',
    ffmpegArchivePath: 'ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe',
  },
  'mac-arm64': {
    ytdlp:
      'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
    ytdlpFile: 'yt-dlp',
    ffmpeg:
      'https://www.osxexperts.net/ffmpeg7arm.zip',
    ffmpegFile: 'ffmpeg',
    ffmpegArchivePath: 'ffmpeg',
  },
  'mac-x64': {
    ytdlp:
      'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
    ytdlpFile: 'yt-dlp',
    ffmpeg:
      'https://www.osxexperts.net/ffmpeg7intel.zip',
    ffmpegFile: 'ffmpeg',
    ffmpegArchivePath: 'ffmpeg',
  },
}

const platform = process.argv[2]

if (!platform || !PLATFORMS[platform]) {
  console.error(`Usage: node scripts/download-binaries.js <platform>`)
  console.error(`Platforms: ${Object.keys(PLATFORMS).join(', ')}`)
  process.exit(1)
}

const config = PLATFORMS[platform]
const binDir = path.join(__dirname, '..', 'binaries', platform)

async function download(url, destPath) {
  console.log(`  Downloading ${url}`)
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(destPath, buffer)
  console.log(`  Saved ${destPath} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`)
}

async function main() {
  fs.mkdirSync(binDir, { recursive: true })

  // yt-dlp
  const ytdlpDest = path.join(binDir, config.ytdlpFile)
  if (fs.existsSync(ytdlpDest)) {
    console.log(`yt-dlp already exists, skipping`)
  } else {
    console.log(`Downloading yt-dlp for ${platform}...`)
    await download(config.ytdlp, ytdlpDest)
    if (process.platform !== 'win32') {
      fs.chmodSync(ytdlpDest, 0o755)
    }
  }

  // ffmpeg
  const ffmpegDest = path.join(binDir, config.ffmpegFile)
  if (fs.existsSync(ffmpegDest)) {
    console.log(`ffmpeg already exists, skipping`)
  } else {
    console.log(`Downloading ffmpeg for ${platform}...`)
    const archivePath = path.join(binDir, 'ffmpeg-archive.zip')
    await download(config.ffmpeg, archivePath)

    console.log(`  Extracting ffmpeg...`)
    const tmpExtract = path.join(binDir, '_extract')
    fs.mkdirSync(tmpExtract, { recursive: true })

    execSync(`unzip -o "${archivePath}" "${config.ffmpegArchivePath}" -d "${tmpExtract}"`, {
      stdio: 'pipe',
    })

    const extracted = path.join(tmpExtract, config.ffmpegArchivePath)
    fs.copyFileSync(extracted, ffmpegDest)
    if (process.platform !== 'win32') {
      fs.chmodSync(ffmpegDest, 0o755)
    }

    // Cleanup
    fs.rmSync(tmpExtract, { recursive: true, force: true })
    fs.unlinkSync(archivePath)
    console.log(`  Extracted ${ffmpegDest}`)
  }

  console.log(`\nDone! Binaries for ${platform} are in: ${binDir}`)
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
