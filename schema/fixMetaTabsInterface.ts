/**
 * Fixes the focus.meta_tabs group field, created manually via the Admin UI,
 * which was set to "group-tabs" -- the same directus-extension-group-tabs-
 * interface removed in the earlier revert (see revertGroupTabs.ts) for
 * corrupting the whole page's rendering, not just its own component. The
 * package isn't loaded by either instance anymore, so any field still
 * configured to use it fails with "Unexpected Error", taking every field
 * nested inside it down too.
 *
 * Swaps to Directus's built-in group-detail (accordion) interface -- no
 * extension dependency, same interface already used successfully for the
 * pre-existing seo group. Preserves the meta_content/meta_settings/meta_seo
 * child groups and all field assignments as built.
 *
 * Idempotent: no-ops if already fixed.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/fixMetaTabsInterface.ts
 */
import { readField, updateField } from '@directus/sdk'

import { getClient, login } from './lib'

async function main() {
  const client = getClient()
  await login(client)
  console.log('Logged in.\n')

  const current = await client.request(readField('focus', 'meta_tabs'))
  if (current.meta.interface === 'group-detail') {
    console.log('focus.meta_tabs already uses group-detail, nothing to do.')
    return
  }

  await client.request(updateField('focus', 'meta_tabs', { meta: { ...current.meta, interface: 'group-detail' } }))
  console.log(`focus.meta_tabs: ${current.meta.interface} -> group-detail`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
