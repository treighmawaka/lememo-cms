/**
 * One-time backfill -- not part of the Directus runtime.
 *
 * For every already-migrated record, resolves its legacy plain-text CDN URL
 * field(s) to the matching directus_files record (registered by
 * scripts/media-sync.ts) and sets the new <field>_file picker field.
 * Requires scripts/media-sync.ts --live to have run first.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/backfillMediaFields.ts
 */
import { readFiles, readItems, updateItem } from '@directus/sdk'

import { getClient, login } from './lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

const CDN_ORIGIN = 'https://cdn.lememo.news'

// [collection, legacy text field, new file field]
const TARGETS: [string, string, string][] = [
  ['video', 'thumbnail', 'thumbnail_file'],
  ['visuels', 'image', 'image_file'],
  ['signal', 'image', 'image_file'],
  ['focus', 'image', 'image_file'],
  ['focus', 'author_thumbnail', 'author_thumbnail_file'],
  ['chronologie', 'image', 'image_file'],
  ['video', 'seo_og_image', 'seo_og_image_file'],
  ['visuels', 'seo_og_image', 'seo_og_image_file'],
  ['memo', 'seo_og_image', 'seo_og_image_file'],
  ['signal', 'seo_og_image', 'seo_og_image_file'],
  ['focus', 'seo_og_image', 'seo_og_image_file'],
  ['pages', 'seo_og_image', 'seo_og_image_file'],
  ['chronologie', 'seo_og_image', 'seo_og_image_file'],
]

function urlToR2Key(url: string): string | undefined {
  if (!url.startsWith(`${CDN_ORIGIN}/`)) return undefined
  return url.slice(CDN_ORIGIN.length + 1)
}

async function main() {
  const client = getClient()
  await login(client)
  console.log('Logged in.\n')

  // Fetch all 581 registered files once and index by lowercased key. Some
  // frontmatter references CDN paths with different casing than the actual
  // R2 object (e.g. "Femme-concentree....jpg" vs the real
  // "femme-concentree....jpg") -- S3-style storage is case-sensitive, so an
  // exact match would silently miss these. Resolving case-insensitively
  // against the real bucket contents is the correct fix; it also means these
  // ~18 images were likely already broken on the live site before this
  // migration, independent of anything done here.
  const allFiles = await client.request(readFiles({ limit: -1, fields: ['id', 'filename_disk'] }))
  const byLowerKey = new Map<string, string>()
  for (const f of allFiles as { id: string; filename_disk: string | null }[]) {
    if (f.filename_disk) byLowerKey.set(f.filename_disk.toLowerCase(), f.id)
  }

  let updated = 0
  let skipped = 0
  let unresolved = 0
  let caseMismatches = 0

  for (const [collection, legacyField, newField] of TARGETS) {
    const items = await client.request(
      readItems(collection, { fields: ['id', legacyField, newField], limit: -1 }) as AnyClient,
    )

    for (const item of items as AnyClient[]) {
      const url = item[legacyField] as string | null
      if (!url) continue
      if (item[newField]) {
        skipped++
        continue
      }

      const key = urlToR2Key(url)
      if (!key) {
        console.log(`  [${collection}.${item.id}] unresolved: "${url}" is not a cdn.lememo.news URL`)
        unresolved++
        continue
      }

      const fileId = byLowerKey.get(key.toLowerCase())
      if (!fileId) {
        console.log(`  [${collection}.${item.id}] unresolved: no directus_files record for key "${key}" (checked case-insensitively too)`)
        unresolved++
        continue
      }
      if (!byLowerKey.has(key)) {
        console.log(`  [${collection}.${item.id}] case mismatch resolved: "${key}"`)
        caseMismatches++
      }

      await client.request(updateItem(collection, item.id, { [newField]: fileId }))
      updated++
    }
    console.log(`${collection}.${newField}: processed`)
  }

  console.log(`\nDone. updated=${updated} skipped(already set)=${skipped} unresolved=${unresolved} caseMismatches=${caseMismatches}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
