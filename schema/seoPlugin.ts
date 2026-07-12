/**
 * Replaces the flat seo group (seo_title/seo_description/seo_og_image/
 * seo_noindex) with @directus-labs/seo-plugin's consolidated JSON field --
 * not part of the Directus runtime.
 *
 * Per the plugin's README (verified against its compiled source, not
 * guessed): field type must be `json`, recommended key `seo`. That name
 * collides with our existing alias/group-detail container field, which
 * holds no data of its own (alias fields never do), so it's safe to delete
 * and replace outright.
 *
 * Data migration (existing seo_title/seo_description/seo_og_image_file/
 * seo_noindex values -> the new consolidated shape) is a separate script,
 * backfillSeoPlugin.ts, run after this one.
 *
 * Idempotent: skips collections where the seo field is already type json.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/seoPlugin.ts
 */
import { createField, deleteField, readField, updateField } from '@directus/sdk'

import { getClient, login } from './lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

const COLLECTIONS = ['video', 'visuels', 'memo', 'signal', 'focus', 'pages', 'chronologie']

const LEGACY_SEO_FIELDS = ['seo_title', 'seo_description', 'seo_og_image', 'seo_noindex']

async function main() {
  const client = getClient()
  await login(client)
  console.log('Logged in.\n')

  for (const collection of COLLECTIONS) {
    console.log(`=== ${collection} ===`)

    const current = await client.request(readField(collection, 'seo')).catch(() => null)
    if (current?.type === 'json') {
      console.log('  seo field already json, skipping')
    } else {
      if (current) {
        await client.request(deleteField(collection, 'seo'))
        console.log('  deleted old alias "seo" group field')
      }
      await client.request(
        createField(collection, {
          field: 'seo',
          type: 'json',
          meta: {
            interface: 'seo-interface',
            display: 'seo-display',
            options: { titleTemplate: '{{title}}', showOgImage: true, showSearchControls: true },
            note: 'Managed by the SEO plugin. Legacy seo_* fields below are hidden, kept for reference.',
          },
        }),
      )
      console.log('  created new json "seo" field with seo-interface')
    }

    for (const legacyField of LEGACY_SEO_FIELDS) {
      const f = await client.request(readField(collection, legacyField)).catch(() => null)
      if (!f) continue
      if (f.meta.hidden) {
        console.log(`  ${legacyField} already hidden`)
        continue
      }
      await client.request(updateField(collection, legacyField, { meta: { ...f.meta, hidden: true } }))
      console.log(`  hid legacy field: ${legacyField}`)
    }
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
