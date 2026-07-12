/**
 * UI polish for the new flat memo/signal collections -- not part of the
 * Directus runtime. Matches conventions already established on the other
 * collections: radio-cards-interface on the enum fields (status, region),
 * and sort_field enabled for drag-and-drop reordering within a digest day.
 * No tab layout -- these collections have far fewer fields than focus, a
 * flat form is fine.
 *
 * Idempotent: read-modify-write, safe to re-run.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/polishFlatMemoSignal.ts
 */
import { readField, updateCollection, updateField } from '@directus/sdk'

import { getClient, login } from './lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

const ITEM_COLLECTIONS = ['memos', 'signals']
const ALL_COLLECTIONS = ['memo_digests', 'memos', 'signal_digests', 'signals']

async function swapInterface(client: AnyClient, collection: string, field: string, newInterface: string) {
  const current = await client.request(readField(collection, field))
  if (current.meta.interface === newInterface) {
    console.log(`  ${collection}.${field} already ${newInterface}`)
    return
  }
  await client.request(updateField(collection, field, { meta: { ...current.meta, interface: newInterface } }))
  console.log(`  ${collection}.${field} -> ${newInterface}`)
}

async function main() {
  const client = getClient()
  await login(client)
  console.log('Logged in.\n')

  for (const collection of ITEM_COLLECTIONS) {
    await swapInterface(client, collection, 'status', 'radio-cards-interface')
    await swapInterface(client, collection, 'region', 'radio-cards-interface')
  }

  console.log('\n=== sort_field ===')
  for (const collection of ALL_COLLECTIONS) {
    await client.request(updateCollection(collection, { meta: { sort_field: 'sort' } }))
    console.log(`  ${collection}: sort_field = sort`)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
