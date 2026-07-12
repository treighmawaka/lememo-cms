/**
 * Adds sort/user_updated/date_updated to all 7 content collections, plus
 * enables drag-and-drop reordering -- not part of the Directus runtime.
 *
 * user_created/date_created already existed from the initial schema; this
 * rounds the tracking fields out to Directus's full standard set for model
 * consistency across collections.
 *
 * Idempotent: skips fields/settings that already exist, so it's safe to
 * re-run.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/trackingFieldsUpgrade.ts
 */
import { createField, readFieldsByCollection, updateCollection } from '@directus/sdk'

import { getClient, login, sortField, trackingFields } from './lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

const COLLECTIONS = ['video', 'visuels', 'memo', 'signal', 'focus', 'pages', 'chronologie']

async function main() {
  const client = getClient()
  await login(client)
  console.log('Logged in.\n')

  const newFields = [sortField(), ...trackingFields().filter((f) => f.field === 'user_updated' || f.field === 'date_updated')]

  for (const collection of COLLECTIONS) {
    console.log(`=== ${collection} ===`)
    const existing = await client.request(readFieldsByCollection(collection))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingNames = new Set(existing.map((f: any) => f.field))

    for (const field of newFields) {
      if (existingNames.has(field.field)) {
        console.log(`  field exists, skipping: ${field.field}`)
        continue
      }
      await client.request(createField(collection, field))
      console.log(`  created field: ${field.field}`)
    }

    await client.request(updateCollection(collection, { meta: { sort_field: 'sort' } }))
    console.log(`  set sort_field: sort`)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
