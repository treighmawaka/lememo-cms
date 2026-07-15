/**
 * Fills the (currently empty) `seo` field on memo_digests/signal_digests --
 * not part of the Directus runtime. Unlike backfillSeoPlugin.ts, there is no
 * legacy seo_title/seo_description to carry over: the flatten migration
 * (see schema/migrateFlatMemoSignal.ts) created these two collections fresh,
 * and the source markdown never had a digest-level `seo` block to begin
 * with, so nothing was actually lost -- it just was never authored.
 *
 * Both title and description are derived from the digest's own `summary`
 * field (already populated on every row), each truncated at a word boundary
 * to the search-engine-safe length shown in the seo-plugin's own UI
 * guidance: ~60 chars for the title, ~155 for the meta description.
 *
 * Idempotent: skips items that already have a non-empty seo.title or
 * seo.meta_description, so it's safe to re-run.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/backfillMemoSignalSeo.ts [--dry-run]
 */
import { readItems, updateItem } from '@directus/sdk'

import { getClient, login } from './lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

const COLLECTIONS = ['memo_digests', 'signal_digests']

const TITLE_MAX = 60
const DESCRIPTION_MAX = 155

function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const cut = text.slice(0, maxLen - 1)
  const lastSpace = cut.lastIndexOf(' ')
  const trimmed = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()
  return `${trimmed}…`
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const client = getClient()
  await login(client)
  console.log(`Logged in.${dryRun ? ' (dry run -- no writes)' : ''}\n`)

  let updated = 0
  let skipped = 0

  for (const collection of COLLECTIONS) {
    const items = await client.request(
      readItems(collection, { fields: ['id', 'slug', 'summary', 'seo'], limit: -1 }) as AnyClient,
    )

    for (const item of items as AnyClient[]) {
      if (item.seo?.title || item.seo?.meta_description) {
        skipped++
        continue
      }
      if (!item.summary) {
        console.log(`  ${collection}/${item.slug}: no summary, skipping`)
        continue
      }

      const title = truncateAtWord(item.summary, TITLE_MAX)
      const meta_description = truncateAtWord(item.summary, DESCRIPTION_MAX)
      const seo = {
        title,
        meta_description,
        focus_keyphrase: '',
        og_image: '',
        no_index: false,
        no_follow: false,
        additional_fields: {},
        sitemap: { priority: '0.5', change_frequency: 'weekly' },
      }

      console.log(`  ${collection}/${item.slug}:`)
      console.log(`    title (${title.length}): ${title}`)
      console.log(`    description (${meta_description.length}): ${meta_description}`)

      if (!dryRun) await client.request(updateItem(collection, item.id, { seo }) as AnyClient)
      updated++
    }
    console.log(`${collection}: processed`)
  }

  console.log(`\nDone. updated=${updated} skipped(already set)=${skipped}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
