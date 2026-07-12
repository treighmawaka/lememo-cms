/**
 * Applies Directus Labs / community extension interfaces to existing
 * fields -- not part of the Directus runtime. Pure UI/editing-experience
 * upgrades: only meta.interface (and meta.options where needed) change,
 * never the underlying field type or stored data, so this is safe to
 * re-run and easy to revert.
 *
 * Requires @directus-labs/card-select-interfaces, @directus-labs/inline-
 * repeater-interface, directus-extension-wpslug-interface, and
 * directus-extension-group-tabs-interface to already be installed
 * (package.json dependencies) and loaded by the running Directus instance.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/labsExtensions.ts
 */
import { createField, readField, readFieldsByCollection, updateField } from '@directus/sdk'

import { getClient, login } from './lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

const SLUG_COLLECTIONS = ['video', 'visuels', 'memo', 'signal', 'focus', 'pages', 'chronologie']
const STATUS_COLLECTIONS = SLUG_COLLECTIONS
const REPEATER_TARGETS: [string, string][] = [
  ['memo', 'items'],
  ['signal', 'items'],
  ['visuels', 'items'],
  ['chronologie', 'items'],
  ['focus', 'updates'],
]

// wpslug's own README: "Does this work through the API? No, this is just an
// interface. It works only on Directus App" -- purely an editing-UX upgrade,
// doesn't touch already-migrated data. update:['create'] only, not
// ['create','update'] -- these slugs are stable natural keys (original
// filenames); auto-regenerating on title edits would silently break them.
async function applyWpslug(client: AnyClient, collection: string) {
  await client.request(
    updateField(collection, 'slug', {
      meta: { interface: 'extension-wpslug', options: { template: '{{title}}', update: ['create'] } },
    }),
  )
  console.log(`  ${collection}.slug -> extension-wpslug`)
}

// Read-modify-write: only swap the interface, keep the existing choices/
// fields options intact rather than reconstructing them by hand.
async function swapInterface(client: AnyClient, collection: string, field: string, newInterface: string) {
  const current = await client.request(readField(collection, field))
  await client.request(
    updateField(collection, field, {
      meta: { ...current.meta, interface: newInterface },
    }),
  )
  console.log(`  ${collection}.${field} -> ${newInterface}`)
}

// [tab field name, tab label, member fields to reassign into it]
const FOCUS_TABS: [string, string, string[]][] = [
  ['tab_content', 'Content', ['title', 'description', 'teaser', 'date', 'status', 'region', 'category', 'subcategory', 'reading_time', 'body']],
  ['tab_media_author', 'Media & Author', ['image_file', 'image_alt', 'image_credit', 'video_youtube_id', 'video_title', 'visuel', 'author', 'author_bio', 'author_thumbnail_file', 'author_url']],
  ['tab_publishing', 'Publishing', ['updates', 'hide_description', 'hide_author_byline', 'special_publication']],
]

async function applyGroupTabsToFocus(client: AnyClient) {
  const existing = await client.request(readFieldsByCollection('focus'))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingNames = new Set(existing.map((f: any) => f.field))

  for (const [tabField, label] of FOCUS_TABS) {
    if (existingNames.has(tabField)) {
      console.log(`  tab exists, skipping create: ${tabField}`)
      continue
    }
    await client.request(
      createField('focus', {
        field: tabField,
        type: 'alias',
        meta: { interface: 'group-tabs', special: ['alias', 'no-data'], options: { title: label } },
      }),
    )
    console.log(`  created tab: ${tabField} (${label})`)
  }

  for (const [tabField, , members] of FOCUS_TABS) {
    for (const member of members) {
      if (!existingNames.has(member)) {
        console.log(`  skip reassign, field not found: focus.${member}`)
        continue
      }
      const current = await client.request(readField('focus', member))
      await client.request(updateField('focus', member, { meta: { ...current.meta, group: tabField } }))
      console.log(`  focus.${member} -> group "${tabField}"`)
    }
  }
}

async function main() {
  const client = getClient()
  await login(client)
  console.log('Logged in.\n')

  console.log('=== wpslug (slug fields) ===')
  for (const collection of SLUG_COLLECTIONS) {
    await applyWpslug(client, collection)
  }

  console.log('\n=== radio-cards-interface (enum fields) ===')
  for (const collection of STATUS_COLLECTIONS) {
    await swapInterface(client, collection, 'status', 'radio-cards-interface')
  }
  await swapInterface(client, 'video', 'platform', 'radio-cards-interface')
  await swapInterface(client, 'focus', 'region', 'radio-cards-interface')

  console.log('\n=== inline-repeater-interface (JSON repeater fields) ===')
  for (const [collection, field] of REPEATER_TARGETS) {
    await swapInterface(client, collection, field, 'inline-repeater-interface')
  }

  console.log('\n=== group-tabs (focus) ===')
  await applyGroupTabsToFocus(client)

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
