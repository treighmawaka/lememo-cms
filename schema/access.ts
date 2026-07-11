/**
 * Roles/policies/permissions -- not part of the Directus runtime.
 *
 * Mirrors src/access/contentAccess.ts + roles.ts from the Payload project,
 * with one deliberate gap: Payload's staff-writer role scoped reads/updates
 * to the user's own docs (user_created == current user) and blocked setting
 * status to "published". That requires row-level permission filters and
 * validation rules, both gated behind Directus's paid "Custom Access
 * Policies" feature -- confirmed via direct API testing, the free Core plan
 * rejects any non-trivial `permissions`/`validation` rule with
 * "custom_permission_rules_enabled is a restricted resource", even for a
 * static filter with no dynamic variables. So for now staff-writer gets full
 * CRUD on content minus delete -- same reach as editor, just no delete.
 * Revisit if/when an Open Innovation Grant license key is added, or a custom
 * hook extension is built to enforce this in code instead.
 *
 *   - admin: Directus's built-in Administrator role, untouched.
 *   - editor: full CRUD on all content collections, no user/role management.
 *   - staff-writer: create/read/update on all content collections, no delete.
 *
 * Idempotent: skips roles/policies/permissions that already exist, so it's
 * safe to re-run.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/access.ts
 */
import { createPermission, createPolicy, createRole, readPermissions, readPolicies, readRoles } from '@directus/sdk'

import { getClient, login } from './lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

const CONTENT_COLLECTIONS = ['memo', 'signal', 'focus', 'video', 'visuels', 'chronologie', 'pages']

interface PermissionDef {
  collection: string
  action: 'create' | 'read' | 'update' | 'delete'
  permissions?: Record<string, unknown>
  validation?: Record<string, unknown>
  fields?: string[]
}

async function ensurePolicy(client: AnyClient, name: string, description: string): Promise<string> {
  const existing = await client.request(readPolicies({ filter: { name: { _eq: name } }, limit: 1 }))
  if (existing.length > 0) {
    console.log(`policy already exists: ${name}`)
    return existing[0].id
  }
  const created = await client.request(createPolicy({ name, description, admin_access: false, app_access: true }))
  console.log(`created policy: ${name}`)
  return created.id
}

async function ensureRole(client: AnyClient, name: string, policyId: string): Promise<string> {
  const existing = await client.request(readRoles({ filter: { name: { _eq: name } }, limit: 1 }))
  if (existing.length > 0) {
    console.log(`role already exists: ${name}`)
    return existing[0].id
  }
  const created = await client.request(createRole({ name, policies: [{ policy: policyId } as never] }))
  console.log(`created role: ${name} (attached to policy)`)
  return created.id
}

async function ensurePermission(client: AnyClient, policyId: string, def: PermissionDef) {
  const existing = await client.request(
    readPermissions({ filter: { policy: { _eq: policyId }, collection: { _eq: def.collection }, action: { _eq: def.action } }, limit: 1 }),
  )
  if (existing.length > 0) {
    console.log(`  permission exists: ${def.collection}.${def.action}`)
    return
  }
  await client.request(
    createPermission({
      policy: policyId,
      collection: def.collection,
      action: def.action,
      permissions: def.permissions ?? {},
      validation: def.validation ?? {},
      fields: def.fields ?? ['*'],
    }),
  )
  console.log(`  created permission: ${def.collection}.${def.action}`)
}

async function main() {
  const client = getClient()
  await login(client)
  console.log('Logged in.\n')

  // --- Editor: full CRUD on content + media, no user/role management ---
  console.log('=== editor ===')
  const editorPolicyId = await ensurePolicy(client, 'Editor Access', 'Full CRUD on editorial content, no user management.')
  await ensureRole(client, 'Editor', editorPolicyId)
  for (const collection of [...CONTENT_COLLECTIONS, 'directus_files', 'directus_folders']) {
    for (const action of ['create', 'read', 'update', 'delete'] as const) {
      await ensurePermission(client, editorPolicyId, { collection, action })
    }
  }

  // --- Staff writer: full CRUD on content minus delete (see file header re: row-level scoping gap) ---
  console.log('\n=== staff-writer ===')
  const staffPolicyId = await ensurePolicy(client, 'Staff Writer Access', 'Full CRUD on content, no delete, no user management.')
  await ensureRole(client, 'Staff Writer', staffPolicyId)
  for (const collection of CONTENT_COLLECTIONS) {
    await ensurePermission(client, staffPolicyId, { collection, action: 'create' })
    await ensurePermission(client, staffPolicyId, { collection, action: 'read' })
    await ensurePermission(client, staffPolicyId, { collection, action: 'update' })
    // No delete permission -- matches Payload's contentAccess.delete (admin/editor only).
  }
  // Needs to upload images while writing content, unrestricted (matches the
  // original Media collection's open `read: () => true` + implicit create access).
  await ensurePermission(client, staffPolicyId, { collection: 'directus_files', action: 'create' })
  await ensurePermission(client, staffPolicyId, { collection: 'directus_files', action: 'read' })
  await ensurePermission(client, staffPolicyId, { collection: 'directus_folders', action: 'read' })

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
