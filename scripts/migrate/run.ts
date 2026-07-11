/**
 * Standalone migration script -- not part of the Directus runtime.
 *
 * Reads content and maps it onto the Directus schema (schema/collections/*.ts).
 *
 * Usage:
 *   pnpm exec tsx scripts/migrate/run.ts                        # dry run against the full content set
 *   pnpm exec tsx scripts/migrate/run.ts --source=./reference    # dry run against the sample files only
 *   pnpm exec tsx scripts/migrate/run.ts --live                  # insert via the Directus API (needs .env)
 *
 * Defaults to reading from /Users/treighmawaka/Desktop/packages/lememo/content
 * (read-only -- this script only ever reads from that path, never writes).
 *
 * Idempotent: in --live mode, each record's `slug` is checked against existing
 * items before insert, so re-running the script does not duplicate data.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createItem, readItems } from '@directus/sdk'

import { getClient, login } from '../../schema/lib'
import { listMarkdownFiles, readMarkdownFile } from './lib'
import { mapChronologie, mapFocus, mapMemo, mapPages, mapSignal, mapVideo, mapVisuels } from './mappers'
import { checkFrontmatterShape } from './schemaCheck'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.resolve(dirname, 'output')

const DEFAULT_CONTENT_DIR = '/Users/treighmawaka/Desktop/packages/lememo/content'
const sourceArg = process.argv.find((a) => a.startsWith('--source='))
const sourceDir = sourceArg ? path.resolve(process.cwd(), sourceArg.slice('--source='.length)) : DEFAULT_CONTENT_DIR

const isLive = process.argv.includes('--live')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

interface CollectionJob {
  slug: string
  mapper: (
    ctx: { client: AnyClient; warnings: string[] },
    file: ReturnType<typeof readMarkdownFile>,
  ) => Promise<Record<string, unknown>>
}

// video/visuels before focus/memo/signal, since focus/memo may reference them.
// Cross-references that don't resolve within the current run are logged as
// warnings, not failures.
const jobs: CollectionJob[] = [
  { slug: 'video', mapper: mapVideo },
  { slug: 'visuels', mapper: mapVisuels },
  { slug: 'memo', mapper: mapMemo },
  { slug: 'signal', mapper: mapSignal },
  { slug: 'focus', mapper: mapFocus },
  { slug: 'pages', mapper: mapPages },
  { slug: 'chronologie', mapper: mapChronologie },
]

interface CollectionSummary {
  slug: string
  read: number
  inserted: number
  skipped: { slug: string; reason: string }[]
  failed: { slug: string; reason: string }[]
  // Frontmatter shape deviations from the schema inferred from the sample
  // files -- flagged, never auto-fixed. One entry per file that has any.
  shapeFlags: { slug: string; flags: string[] }[]
  warnings: string[]
}

async function migrateCollection(job: CollectionJob, client: AnyClient): Promise<CollectionSummary> {
  const summary: CollectionSummary = {
    slug: job.slug,
    read: 0,
    inserted: 0,
    skipped: [],
    failed: [],
    shapeFlags: [],
    warnings: [],
  }

  const dir = path.join(sourceDir, job.slug)
  const files = listMarkdownFiles(dir)
  summary.read = files.length

  const mappedDocs: Record<string, unknown>[] = []

  for (const filePath of files) {
    const fileSlug = path.basename(filePath, path.extname(filePath))
    let parsed: ReturnType<typeof readMarkdownFile>
    try {
      parsed = readMarkdownFile(filePath)
    } catch (err) {
      summary.failed.push({ slug: fileSlug, reason: `parse error: ${err instanceof Error ? err.message : String(err)}` })
      continue
    }

    const staticFlags = checkFrontmatterShape(job.slug, parsed.data)

    const warnings: string[] = []
    let data: Record<string, unknown>
    try {
      data = await job.mapper({ client, warnings }, parsed)
    } catch (err) {
      summary.failed.push({ slug: parsed.slug, reason: err instanceof Error ? err.message : String(err) })
      if (staticFlags.length > 0) summary.shapeFlags.push({ slug: parsed.slug, flags: staticFlags })
      continue
    }

    const mappingShapeFlags = warnings.filter((w) => w.startsWith('SHAPE '))
    const otherWarnings = warnings.filter((w) => !w.startsWith('SHAPE '))
    const allFlags = [...staticFlags, ...mappingShapeFlags]
    if (allFlags.length > 0) summary.shapeFlags.push({ slug: parsed.slug, flags: allFlags })

    for (const warning of otherWarnings) {
      summary.warnings.push(`[${parsed.slug}] ${warning}`)
    }

    mappedDocs.push(data)

    if (!isLive || !client) {
      continue
    }

    try {
      const existing = await client.request(
        readItems(job.slug, { filter: { slug: { _eq: parsed.slug } }, limit: 1, fields: ['id'] }),
      )
      if (existing.length > 0) {
        summary.skipped.push({ slug: parsed.slug, reason: 'already exists' })
        continue
      }
      await client.request(createItem(job.slug, data))
      summary.inserted += 1
    } catch (err) {
      summary.failed.push({ slug: parsed.slug, reason: err instanceof Error ? err.message : String(err) })
    }
  }

  if (!isLive) {
    fs.mkdirSync(outputDir, { recursive: true })
    fs.writeFileSync(path.join(outputDir, `${job.slug}.json`), JSON.stringify(mappedDocs, null, 2))
  }

  return summary
}

function printSummary(summaries: CollectionSummary[]) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(isLive ? 'MIGRATION SUMMARY (live)' : 'MIGRATION SUMMARY (dry run -- no records inserted)')
  console.log(`source: ${sourceDir}`)
  console.log('='.repeat(70))

  const totalRead = summaries.reduce((s, c) => s + c.read, 0)
  const totalFailed = summaries.reduce((s, c) => s + c.failed.length, 0)
  const totalShapeFlags = summaries.reduce((s, c) => s + c.shapeFlags.length, 0)
  console.log(
    `\nTOTAL: ${totalRead} files read, ${totalFailed} parse/mapping failures, ${totalShapeFlags} files with shape flags\n`,
  )

  for (const s of summaries) {
    console.log(`${s.slug}`)
    console.log(`  read:     ${s.read}`)
    if (isLive) {
      console.log(`  inserted: ${s.inserted}`)
      console.log(`  skipped:  ${s.skipped.length}`)
      for (const skip of s.skipped) console.log(`    - ${skip.slug}: ${skip.reason}`)
    } else {
      console.log(`  mapped:   ${s.read - s.failed.length} (written to scripts/migrate/output/${s.slug}.json)`)
    }
    console.log(`  failed:   ${s.failed.length}`)
    for (const fail of s.failed) console.log(`    - ${fail.slug}: ${fail.reason}`)
    if (s.shapeFlags.length > 0) {
      console.log(`  shape flags: ${s.shapeFlags.length} file(s)`)
      for (const entry of s.shapeFlags) {
        console.log(`    - ${entry.slug}:`)
        for (const flag of entry.flags) console.log(`        ${flag}`)
      }
    }
    if (s.warnings.length > 0) {
      console.log(`  warnings:`)
      for (const warning of s.warnings) console.log(`    - ${warning}`)
    }
    console.log()
  }
  console.log('='.repeat(70), '\n')
}

async function printVerification(client: AnyClient, summaries: CollectionSummary[]) {
  console.log(`\n${'='.repeat(60)}`)
  console.log('VERIFICATION: source vs. Directus item counts')
  console.log('='.repeat(60))
  console.log(`\n${'collection'.padEnd(14)}${'source read'.padEnd(14)}${'in directus'.padEnd(14)}match`)
  for (const s of summaries) {
    const items = await client.request(readItems(s.slug, { limit: -1, fields: ['id'] }))
    const totalDocs = items.length
    const match = totalDocs >= s.read - s.failed.length ? 'ok' : 'MISMATCH'
    console.log(`${s.slug.padEnd(14)}${String(s.read).padEnd(14)}${String(totalDocs).padEnd(14)}${match}`)
  }

  console.log(`\n${'-'.repeat(60)}`)
  console.log('SPOT CHECK: chronologie nested structure (highest-risk schema)')
  console.log('-'.repeat(60))
  const chronologieResult = await client.request(readItems('chronologie', { limit: 1 }))
  const doc = chronologieResult[0]
  if (!doc) {
    console.log('  no chronologie item migrated in this run -- nothing to spot-check')
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groups = (Array.isArray(doc.items) ? doc.items : []) as any[]
    const eventCount = groups.reduce((sum: number, g) => sum + (Array.isArray(g.events) ? g.events.length : 0), 0)
    console.log(`  doc: ${doc.slug} (${doc.title})`)
    console.log(`  groups: ${groups.length}, events: ${eventCount}`)
    const firstGroup = groups[0]
    const firstEvent = firstGroup?.events?.[0]
    console.log(`  first group: ${firstGroup?.event_group ?? '(none)'}`)
    console.log(`  first event: ${JSON.stringify(firstEvent, null, 2)}`)
  }
  console.log(`\n${'='.repeat(60)}\n`)
}

async function main() {
  const client = isLive ? getClient() : null
  if (isLive && client) await login(client)

  const summaries: CollectionSummary[] = []
  for (const job of jobs) {
    summaries.push(await migrateCollection(job, client))
  }

  printSummary(summaries)

  if (isLive && client) {
    await printVerification(client, summaries)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
