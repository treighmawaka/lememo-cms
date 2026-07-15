/**
 * UI polish after the chronology_events flattening -- not part of the
 * Directus runtime. Hides chronologie's legacy `items` field (data kept,
 * read-only historical reference -- same additive-migration convention used
 * for the old memo/signal collections) and enables drag-and-drop sort on
 * chronology_events.
 *
 * Idempotent: read-modify-write, safe to re-run.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/polishFlatChronologie.ts
 */
import { readField, updateCollection, updateField } from '@directus/sdk'

import { getClient, login } from './lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

async function main() {
  const client = getClient()
  await login(client)
  console.log('Logged in.\n')

  console.log('=== hide legacy field ===')
  const itemsField = await client.request(readField('chronologie', 'items'))
  if (itemsField.meta?.hidden) {
    console.log('  chronologie.items already hidden')
  } else {
    await client.request(
      updateField('chronologie', 'items', {
        meta: { ...itemsField.meta, hidden: true, note: 'Legacy nested shape -- read-only, superseded by chronology_events' },
      }),
    )
    console.log('  chronologie.items -> hidden')
  }

  console.log('\n=== sort_field ===')
  await client.request(updateCollection('chronology_events', { meta: { sort_field: 'sort' } }))
  console.log('  chronology_events: sort_field = sort')

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
