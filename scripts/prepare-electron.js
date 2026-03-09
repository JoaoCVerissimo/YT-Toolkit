/**
 * Copies the Next.js standalone output into `app-server/` for Electron packaging.
 *
 * electron-builder silently strips any directory named `node_modules` from
 * extraResources. We work around this by renaming it to `_modules`.
 * The Electron main process sets NODE_PATH to point there at runtime.
 */

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const standalone = path.join(root, '.next', 'standalone')
const dest = path.join(root, 'app-server')

function copyDir(src, target) {
  if (!fs.existsSync(src)) {
    console.log(`  skip (not found): ${src}`)
    return
  }
  fs.cpSync(src, target, { recursive: true })
  console.log(`  ${src} → ${target}`)
}

// Clean previous output
if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true })
}

console.log('Preparing standalone output for Electron…')

// Copy standalone (includes node_modules)
copyDir(standalone, dest)

// Copy static assets that standalone excludes
copyDir(
  path.join(root, '.next', 'static'),
  path.join(dest, '.next', 'static'),
)
copyDir(path.join(root, 'public'), path.join(dest, 'public'))

// Rename node_modules → _modules so electron-builder won't strip it
const nm = path.join(dest, 'node_modules')
const renamed = path.join(dest, '_modules')
if (fs.existsSync(nm)) {
  fs.renameSync(nm, renamed)
  console.log('  ✓ node_modules renamed to _modules')
} else {
  console.error('  ✗ node_modules is MISSING in standalone output!')
  process.exit(1)
}

// Verify next made it
const nextPkg = path.join(renamed, 'next', 'package.json')
if (fs.existsSync(nextPkg)) {
  console.log('  ✓ _modules/next verified')
} else {
  console.error('  ✗ _modules/next is MISSING — build will fail!')
  process.exit(1)
}

console.log('Done.')
