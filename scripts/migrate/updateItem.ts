/**
 * Re-syncs a single already-migrated markdown file onto its existing Directus
 * item -- not part of the Directus runtime. Complements run.ts, which only
 * ever creates (skips existing slugs, so it never clobbers edits made
 * directly in Directus); this script is for the opposite, explicit case: the
 * source markdown changed and that change should overwrite Directus.
 *
 * Only writes fields that are (a) actually part of the item's current live
 * schema and (b) different from the current value -- collections evolve past
 * their original mappers.ts shape (e.g. focus's flat seo_title/seo_description
 * were later replaced by a consolidated `seo` json field, see seoPlugin.ts),
 * so a mapped field with no live counterpart is silently skipped rather than
 * sent to the API.
 *
 * Also re-resolves any legacy image URL fields that changed to their
 * `<field>_file` directus_files counterpart (same case-insensitive R2 key
 * match as backfillMediaFields.ts), so the two never drift out of sync.
 *
 * Prints a diff before writing, so it's obvious what will be changed.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx scripts/migrate/updateItem.ts --collection=focus --slug=some-slug
 */
import path from 'node:path'

import { readFiles, readItems, updateItem } from '@directus/sdk'

import { getClient, login } from '../../schema/lib'
import { listMarkdownFiles, readMarkdownFile } from './lib'
import { mapChronologie, mapFocus, mapMemo, mapPages, mapSignal, mapVideo, mapVisuels } from './mappers'

const DEFAULT_CONTENT_DIR = '/Users/treighmawaka/Desktop/packages/lememo/content'
const CDN_ORIGIN = 'https://cdn.lememo.news'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

const MAPPERS: Record<string, typeof mapFocus> = {
  video: mapVideo,
  visuels: mapVisuels,
  memo: mapMemo,
  signal: mapSignal,
  focus: mapFocus,
  pages: mapPages,
  chronologie: mapChronologie,
}

// [legacy CDN-URL field, its directus_files counterpart] -- same pairs as backfillMediaFields.ts.
const FILE_FIELD_PAIRS: [string, string][] = [
  ['thumbnail', 'thumbnail_file'],
  ['image', 'image_file'],
  ['author_thumbnail', 'author_thumbnail_file'],
]

function arg(name: string): string | undefined {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`))
  return found ? found.slice(name.length + 3) : undefined
}

function urlToR2Key(url: unknown): string | undefined {
  if (typeof url !== 'string' || !url.startsWith(`${CDN_ORIGIN}/`)) return undefined
  return url.slice(CDN_ORIGIN.length + 1)
}

async function main() {
  const collection = arg('collection')
  const slug = arg('slug')
  if (!collection || !slug) throw new Error('Usage: --collection=<name> --slug=<slug>')
  const mapper = MAPPERS[collection]
  if (!mapper) throw new Error(`No mapper registered for collection "${collection}"`)

  const client = getClient()
  await login(client)
  console.log('Logged in.\n')

  const dir = path.join(DEFAULT_CONTENT_DIR, collection)
  const filePath = listMarkdownFiles(dir).find((f) => path.basename(f, path.extname(f)) === slug)
  if (!filePath) throw new Error(`No markdown file found for ${collection}/${slug}`)

  const parsed = readMarkdownFile(filePath)
  const warnings: string[] = []
  const mapped = await mapper({ client, warnings }, parsed)
  for (const w of warnings) console.log(`warning: ${w}`)

  const existing = await client.request(readItems(collection, { filter: { slug: { _eq: slug } }, limit: 1 }) as AnyClient)
  const doc = existing[0]
  if (!doc) throw new Error(`No existing ${collection} item with slug "${slug}" -- this script only updates, use run.ts to create`)

  console.log(`\n=== ${collection}/${slug} (id ${doc.id}) -- fields that will change ===`)
  const changedFields: Record<string, unknown> = {}
  for (const [key, newValue] of Object.entries(mapped)) {
    if (!Object.prototype.hasOwnProperty.call(doc, key)) {
      console.log(`  (skipping "${key}" -- mapper produced it, but it's not a field on the live ${collection} schema)`)
      continue
    }
    const oldValue = (doc as AnyClient)[key]
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changedFields[key] = newValue
      console.log(`  ${key}:`)
      console.log(`    - ${JSON.stringify(oldValue)}`)
      console.log(`    + ${JSON.stringify(newValue)}`)
    }
  }

  // Re-resolve <field>_file counterparts for any legacy URL field that changed.
  const pairsNeedingResolve = FILE_FIELD_PAIRS.filter(
    ([legacy, fileField]) => legacy in changedFields && Object.prototype.hasOwnProperty.call(doc, fileField),
  )
  if (pairsNeedingResolve.length > 0) {
    const allFiles = await client.request(readFiles({ limit: -1, fields: ['id', 'filename_disk'] }) as AnyClient)
    const byLowerKey = new Map<string, string>()
    for (const f of allFiles as { id: string; filename_disk: string | null }[]) {
      if (f.filename_disk) byLowerKey.set(f.filename_disk.toLowerCase(), f.id)
    }
    for (const [legacy, fileField] of pairsNeedingResolve) {
      const key = urlToR2Key(changedFields[legacy])
      const fileId = key ? byLowerKey.get(key.toLowerCase()) : undefined
      if (fileId) {
        changedFields[fileField] = fileId
        console.log(`  ${fileField}:`)
        console.log(`    - ${JSON.stringify((doc as AnyClient)[fileField])}`)
        console.log(`    + ${JSON.stringify(fileId)}  (resolved from ${legacy})`)
      } else {
        console.log(`  warning: could not resolve ${fileField} for new ${legacy} "${changedFields[legacy]}" -- left as-is, fix via media picker`)
      }
    }
  }

  if (Object.keys(changedFields).length === 0) {
    console.log('  (no changes)')
    return
  }

  await client.request(updateItem(collection, doc.id, changedFields) as AnyClient)
  console.log(`\nUpdated ${Object.keys(changedFields).length} field(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
