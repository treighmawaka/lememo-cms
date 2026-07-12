/**
 * Standalone script -- not part of the Directus runtime.
 *
 * Reconciles Directus's directus_files + directus_folders with what's
 * actually in the R2 bucket (the single source of truth). Additive only:
 * creates missing folders and file records for objects that already exist in
 * R2 but aren't yet registered in Directus. Never deletes or modifies
 * anything, never re-uploads -- registers metadata pointing at the existing
 * storage key.
 *
 * Directus's normal upload path (multipart POST to /files) always renames
 * the object to <uuid>.<ext> server-side (see FilesService.uploadOne), which
 * would be wrong for objects that already exist under their real path. A
 * plain JSON (non-multipart) POST to /files skips that -- the controller
 * calls FilesService.createOne() directly, a plain metadata insert with no
 * storage write -- confirmed by reading the installed @directus/api source.
 * The SDK has no typed helper for that path (createFile only wraps the
 * multipart upload), so this uses a raw fetch with the SDK's access token.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm exec tsx scripts/media-sync.ts          # dry run: report only
 *   set -a && source .env && set +a && pnpm exec tsx scripts/media-sync.ts --live   # create missing folders/files
 *
 * Idempotent: re-running skips folders/files that already have a matching
 * Directus record, so it's safe to run again after adding files directly in R2.
 */
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { createFolder, readFiles, readFolders } from '@directus/sdk'

import { getClient, login } from '../schema/lib'

function formatTitle(name: string): string {
  return name
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ')
}

const isLive = process.argv.includes('--live')

const MIME_TYPES: Record<string, string> = {
  gif: 'image/gif',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  mp4: 'video/mp4',
  pdf: 'application/pdf',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
}

interface BucketObject {
  key: string
  size: number
}

async function listAllObjects(s3: S3Client, bucket: string): Promise<BucketObject[]> {
  const objects: BucketObject[] = []
  let continuationToken: string | undefined
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken }))
    for (const obj of res.Contents ?? []) {
      if (obj.Key) objects.push({ key: obj.Key, size: obj.Size ?? 0 })
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)
  return objects
}

function splitKey(key: string): { filename: string; prefix: string } {
  const lastSlash = key.lastIndexOf('/')
  if (lastSlash === -1) return { filename: key, prefix: '' }
  return { filename: key.slice(lastSlash + 1), prefix: key.slice(0, lastSlash) }
}

function collectAncestorPaths(path: string, into: Set<string>) {
  const segments = path.split('/')
  let built = ''
  for (const segment of segments) {
    built = built ? `${built}/${segment}` : segment
    into.add(built)
  }
}

interface FolderStats {
  created: number
  skipped: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

// Ensures every segment of `path` has a matching directus_folders record,
// creating missing ones in --live mode (or a synthetic id in dry-run, so
// deeper segments still resolve consistently for reporting purposes).
async function ensureFolderPath(
  client: AnyClient,
  path: string,
  cache: Map<string, string>,
  stats: FolderStats,
): Promise<string | undefined> {
  if (!path) return undefined
  if (cache.has(path)) return cache.get(path)

  const segments = path.split('/')
  let parentId: string | undefined
  let builtPath = ''

  for (const segment of segments) {
    builtPath = builtPath ? `${builtPath}/${segment}` : segment
    if (cache.has(builtPath)) {
      parentId = cache.get(builtPath)
      continue
    }

    const isRealParent = !parentId?.startsWith('dry:')
    const realParentId = isRealParent ? parentId : undefined

    const existing = await client.request(
      readFolders({
        filter: { _and: [{ name: { _eq: segment } }, realParentId ? { parent: { _eq: realParentId } } : { parent: { _null: true } }] },
        limit: 1,
      }),
    )

    let folderId: string | undefined = existing[0]?.id
    if (folderId) {
      stats.skipped++
    } else if (isLive) {
      const created = await client.request(createFolder({ name: segment, parent: realParentId ?? null }))
      folderId = created.id
      stats.created++
    } else {
      folderId = `dry:${builtPath}`
      stats.created++
    }

    cache.set(builtPath, folderId)
    parentId = folderId
  }

  return parentId
}

// The SDK has no JSON-only file-create command (uploadFiles only wraps
// multipart), so this posts directly with the client's own access token.
async function createFileRecord(
  client: AnyClient,
  baseUrl: string,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const token = await client.getToken()
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.text()
    return { ok: false, error: `${res.status}: ${body}` }
  }
  return { ok: true }
}

async function main() {
  const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.STORAGE_R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.STORAGE_R2_KEY ?? '',
      secretAccessKey: process.env.STORAGE_R2_SECRET ?? '',
    },
    forcePathStyle: true,
  })
  const bucket = process.env.STORAGE_R2_BUCKET ?? ''
  const baseUrl = process.env.PUBLIC_URL || 'http://localhost:8055'

  const client = getClient()
  await login(client)

  const objects = await listAllObjects(s3, bucket)
  const files = objects.filter((o) => !o.key.endsWith('/'))
  const markers = objects.filter((o) => o.key.endsWith('/'))

  const folderPaths = new Set<string>()
  for (const file of files) {
    const { prefix } = splitKey(file.key)
    if (prefix) collectAncestorPaths(prefix, folderPaths)
  }
  for (const marker of markers) {
    const trimmed = marker.key.replace(/\/$/, '')
    if (trimmed) collectAncestorPaths(trimmed, folderPaths)
  }

  console.log(`Bucket: ${files.length} files, ${markers.length} folder markers, ${folderPaths.size} distinct folder paths`)

  const folderCache = new Map<string, string>()
  const folderStats: FolderStats = { created: 0, skipped: 0 }
  for (const path of [...folderPaths].sort((a, b) => a.split('/').length - b.split('/').length)) {
    await ensureFolderPath(client, path, folderCache, folderStats)
  }

  let fileCreated = 0
  let fileSkipped = 0
  const failed: { key: string; reason: string }[] = []

  for (const file of files) {
    const { filename, prefix } = splitKey(file.key)
    const existing = await client.request(readFiles({ filter: { filename_disk: { _eq: file.key } }, limit: 1, fields: ['id'] }))
    if (existing.length > 0) {
      fileSkipped++
      continue
    }
    if (!isLive) {
      fileCreated++
      continue
    }

    try {
      const ext = filename.split('.').pop()?.toLowerCase() ?? ''
      const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream'
      const folderId = prefix ? folderCache.get(prefix) : undefined

      const result = await createFileRecord(client, baseUrl, {
        storage: 'r2',
        filename_disk: file.key,
        filename_download: filename,
        title: formatTitle(filename.replace(/\.[^.]+$/, '')),
        type: mimeType,
        filesize: file.size,
        folder: typeof folderId === 'string' ? folderId : undefined,
      })
      if (result.ok) {
        fileCreated++
      } else {
        failed.push({ key: file.key, reason: result.error ?? 'unknown error' })
      }
    } catch (err) {
      failed.push({ key: file.key, reason: err instanceof Error ? err.message : String(err) })
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(isLive ? 'MEDIA SYNC (live)' : 'MEDIA SYNC (dry run -- nothing written)')
  console.log('='.repeat(60))
  console.log(`folders: ${folderStats.created} ${isLive ? 'created' : 'would create'}, ${folderStats.skipped} already existed`)
  console.log(`files:   ${fileCreated} ${isLive ? 'created' : 'would create'}, ${fileSkipped} already existed`)
  console.log(`failed:  ${failed.length}`)
  for (const f of failed) console.log(`  - ${f.key}: ${f.reason}`)
  console.log('='.repeat(60))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
