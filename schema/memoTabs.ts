/**
 * Applies the same tab organization used on focus (meta_tabs container with
 * group-raw sub-tabs, via @timio23/directus-group-tabs) to memo -- not part
 * of the Directus runtime.
 *
 * Memo's field set is much narrower than focus's (no author/media/settings
 * fields), so only the tabs with actual content are created: Content and
 * SEO. Legacy hidden seo_* text fields are left as-is (invisible either way).
 *
 * Idempotent: skips groups/reassignments that already match.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/memoTabs.ts
 */
import { createField, readField, readFieldsByCollection, updateField } from '@directus/sdk'

import { getClient, login } from './lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

// [tab field name, tab label, member fields to reassign into it]
const MEMO_TABS: [string, string, string[]][] = [
  ['meta_content', 'Content', ['slug', 'title', 'date', 'status', 'reading_time', 'summary', 'items', 'featured_video']],
  ['meta_seo', 'SEO', ['seo', 'seo_og_image_file']],
]

async function main() {
  const client = getClient()
  await login(client)
  console.log('Logged in.\n')

  const existing = await client.request(readFieldsByCollection('memo'))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingNames = new Set(existing.map((f: any) => f.field))

  if (!existingNames.has('meta_tabs')) {
    await client.request(
      createField('memo', {
        field: 'meta_tabs',
        type: 'alias',
        meta: { interface: 'group-tabs', special: ['alias', 'no-data', 'group'], options: { fillWidth: false } },
      }),
    )
    console.log('created tabs container: meta_tabs')
  } else {
    console.log('meta_tabs already exists, skipping create')
  }

  for (const [tabField, label] of MEMO_TABS) {
    if (existingNames.has(tabField)) {
      console.log(`  tab exists, skipping create: ${tabField}`)
      continue
    }
    await client.request(
      createField('memo', {
        field: tabField,
        type: 'alias',
        meta: { interface: 'group-raw', special: ['alias', 'no-data', 'group'], group: 'meta_tabs', options: { title: label } },
      }),
    )
    console.log(`created tab: ${tabField} (${label})`)
  }

  for (const [tabField, , members] of MEMO_TABS) {
    for (const member of members) {
      if (!existingNames.has(member)) {
        console.log(`  skip reassign, field not found: memo.${member}`)
        continue
      }
      const current = await client.request(readField('memo', member))
      if (current.meta.group === tabField) {
        console.log(`  memo.${member} already in "${tabField}"`)
        continue
      }
      await client.request(updateField('memo', member, { meta: { ...current.meta, group: tabField } }))
      console.log(`  memo.${member} -> group "${tabField}"`)
    }
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
