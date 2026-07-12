/**
 * Backfills width/height on directus_files records that don't have them --
 * not part of the Directus runtime.
 *
 * Directus's Assets API refuses to generate any resized transform (the
 * inline thumbnails used throughout the Admin UI's file-picker fields) for
 * a file with unknown dimensions, regardless of the actual image size --
 * confirmed by reading the check directly in the installed @directus/api
 * source (services/assets.js): `if (!width || !height || ...) throw new
 * IllegalAssetTransformationError(...)`. media-sync.ts (this project and
 * the original Payload version it was based on) deliberately left these
 * null for the 581 pre-existing R2 objects to avoid downloading every file
 * during that sync. This fills them in now.
 *
 * Reads each file's header bytes only (via image-size, not a full sharp
 * decode) to keep bandwidth down across ~580 files.
 *
 * Idempotent: skips files that already have width/height set.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/backfillImageDimensions.ts
 */
import { imageSize } from 'image-size'

import { readFiles, updateFile } from '@directus/sdk'

import { getClient, login } from './lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

async function main() {
  const client = getClient()
  await login(client)
  console.log('Logged in.\n')

  const publicUrl = (process.env.STORAGE_R2_PUBLIC_URL || 'https://cdn.lememo.news').replace(/\/$/, '')

  const files = await client.request(
    readFiles({
      filter: { type: { _starts_with: 'image/' } },
      fields: ['id', 'filename_disk', 'type', 'width', 'height'],
      limit: -1,
    }),
  )

  let updated = 0
  let skipped = 0
  const failed: { key: string; reason: string }[] = []

  for (const file of files as AnyClient[]) {
    if (file.width && file.height) {
      skipped++
      continue
    }
    if (file.type === 'image/svg+xml') {
      skipped++
      continue
    }

    const url = `${publicUrl}/${file.filename_disk}`
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
      const buffer = Buffer.from(await res.arrayBuffer())
      const dimensions = imageSize(buffer)
      if (!dimensions.width || !dimensions.height) throw new Error('could not determine dimensions')

      await client.request(updateFile(file.id, { width: dimensions.width, height: dimensions.height }))
      updated++
    } catch (err) {
      failed.push({ key: file.filename_disk, reason: err instanceof Error ? err.message : String(err) })
    }
  }

  console.log(`Done. updated=${updated} skipped(already set/svg)=${skipped} failed=${failed.length}`)
  for (const f of failed) console.log(`  - ${f.key}: ${f.reason}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
