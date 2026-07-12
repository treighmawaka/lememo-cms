/**
 * Grants the built-in Public policy read access to all content collections
 * and media -- not part of the Directus runtime.
 *
 * Directus's free Core plan blocks row-level permission filters (confirmed
 * via direct API testing in access.ts), so this can't be scoped to
 * status=published at the permission layer -- it's unrestricted read access
 * to every record in these collections, including future drafts. The
 * frontend is responsible for filtering to status=published in its own
 * queries. Acceptable tradeoff for a low-stakes media site; revisit with a
 * grant key or custom extension if that ever needs tightening.
 *
 * Idempotent: skips permissions that already exist, so it's safe to re-run.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/publicAccess.ts
 */
import { createPermission, readPermissions, readPolicies } from '@directus/sdk'

import { getClient, login } from './lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

const CONTENT_COLLECTIONS = ['memo', 'signal', 'focus', 'video', 'visuels', 'chronologie', 'pages']

async function ensureReadPermission(client: AnyClient, policyId: string, collection: string) {
  const existing = await client.request(
    readPermissions({ filter: { policy: { _eq: policyId }, collection: { _eq: collection }, action: { _eq: 'read' } }, limit: 1 }),
  )
  if (existing.length > 0) {
    console.log(`  permission exists: ${collection}.read`)
    return
  }
  await client.request(createPermission({ policy: policyId, collection, action: 'read', permissions: {}, fields: ['*'] }))
  console.log(`  created permission: ${collection}.read`)
}

async function main() {
  const client = getClient()
  await login(client)
  console.log('Logged in.\n')

  const policies = await client.request(readPolicies({ filter: { name: { _eq: '$t:public_label' } }, limit: 1 }))
  const publicPolicy = policies[0]
  if (!publicPolicy) throw new Error('Could not find the built-in Public policy')
  console.log(`Public policy: ${publicPolicy.id}\n`)

  for (const collection of [...CONTENT_COLLECTIONS, 'directus_files']) {
    await ensureReadPermission(client, publicPolicy.id, collection)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
