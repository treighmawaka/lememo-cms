/**
 * Creates the flat memo/signal item + digest collections -- not part of the
 * Directus runtime. Replaces the nested items-array design (memo/signal
 * collections) with real relational rows: memo_digests/signal_digests hold
 * only day-level editorial fields (date, summary, seo); memos/signals hold
 * one row per story item, individually queryable/sortable/relatable.
 *
 * Idempotent: skips collections/fields/relations that already exist.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/applyFlatMemoSignal.ts
 */
import { createCollection, createField, createRelation, readCollection, readFieldsByCollection } from '@directus/sdk'

import { memoDigestsCollection } from './collections/memoDigests'
import { memosCollection } from './collections/memos'
import { signalDigestsCollection } from './collections/signalDigests'
import { signalsCollection } from './collections/signals'
import { getClient, login, primaryKeyField, type CollectionDef } from './lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

const collections: CollectionDef[] = [memoDigestsCollection, signalDigestsCollection, memosCollection, signalsCollection]

const relations: { collection: string; field: string; related: string }[] = [
  { collection: 'memos', field: 'memo_digest', related: 'memo_digests' },
  { collection: 'memos', field: 'thumbnail_file', related: 'directus_files' },
  { collection: 'signals', field: 'signal_digest', related: 'signal_digests' },
  { collection: 'signals', field: 'thumbnail_file', related: 'directus_files' },
]

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
      createCollection({ collection: def.collection, meta: { icon: def.icon, note: def.note }, schema: {}, fields: [primaryKeyField()] }),
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
  console.log('Logged in.\n')

  for (const def of collections) {
    console.log(`\n=== ${def.collection} ===`)
    await applyCollection(client, def)
  }

  console.log('\n=== relations ===')
  for (const rel of relations) {
    await applyRelation(client, rel)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
