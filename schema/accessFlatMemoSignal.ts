/**
 * Extends the existing Editor / Staff Writer / Public policies to cover the
 * 4 new flat memo/signal collections -- not part of the Directus runtime.
 * Same permission shape as the original 7 collections (see access.ts and
 * publicAccess.ts): Editor gets full CRUD, Staff Writer gets create/read/
 * update (no delete), Public gets read.
 *
 * Idempotent: skips permissions that already exist.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/accessFlatMemoSignal.ts
 */
import { createPermission, readPermissions, readPolicies } from '@directus/sdk'

import { getClient, login } from './lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

const NEW_COLLECTIONS = ['memo_digests', 'memos', 'signal_digests', 'signals']

async function ensurePermission(client: AnyClient, policyId: string, collection: string, action: 'create' | 'read' | 'update' | 'delete') {
  const existing = await client.request(
    readPermissions({ filter: { policy: { _eq: policyId }, collection: { _eq: collection }, action: { _eq: action } }, limit: 1 }),
  )
  if (existing.length > 0) {
    console.log(`  permission exists: ${collection}.${action}`)
    return
  }
  await client.request(createPermission({ policy: policyId, collection, action, permissions: {}, fields: ['*'] }))
  console.log(`  created permission: ${collection}.${action}`)
}

async function findPolicyId(client: AnyClient, name: string): Promise<string> {
  const policies = await client.request(readPolicies({ filter: { name: { _eq: name } }, limit: 1 }))
  if (!policies[0]) throw new Error(`Could not find policy "${name}"`)
  return policies[0].id
}

async function main() {
  const client = getClient()
  await login(client)
  console.log('Logged in.\n')

  const editorPolicyId = await findPolicyId(client, 'Editor Access')
  const staffPolicyId = await findPolicyId(client, 'Staff Writer Access')
  const publicPolicyId = await findPolicyId(client, '$t:public_label')

  console.log('=== editor (full CRUD) ===')
  for (const collection of NEW_COLLECTIONS) {
    for (const action of ['create', 'read', 'update', 'delete'] as const) {
      await ensurePermission(client, editorPolicyId, collection, action)
    }
  }

  console.log('\n=== staff-writer (no delete) ===')
  for (const collection of NEW_COLLECTIONS) {
    for (const action of ['create', 'read', 'update'] as const) {
      await ensurePermission(client, staffPolicyId, collection, action)
    }
  }

  console.log('\n=== public (read) ===')
  for (const collection of NEW_COLLECTIONS) {
    await ensurePermission(client, publicPolicyId, collection, 'read')
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
