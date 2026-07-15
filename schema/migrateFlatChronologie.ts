/**
 * Explodes chronologie's nested items[].events[] into the flat
 * chronology_events collection -- not part of the Directus runtime. Requires
 * applyFlatChronologie.ts to have run first.
 *
 * For each chronologie doc: iterates its groups top to bottom and each
 * group's events top to bottom, creating one chronology_events row per event
 * (event_group carried over as a plain denormalized field, sort = flat
 * traversal index so original order is preserved once grouped by
 * event_group again at render time).
 *
 * Idempotent: skips a chronologie doc if it already has any chronology_events
 * rows (there is no per-event natural key to dedupe against individually).
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx schema/migrateFlatChronologie.ts
 */
import { createItem, readItems } from '@directus/sdk'

import { getClient, login } from './lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

async function main() {
  const client = getClient()
  await login(client)
  console.log('Logged in.\n')

  const docs = await client.request(readItems('chronologie', { limit: -1 }) as AnyClient)

  let docsExploded = 0
  let eventsCreated = 0

  for (const doc of docs as AnyClient[]) {
    const existing = await client.request(
      readItems('chronology_events', { filter: { chronologie: { _eq: doc.id } }, limit: 1, fields: ['id'] }) as AnyClient,
    )
    if (existing.length > 0) {
      console.log(`skip doc (events already exist): ${doc.slug}`)
      continue
    }

    const groups: AnyClient[] = Array.isArray(doc.items) ? doc.items : []
    let sort = 0
    let docEventsCreated = 0

    for (const group of groups) {
      const events: AnyClient[] = Array.isArray(group.events) ? group.events : []
      for (const event of events) {
        const payload = {
          chronologie: doc.id,
          event_group: group.event_group,
          event: event.event,
          note: event.note,
          category: event.category,
          presidency: event.presidency,
          importance: event.importance,
          show: event.show ?? true,
          location: event.location,
          tags: Array.isArray(event.tags) ? event.tags : [],
          images: Array.isArray(event.images) ? event.images : [],
          videos: Array.isArray(event.videos) ? event.videos : [],
          sort,
        }
        try {
          await client.request(createItem('chronology_events', payload) as AnyClient)
        } catch (err) {
          console.error(`FAILED event on doc ${doc.slug} (sort ${sort}):`, JSON.stringify(payload, null, 2))
          throw err
        }
        sort++
        docEventsCreated++
      }
    }

    console.log(`  ${doc.slug}: ${groups.length} groups -> ${docEventsCreated} events created`)
    eventsCreated += docEventsCreated
    docsExploded++
  }

  console.log(`\ndocs exploded: ${docsExploded}, events created: ${eventsCreated}`)
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
