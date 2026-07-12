/**
 * Adds native file-picker fields for top-level "cover image" fields --
 * not part of the Directus runtime.
 *
 * Directus doesn't support renaming fields via the API, so the existing
 * plain-text CDN URL fields (image, thumbnail, author_thumbnail,
 * seo_og_image) are kept as-is but hidden from the edit form once the new
 * <field>_file picker field is backfilled (see backfillMediaFields.ts).
 * Nested repeater images (memo/signal item images, chronologie event images,
 * visuels item images) are deliberately out of scope for this pass.
 *
 * Idempotent: skips fields/relations that already exist, so it's safe to
 * re-run.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/mediaFields.ts
 */
import { createField, createRelation, readFieldsByCollection, updateField } from '@directus/sdk'

import { fileField, getClient, login } from './lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

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

async function existingFieldNames(client: AnyClient, collection: string): Promise<Set<string>> {
  try {
    const fields = await client.request(readFieldsByCollection(collection))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Set(fields.map((f: any) => f.field))
  } catch {
    return new Set()
  }
}

async function main() {
  const client = getClient()
  await login(client)
  console.log('Logged in.\n')

  for (const [collection, legacyField, newField] of TARGETS) {
    console.log(`=== ${collection}.${newField} ===`)
    const existing = await existingFieldNames(client, collection)

    if (!existing.has(newField)) {
      await client.request(createField(collection, fileField(newField, `Replaces legacy text field "${legacyField}"`)))
      console.log(`  created field: ${newField}`)
      try {
        await client.request(createRelation({ collection, field: newField, related_collection: 'directus_files' }))
        console.log(`  created relation: ${collection}.${newField} -> directus_files`)
      } catch (err) {
        console.error(`  FAILED relation ${collection}.${newField}:`, err instanceof Error ? err.message : err)
      }
    } else {
      console.log(`  field exists, skipping: ${newField}`)
    }

    if (existing.has(legacyField)) {
      try {
        await client.request(updateField(collection, legacyField, { meta: { hidden: true, note: `Legacy value, superseded by "${newField}"` } }))
        console.log(`  hid legacy field: ${legacyField}`)
      } catch (err) {
        console.error(`  FAILED to hide ${legacyField}:`, err instanceof Error ? err.message : err)
      }
    }
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
