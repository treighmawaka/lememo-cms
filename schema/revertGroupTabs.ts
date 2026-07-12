/**
 * Reverts the group-tabs application from labsExtensions.ts -- not part of
 * the Directus runtime.
 *
 * directus-extension-group-tabs-interface has a major peer-dependency
 * mismatch (wants vue-i18n ^9.2.2, this Directus version bundles 11.1.11)
 * that breaks rendering of the whole admin page it's used on, not just its
 * own component -- confirmed by the SEO group (Directus's own built-in
 * group-detail interface, never touched by labsExtensions.ts) also throwing
 * "Unexpected Error" once group-tabs was in use. Ungroups the affected focus
 * fields back to top-level and deletes the 3 tab container fields.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/revertGroupTabs.ts
 */
import { deleteField, readField, updateField } from '@directus/sdk'

import { getClient, login } from './lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

const TAB_FIELDS = ['tab_content', 'tab_media_author', 'tab_publishing']

const MEMBER_FIELDS = [
  'title', 'description', 'teaser', 'date', 'status', 'region', 'category', 'subcategory', 'reading_time', 'body',
  'image_file', 'image_alt', 'image_credit', 'video_youtube_id', 'video_title', 'visuel', 'author', 'author_bio', 'author_thumbnail_file', 'author_url',
  'updates', 'hide_description', 'hide_author_byline', 'special_publication',
]

async function main() {
  const client = getClient()
  await login(client)
  console.log('Logged in.\n')

  for (const field of MEMBER_FIELDS) {
    const current = await client.request(readField('focus', field))
    await client.request(updateField('focus', field, { meta: { ...current.meta, group: null } }))
    console.log(`  focus.${field} -> ungrouped`)
  }

  for (const tabField of TAB_FIELDS) {
    try {
      await client.request(deleteField('focus', tabField))
      console.log(`  deleted: ${tabField}`)
    } catch (err) {
      console.error(`  FAILED to delete ${tabField}:`, err instanceof Error ? err.message : err)
    }
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
