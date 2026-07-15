/**
 * Fixes memos.slug / signals.slug -- not part of the Directus runtime.
 * These were created with template `{{date}}-{{title}}` (see
 * schema/collections/memos.ts / signals.ts), which is wrong: the date is
 * already part of the route (`/memo/<date>/<slug>`), so baking it into the
 * slug too is redundant and produces slugs like
 * "2026-07-15-nigeria-un-drone-...".
 *
 * Two parts:
 * 1. Updates the live field's `options.template` to `{{title}}` so newly
 *    created rows stop getting the date prefix (schema-as-code's
 *    applyFlatMemoSignal.ts only creates fields that don't exist yet, so
 *    editing collections/memos.ts alone doesn't touch the live field).
 * 2. Backfills existing rows: strips the known `${date}-` prefix from each
 *    row's current slug (string manipulation on already-correctly-slugified
 *    data, not a re-run of the slugify algorithm, so it can't drift from
 *    what the wpslug extension would have produced).
 *
 * Rows in SKIP_SLUGS are left untouched -- their stripped slug collides with
 * another row's (two memo titles happen to repeat on different dates); the
 * uniqueness conflict needs a manual title/slug edit, not an automatic
 * suffix. As of this run: 4 memos rows (2 colliding pairs), 0 signals rows.
 *
 * Idempotent: skips rows whose slug no longer starts with `${date}-`.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/fixItemSlugs.ts [--dry-run]
 */
import { readField, readItems, updateField, updateItem } from '@directus/sdk'

import { getClient, login } from './lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

const COLLECTIONS = ['memos', 'signals']

// memos rows whose stripped slug collides with another row -- left with
// their date-prefixed slug until manually resolved.
const SKIP_SLUGS = new Set([
  '2026-04-22-anthropic-publie-claude-opus-4-7',
  '2026-04-29-anthropic-publie-claude-opus-4-7',
  '2026-06-22-mozambique-l-industrie-miniere-s-inquiete-des-nouvelles-regles-de-participation-',
  '2026-06-23-mozambique-l-industrie-miniere-s-inquiete-des-nouvelles-regles-de-participation-',
])

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const client = getClient()
  await login(client)
  console.log(`Logged in.${dryRun ? ' (dry run -- no writes)' : ''}\n`)

  for (const collection of COLLECTIONS) {
    console.log(`=== ${collection}: field template ===`)
    const field = await client.request(readField(collection, 'slug') as AnyClient)
    console.log(`  current template: ${JSON.stringify(field.meta.options.template)}`)
    if (!dryRun) {
      await client.request(
        updateField(collection, 'slug', { meta: { ...field.meta, options: { ...field.meta.options, template: '{{title}}' } } }) as AnyClient,
      )
    }
    console.log(`  slug template -> {{title}}${dryRun ? ' (dry run)' : ''}`)

    console.log(`\n=== ${collection}: backfill existing slugs ===`)
    const items = (await client.request(readItems(collection, { fields: ['id', 'slug', 'date'], limit: -1 }) as AnyClient)) as AnyClient[]

    let updated = 0
    let skipped = 0
    let alreadyFixed = 0

    for (const item of items) {
      const prefix = `${item.date}-`
      if (!item.slug.startsWith(prefix)) {
        alreadyFixed++
        continue
      }
      if (SKIP_SLUGS.has(item.slug)) {
        console.log(`  skip (collision, resolve manually): ${item.slug}`)
        skipped++
        continue
      }
      const newSlug = item.slug.slice(prefix.length)
      console.log(`  ${item.slug} -> ${newSlug}`)
      if (!dryRun) await client.request(updateItem(collection, item.id, { slug: newSlug }) as AnyClient)
      updated++
    }

    console.log(`${collection}: updated=${updated} skipped(collision)=${skipped} alreadyFixed=${alreadyFixed}\n`)
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
