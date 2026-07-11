import fs from 'node:fs'
import path from 'node:path'

import { readItems } from '@directus/sdk'
import matter from 'gray-matter'

export interface ParsedMarkdownFile {
  slug: string
  data: Record<string, unknown>
  body: string
}

export function slugFromFilename(filePath: string): string {
  return path.basename(filePath, path.extname(filePath))
}

export function readMarkdownFile(filePath: string): ParsedMarkdownFile {
  const raw = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(raw)
  return { slug: slugFromFilename(filePath), data, body: content.trim() }
}

export function listMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => path.join(dir, name))
    .sort()
}

// YAML auto-parses unquoted date-like scalars (e.g. `date: 2026-05-10`) into
// native Date objects, but quoted ones (e.g. `date: "2026-07-06"`) stay strings.
// The source content mixes both styles across collections, so normalize either
// shape into the ISO string Directus's date field expects.
export function normalizeDate(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  if (typeof value === 'number') return new Date(value).toISOString()
  throw new Error(`Unexpected date value: ${JSON.stringify(value)}`)
}

// The chronologie sample has `endYear: "2026"` (a quoted string) even though
// content.config.ts declares it as z.number(). Coerce rather than fail.
export function coerceNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) throw new Error(`Expected a number, got: ${JSON.stringify(value)}`)
  return num
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

// Resolves a cross-collection reference (e.g. focus.visuel -> visuels.slug) to
// the migrated item's Directus UUID. Returns undefined (with a warning) rather
// than failing the whole record when the target hasn't been migrated in this
// run yet -- expected while only a sample of files per collection has run.
export async function resolveRelation(
  client: AnyClient,
  collection: string,
  slug: string | undefined,
  warnings: string[],
): Promise<string | undefined> {
  if (!slug) return undefined
  if (!client) {
    warnings.push(`Skipped resolving ${collection} reference "${slug}" (dry run, no client)`)
    return undefined
  }
  const result = await client.request(
    readItems(collection, { filter: { slug: { _eq: slug } }, limit: 1, fields: ['id'] }),
  )
  const doc = result[0]
  if (!doc) {
    warnings.push(`Could not resolve ${collection} reference "${slug}" (not migrated in this run)`)
    return undefined
  }
  return doc.id as string
}

// Extracts a slug from a Nuxt-style content path like "/focus/some-slug" or
// "agriculture-industrielle-africaine" (already a bare slug).
export function slugFromContentPath(value: string | undefined): string | undefined {
  if (!value) return undefined
  const parts = value.split('/').filter(Boolean)
  return parts[parts.length - 1]
}

const CDN_ORIGIN = 'https://cdn.lememo.news'

// Image fields are plain CDN URL strings on this schema too. Source values
// are root-relative paths ("/images/stories/x.jpg") or, rarely, already-
// absolute cdn.lememo.news URLs -- normalize the former, leave the latter
// untouched. Anything else is flagged rather than guessed.
export function normalizeCdnUrl(value: unknown, fieldPath: string, warnings: string[]): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') {
    warnings.push(`SHAPE ${fieldPath}: expected a string image path, got ${typeof value}`)
    return undefined
  }
  if (/^https?:\/\//.test(value)) return value
  if (value.startsWith('/')) return `${CDN_ORIGIN}${value}`
  if (value.startsWith('//')) {
    warnings.push(`SHAPE ${fieldPath}: protocol-relative path "${value}" left as-is, verify`)
    return value
  }
  warnings.push(
    `SHAPE ${fieldPath}: path "${value}" is missing a leading "/" -- left as bare relative path, not prefixed with CDN origin, verify`,
  )
  return value
}
