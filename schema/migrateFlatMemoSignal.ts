/**
 * Explodes the nested memo/signal items arrays into the new flat
 * memo_digests+memos / signal_digests+signals collections -- not part of
 * the Directus runtime. Requires applyFlatMemoSignal.ts to have run first.
 *
 * For each old memo/signal record: creates one digest row (slug, date,
 * summary, seo carried over as-is), then one item row per array entry
 * (slug generated as "<date>-<slugified-title>", image URL resolved to a
 * directus_files UUID the same way backfillMediaFields.ts did, sort =
 * original array index, featured = true for the first item of the day).
 *
 * Idempotent: skips a source day if a digest with its slug already exists.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/migrateFlatMemoSignal.ts
 */
import { createItem, readFiles, readItems } from '@directus/sdk'

import { getClient, login } from './lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

const CDN_ORIGIN = 'https://cdn.lememo.news'

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function urlToR2Key(url: unknown): string | undefined {
  if (typeof url !== 'string' || !url.startsWith(`${CDN_ORIGIN}/`)) return undefined
  return url.slice(CDN_ORIGIN.length + 1)
}

interface Migration {
  sourceCollection: string
  digestCollection: string
  itemsCollection: string
  digestField: string // e.g. 'memo_digest'
}

const MIGRATIONS: Migration[] = [
  { sourceCollection: 'memo', digestCollection: 'memo_digests', itemsCollection: 'memos', digestField: 'memo_digest' },
  { sourceCollection: 'signal', digestCollection: 'signal_digests', itemsCollection: 'signals', digestField: 'signal_digest' },
]

async function main() {
  const client = getClient()
  await login(client)
  console.log('Logged in.\n')

  // Index all registered files once, case-insensitively, same as backfillMediaFields.ts.
  const allFiles = await client.request(readFiles({ limit: -1, fields: ['id', 'filename_disk'] }))
  const byLowerKey = new Map<string, string>()
  for (const f of allFiles as { id: string; filename_disk: string | null }[]) {
    if (f.filename_disk) byLowerKey.set(f.filename_disk.toLowerCase(), f.id)
  }

  for (const m of MIGRATIONS) {
    console.log(`=== ${m.sourceCollection} -> ${m.digestCollection} + ${m.itemsCollection} ===`)
    const days = await client.request(readItems(m.sourceCollection, { limit: -1 }) as AnyClient)

    let digestsCreated = 0
    let itemsCreated = 0
    let itemsUnresolvedImage = 0
    const usedSlugsToday = new Map<string, Set<string>>()

    for (const day of days as AnyClient[]) {
      const existing = await client.request(
        readItems(m.digestCollection, { filter: { slug: { _eq: day.slug } }, limit: 1, fields: ['id'] }) as AnyClient,
      )
      if (existing.length > 0) {
        console.log(`  skip day (digest already exists): ${day.slug}`)
        continue
      }

      const digest = await client.request(
        createItem(m.digestCollection, {
          slug: day.slug,
          date: day.date,
          summary: day.summary,
          seo: day.seo ?? undefined,
        }) as AnyClient,
      )
      digestsCreated++

      const items: AnyClient[] = Array.isArray(day.items) ? day.items : []
      const daySlugs = usedSlugsToday.get(day.date) ?? new Set<string>()

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        let slug = `${day.date}-${slugify(item.title ?? `item-${i}`)}`
        if (daySlugs.has(slug)) slug = `${slug}-${i}`
        daySlugs.add(slug)

        let thumbnailFile: string | undefined
        const key = urlToR2Key(item.image)
        if (key) {
          thumbnailFile = byLowerKey.get(key.toLowerCase())
          if (!thumbnailFile) itemsUnresolvedImage++
        }

        const payload = {
          slug,
          date: day.date,
          [m.digestField]: digest.id,
          region: item.region,
          category: item.category,
          subcategory: item.subcategory,
          title: item.title,
          what: item.what,
          teaser: item.teaser,
          why: item.why,
          sources: Array.isArray(item.sources) ? item.sources : [],
          signal: item.signal,
          thumbnail_file: thumbnailFile,
          image_alt: item.image_alt,
          image_credit: item.image_credit,
          featured: i === 0,
          status: day.status ?? 'published',
          sort: i,
        }
        try {
          await client.request(createItem(m.itemsCollection, payload) as AnyClient)
        } catch (err) {
          console.error(`FAILED item on day ${day.slug} (index ${i}):`, JSON.stringify(payload, null, 2))
          throw err
        }
        itemsCreated++
      }

      usedSlugsToday.set(day.date, daySlugs)
    }

    console.log(`  digests created: ${digestsCreated}, items created: ${itemsCreated}, items with unresolved image: ${itemsUnresolvedImage}\n`)
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
