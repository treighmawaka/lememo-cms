/**
 * One-time backfill -- not part of the Directus runtime.
 *
 * run.ts migrates visuels before focus (focus.visuel references visuels), but
 * the reverse link (visuels.related_link -> focus) can't be set at visuels'
 * creation time since focus doesn't exist yet. This resolves and fills in
 * that link for any already-migrated visuels item where it's still empty.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx scripts/migrate/backfillVisuelsRelations.ts
 */
import path from 'node:path'

import { readItems, updateItem } from '@directus/sdk'

import { getClient, login } from '../../schema/lib'
import { listMarkdownFiles, readMarkdownFile, resolveRelation, slugFromContentPath } from './lib'

const DEFAULT_CONTENT_DIR = '/Users/treighmawaka/Desktop/packages/lememo/content'

async function main() {
  const client = getClient()
  await login(client)

  const dir = path.join(DEFAULT_CONTENT_DIR, 'visuels')
  const files = listMarkdownFiles(dir)

  let updated = 0
  let stillUnresolved = 0

  for (const filePath of files) {
    const { slug, data } = readMarkdownFile(filePath)
    const relatedSlug = slugFromContentPath(data.relatedLink as string | undefined)
    if (!relatedSlug) continue

    const warnings: string[] = []
    const relatedLink = await resolveRelation(client, 'focus', relatedSlug, warnings)
    if (!relatedLink) {
      console.log(`  still unresolved: ${slug} -> ${relatedSlug} (${warnings.join('; ')})`)
      stillUnresolved += 1
      continue
    }

    const existing = await client.request(readItems('visuels', { filter: { slug: { _eq: slug } }, limit: 1, fields: ['id', 'related_link'] }))
    const doc = existing[0]
    if (!doc) {
      console.log(`  skip: ${slug} not found in Directus`)
      continue
    }
    if (doc.related_link) {
      console.log(`  already set: ${slug}`)
      continue
    }

    await client.request(updateItem('visuels', doc.id, { related_link: relatedLink }))
    console.log(`  updated: ${slug} -> focus/${relatedSlug}`)
    updated += 1
  }

  console.log(`\nDone. updated=${updated} stillUnresolved=${stillUnresolved}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
