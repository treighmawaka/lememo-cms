/**
 * Schema-as-code runner -- not part of the Directus runtime.
 *
 * Creates all content collections + fields via the Directus Management API,
 * mirroring src/collections/*.ts from the Payload project. Idempotent: skips
 * collections/fields that already exist, so it's safe to re-run.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/apply.ts
 */
import { createCollection, createField, createRelation, readCollection, readFieldsByCollection } from '@directus/sdk'

import { chronologieCollection } from './collections/chronologie'
import { focusCollection } from './collections/focus'
import { memoCollection } from './collections/memo'
import { pagesCollection } from './collections/pages'
import { signalCollection } from './collections/signal'
import { videoCollection } from './collections/video'
import { visuelsCollection } from './collections/visuels'
import { getClient, login, m2oField, primaryKeyField, type CollectionDef } from './lib'

const collections: CollectionDef[] = [
  videoCollection,
  visuelsCollection,
  memoCollection,
  signalCollection,
  focusCollection,
  pagesCollection,
  chronologieCollection,
]

// Added after all collections exist -- visuels and focus reference each other.
const relations: { collection: string; field: string; related: string }[] = [
  { collection: 'memo', field: 'featured_video', related: 'video' },
  { collection: 'focus', field: 'visuel', related: 'visuels' },
  { collection: 'visuels', field: 'related_link', related: 'focus' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

async function existingFieldNames(client: AnyClient, collection: string): Promise<Set<string>> {
  try {
    const fields = await client.request(readFieldsByCollection(collection))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Set(fields.map((f: any) => f.field))
  } catch {
    return new Set()
  }
}

async function applyCollection(client: AnyClient, def: CollectionDef) {
  let exists = true
  try {
    await client.request(readCollection(def.collection))
  } catch {
    exists = false
  }

  if (!exists) {
    await client.request(
      createCollection({
        collection: def.collection,
        meta: { icon: def.icon, note: def.note },
        schema: {},
        fields: [primaryKeyField()],
      }),
    )
    console.log(`created collection: ${def.collection}`)
  } else {
    console.log(`collection already exists: ${def.collection}`)
  }

  const existing = await existingFieldNames(client, def.collection)

  for (const field of def.fields) {
    if (existing.has(field.field)) {
      console.log(`  field exists, skipping: ${field.field}`)
      continue
    }
    try {
      await client.request(createField(def.collection, field))
      console.log(`  created field: ${field.field}`)
    } catch (err) {
      console.error(`  FAILED field ${field.field}:`, err instanceof Error ? err.message : err)
    }
  }
}

async function applyRelation(client: AnyClient, rel: { collection: string; field: string; related: string }) {
  const existing = await existingFieldNames(client, rel.collection)

  if (!existing.has(rel.field)) {
    try {
      await client.request(createField(rel.collection, m2oField(rel.field)))
      console.log(`created relation field: ${rel.collection}.${rel.field}`)
    } catch (err) {
      console.error(`FAILED relation field ${rel.collection}.${rel.field}:`, err instanceof Error ? err.message : err)
      return
    }
  } else {
    console.log(`relation field exists: ${rel.collection}.${rel.field}`)
  }

  try {
    await client.request(createRelation({ collection: rel.collection, field: rel.field, related_collection: rel.related }))
    console.log(`created relation: ${rel.collection}.${rel.field} -> ${rel.related}`)
  } catch (err) {
    console.error(`FAILED relation ${rel.collection}.${rel.field} -> ${rel.related}:`, err instanceof Error ? err.message : err)
  }
}

async function main() {
  const client = getClient()
  await login(client)
  console.log('Logged in.')

  for (const def of collections) {
    console.log(`\n=== ${def.collection} ===`)
    await applyCollection(client, def)
  }

  console.log(`\n=== relations ===`)
  for (const rel of relations) {
    await applyRelation(client, rel)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
