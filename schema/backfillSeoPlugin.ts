/**
 * Migrates existing seo_title/seo_description/seo_og_image_file/seo_noindex
 * values into the new consolidated `seo` JSON field (see seoPlugin.ts) --
 * not part of the Directus runtime. Requires seoPlugin.ts to have run first.
 *
 * Matches the seo-plugin's own default-value shape (verified from its
 * compiled source) so the interface behaves exactly as if a user had filled
 * it in via the form.
 *
 * Idempotent: skips items that already have a non-empty seo.title or
 * seo.meta_description, so it's safe to re-run.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/backfillSeoPlugin.ts
 */
import { readItems, updateItem } from '@directus/sdk'

import { getClient, login } from './lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

const COLLECTIONS = ['video', 'visuels', 'memo', 'signal', 'focus', 'pages', 'chronologie']

async function main() {
  const client = getClient()
  await login(client)
  console.log('Logged in.\n')

  let updated = 0
  let skipped = 0

  for (const collection of COLLECTIONS) {
    const items = await client.request(
      readItems(collection, {
        fields: ['id', 'seo', 'seo_title', 'seo_description', 'seo_og_image_file', 'seo_noindex'],
        limit: -1,
      }) as AnyClient,
    )

    for (const item of items as AnyClient[]) {
      if (item.seo?.title || item.seo?.meta_description) {
        skipped++
        continue
      }
      const hasLegacyData = item.seo_title || item.seo_description || item.seo_og_image_file || item.seo_noindex
      if (!hasLegacyData) continue

      const seo = {
        title: item.seo_title ?? '',
        meta_description: item.seo_description ?? '',
        focus_keyphrase: '',
        og_image: item.seo_og_image_file ?? '',
        no_index: item.seo_noindex ?? false,
        no_follow: false,
        additional_fields: {},
        sitemap: { priority: '0.5', change_frequency: 'weekly' },
      }

      await client.request(updateItem(collection, item.id, { seo }))
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
