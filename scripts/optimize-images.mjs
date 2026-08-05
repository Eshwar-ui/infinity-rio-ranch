/**
 * One-shot image optimiser for public/assets.
 *
 * The venue photos shipped straight from a camera/CDN export — ~30 MB across 59
 * files, with single hero images over 2.8 MB. That is the site's dominant Core
 * Web Vitals cost. This re-encodes them **in place**, keeping every filename and
 * URL identical, so nothing in the code or in the Supabase `gallery` / `events`
 * tables needs to change.
 *
 *   npm run optimize:images            # re-encode anything not already done
 *   npm run optimize:images -- --dry   # report what would change, touch nothing
 *   npm run optimize:images -- --force # ignore the manifest and redo everything
 *
 * Idempotent by manifest: `scripts/image-manifest.json` records the hash of each
 * file after optimisation, so re-running skips work instead of stacking lossy
 * generations on the same photo. Drop in a new photo and it gets picked up; edit
 * an existing one and it gets redone. The manifest is committed.
 *
 * Originals are recoverable with `git checkout -- public/assets`.
 *
 * Deliberately NOT part of `npm run build` — a lossy encoder in the build path
 * would degrade the same photo a little more on every deploy.
 */

import { createHash } from 'node:crypto'
import { access, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const TARGET_DIR = path.join(ROOT, 'public', 'assets')

/**
 * Generated derivatives live here, mirroring the source tree. They are kept in a
 * dedicated directory rather than as `name-480.jpg` siblings because a suffix is
 * ambiguous: `venue-01.jpg` is a *source* that looks exactly like a derivative,
 * so a suffix-based filter would either skip real images or re-process generated
 * ones into `wed-960-480.jpg`. A directory can't be misread.
 */
const DERIVED_DIRNAME = '_r'
const DERIVED_DIR = path.join(TARGET_DIR, DERIVED_DIRNAME)
const MANIFEST = path.join(ROOT, 'scripts', 'image-manifest.json')
/** Consumed by <SmartImage>; maps a public path to the WebP widths that exist. */
const APP_MANIFEST = path.join(ROOT, 'src', 'lib', 'image-sources.json')

/**
 * Responsive derivatives written alongside each original. The original file
 * never moves, so every hardcoded path and every Supabase `gallery` / `events`
 * row keeps resolving; derivatives are opt-in via <SmartImage>.
 *
 * Format per source, decided by measurement rather than by reputation:
 *
 *  - **PNG → WebP.** Decisive: arch.png 347 → 82 kB (−77%), the event cards
 *    −78%. These are photographs that were saved as PNG.
 *  - **JPEG → JPEG.** WebP does *not* beat mozjpeg on this photo set. Measured
 *    on three frames, WebP was 4–8% *larger* at matched quality, and only
 *    6–12% smaller at q58 — which is visibly worse than the q78 JPEG. So JPEG
 *    sources only get smaller widths, for srcset. Re-test if the photos are
 *    ever replaced with a less grainy set.
 */
const DERIVATIVE_WIDTHS = [240, 480, 720, 960]
const WEBP_MAX_WIDTH = 1600
const WEBP = { quality: 74, effort: 5 }

const DRY_RUN = process.argv.includes('--dry')
const FORCE = process.argv.includes('--force')

/**
 * Long-edge cap. Nothing on the site renders wider than this: the lightbox is
 * capped at 1000 px, the gallery grid at ~440 px per tile, and the full-bleed
 * hero/CTA backgrounds sit under 0.6–0.9 opacity gradient washes that hide any
 * upscaling. 1600 keeps 2x sharpness everywhere it's actually visible.
 */
const MAX_EDGE = 1600

/** Below this a re-encode costs more quality than it saves bytes. */
const SKIP_UNDER_BYTES = 90 * 1024

/**
 * q78 with default 4:2:0 chroma. 4:4:4 is for text and screenshots — on
 * photographs it inflates files ~50% for no visible gain (measured: 1072 kB vs
 * 708 kB on the same frame). Below ~q72 these photos start showing artifacts in
 * skin tones and sky gradients, which is not a trade a wedding venue should make.
 */
const JPEG = { quality: 78, mozjpeg: true }

/** Photographic PNGs (event cards, the arch hero) — palette quantisation is the
 *  only lossy lever PNG has, and it's worth 70–80% here. They keep their alpha
 *  channel and their .png URL, which CMS rows may already point at. */
const PNG = { quality: 80, effort: 9, palette: true, compressionLevel: 9 }

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} kB`
const sha = (buffer) => createHash('sha256').update(buffer).digest('hex').slice(0, 16)

const walk = async (dir) => {
  const found = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === DERIVED_DIRNAME) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...(await walk(full)))
    else if (/\.(jpe?g|png)$/i.test(entry.name)) found.push(full)
  }
  return found
}

/**
 * Bump whenever the encoding strategy changes (widths, quality, output format,
 * directory layout). The manifest is keyed on source hashes, so without this a
 * strategy change looks like "nothing changed" and every file is skipped —
 * silently leaving the old derivatives in place.
 */
const STRATEGY_VERSION = 3

const readManifest = async () => {
  try {
    const raw = JSON.parse(await readFile(MANIFEST, 'utf8'))
    if (raw.__version !== STRATEGY_VERSION) {
      console.log('[images] strategy changed — regenerating all derivatives.\n')
      return {}
    }
    return raw.files ?? {}
  } catch {
    return {}
  }
}

/** Forward slashes so the manifest is identical on Windows and CI. */
const keyFor = (file) => path.relative(TARGET_DIR, file).split(path.sep).join('/')

const exists = (file) =>
  access(file).then(
    () => true,
    () => false,
  )

/**
 * Writes the responsive ladder for one image and returns a manifest entry.
 *
 * `buffer` must be the **pristine** input, not the re-encoded JPEG: encoding a
 * derivative from an already-compressed JPEG makes it spend bits reproducing
 * that codec's artifacts.
 */
const writeDerivatives = async (file, buffer, sourceWidth, sourceHeight, sourceBytes) => {
  const rel = keyFor(file)
  const stem = rel.replace(/\.[^.]+$/, '')
  const outDir = path.join(DERIVED_DIR, path.dirname(rel))
  const isPng = /\.png$/i.test(file)
  const smaller = DERIVATIVE_WIDTHS.filter((w) => w < sourceWidth)

  if (!DRY_RUN) await mkdir(outDir, { recursive: true })

  /**
   * A derivative only earns its place if it's smaller than the file it would
   * replace. Without this, palette-quantised PNGs with alpha (the logos) get a
   * *bigger* lossy-WebP sibling — measured: logo-cutout.png 43 kB → 76 kB.
   */
  const emit = async (width, ext, encode) => {
    const data = await encode(sharp(buffer).resize({ width, withoutEnlargement: true })).toBuffer()
    if (data.length >= sourceBytes) return null
    if (!DRY_RUN) {
      await writeFile(path.join(DERIVED_DIR, `${stem}-${width}.${ext}`), data)
    }
    return width
  }

  const base = `/assets/${DERIVED_DIRNAME}/${stem}`

  if (isPng) {
    const candidates = [...smaller, Math.min(sourceWidth, WEBP_MAX_WIDTH)]
    const widths = (
      await Promise.all(candidates.map((w) => emit(w, 'webp', (p) => p.webp(WEBP))))
    ).filter((w) => w !== null)

    // WebP only replaces the PNG if its ladder reaches full width.
    if (widths.length > 0 && widths.includes(candidates.at(-1))) {
      return { base, webp: widths, w: sourceWidth, h: sourceHeight, full: true }
    }

    // It didn't win — the palette-quantised logos with alpha land here. They
    // still benefit from smaller widths in their own format: the nav renders an
    // 834px logo in a 62px slot.
    const pngWidths = (
      await Promise.all(smaller.map((w) => emit(w, 'png', (p) => p.png(PNG))))
    ).filter((w) => w !== null)
    return pngWidths.length > 0 ? { base, png: pngWidths, w: sourceWidth, h: sourceHeight } : null
  }

  // JPEG: only smaller widths — WebP loses to mozjpeg on this photo set, and the
  // original file is already the full-width entry.
  const widths = (
    await Promise.all(smaller.map((w) => emit(w, 'jpg', (p) => p.jpeg(JPEG))))
  ).filter((w) => w !== null)
  return widths.length > 0 ? { base, jpg: widths, w: sourceWidth, h: sourceHeight } : null
}

const optimize = async (file, manifest) => {
  const original = await readFile(file)
  const key = keyFor(file)
  const before = original.length
  const prior = manifest[key]
  const priorHash = typeof prior === 'string' ? prior : prior?.hash

  // Unchanged since the last run *and* its derivatives are still on disk.
  if (!FORCE && priorHash === sha(original) && prior?.sources !== undefined) {
    const entry = prior.sources
    const stem = key.replace(/\.[^.]+$/, '')
    const expected = entry?.webp
      ? entry.webp.map((w) => `${stem}-${w}.webp`)
      : entry?.png
        ? entry.png.map((w) => `${stem}-${w}.png`)
        : (entry?.jpg ?? []).map((w) => `${stem}-${w}.jpg`)
    const intact = await Promise.all(expected.map((f) => exists(path.join(DERIVED_DIR, f))))
    if (intact.every(Boolean)) {
      /*
       * Backfill the intrinsic height for entries written before it was
       * recorded. <SmartImage> emits width/height from these two numbers so the
       * browser can reserve the box before the bytes arrive — without them
       * every photo on the site is a layout shift waiting to happen.
       *
       * Done here rather than behind a STRATEGY_VERSION bump on purpose: adding
       * a number to the manifest must not re-encode 59 already-lossy photos a
       * second generation just to learn something sharp can read for free.
       */
      if (entry && entry.w && entry.h === undefined) {
        entry.h = (await sharp(original).metadata()).height ?? undefined
      }
      return {
        key,
        skipped: 'already optimized',
        before,
        after: before,
        hash: priorHash,
        sources: entry,
      }
    }
  }

  const meta = await sharp(original).metadata()
  const oversized = Math.max(meta.width ?? 0, meta.height ?? 0) > MAX_EDGE
  const reencode = before >= SKIP_UNDER_BYTES || oversized

  let output = original
  let dims = null

  if (reencode) {
    let pipeline = sharp(original, { animated: false }).rotate()
    if (oversized) {
      pipeline = pipeline.resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
    }

    const isPng = /\.png$/i.test(file)
    const candidate = await (isPng ? pipeline.png(PNG) : pipeline.jpeg(JPEG)).toBuffer()

    // Never write a file bigger than the one we started with.
    if (candidate.length < before) {
      output = candidate
      if (!DRY_RUN) await writeFile(file, candidate)
      const after = await sharp(candidate).metadata()
      dims = `${meta.width}x${meta.height} → ${after.width}x${after.height}`
    }
  }

  // Derivatives come from `original` (pristine), capped to the same long edge as
  // the re-encoded file so both ladders line up.
  const capped = oversized
    ? await sharp(original)
        .rotate()
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
        .toBuffer()
    : original
  const cappedMeta = await sharp(capped).metadata()
  const sourceWidth = cappedMeta.width ?? 0
  const sourceHeight = cappedMeta.height ?? 0
  const sources = await writeDerivatives(file, capped, sourceWidth, sourceHeight, output.length)

  return {
    key,
    before,
    after: output.length,
    hash: sha(output),
    sources,
    dims,
    skipped: output === original && !dims ? 'original kept' : undefined,
  }
}

const main = async () => {
  await stat(TARGET_DIR)
  const files = (await walk(TARGET_DIR)).sort()
  if (files.length === 0) throw new Error(`No images found under ${TARGET_DIR}`)

  const manifest = await readManifest()
  const next = {}

  console.log(
    `[images] ${files.length} files in public/assets` +
      `${DRY_RUN ? ' — DRY RUN, nothing written' : ''}${FORCE ? ' — FORCED' : ''}\n`,
  )

  let before = 0
  let after = 0
  let changed = 0
  const skipReasons = {}

  const appManifest = {}

  for (const file of files) {
    const result = await optimize(file, manifest)
    before += result.before
    after += result.after
    if (result.hash) next[result.key] = { hash: result.hash, sources: result.sources ?? null }
    if (result.sources) appManifest[`/assets/${result.key}`] = result.sources

    if (result.skipped) {
      skipReasons[result.skipped] = (skipReasons[result.skipped] ?? 0) + 1
      continue
    }

    changed += 1
    const saved = ((1 - result.after / result.before) * 100).toFixed(0)
    console.log(
      `  ${result.key.padEnd(28)} ${kb(result.before).padStart(9)} → ` +
        `${kb(result.after).padStart(8)}  −${saved}%  ${result.dims ?? ''}`,
    )
  }

  if (!DRY_RUN) {
    await writeFile(
      MANIFEST,
      `${JSON.stringify({ __version: STRATEGY_VERSION, files: next }, null, 2)}\n`,
      'utf8',
    )
    await writeFile(APP_MANIFEST, `${JSON.stringify(appManifest, null, 2)}\n`, 'utf8')
  }

  const summary = Object.entries(skipReasons)
    .map(([reason, count]) => `${count} ${reason}`)
    .join(', ')

  console.log(
    `\n[images] ${changed} re-encoded${summary ? `, skipped: ${summary}` : ''}` +
      `\n[images] total ${kb(before)} → ${kb(after)} (−${((1 - after / before) * 100).toFixed(1)}%)`,
  )
  if (DRY_RUN) console.log('[images] dry run — re-run without --dry to apply.')
}

main().catch((error) => {
  console.error('[images] FAILED')
  console.error(error)
  process.exit(1)
})
