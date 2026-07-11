import { coerceNumber, normalizeCdnUrl, normalizeDate, resolveRelation, slugFromContentPath } from './lib'
import type { ParsedMarkdownFile } from './lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

interface MapContext {
  // Only present in --live mode; relationship resolution is skipped (with a
  // warning) when null, since it requires querying a real Directus instance.
  client: AnyClient
  warnings: string[]
}

// Historical content was already live on the old site, so it maps to
// "published" by default (matches the old schema's own default status).
const DEFAULT_STATUS = 'published'

function mapSource(source: AnyRecord) {
  return { label: source.label, url: source.url }
}

function mapStoryCategory(item: AnyRecord) {
  return {
    region: item.region,
    category: item.category,
    subcategory: item.subcategory,
  }
}

// Directus has no nested-group field type -- the seo group is flattened to
// seo_title/seo_description/seo_og_image/seo_noindex, grouped only in the UI.
function mapSeo(seo: AnyRecord | undefined, fieldPath: string, warnings: string[]) {
  if (!seo) return {}
  return {
    seo_title: seo.title,
    seo_description: seo.description,
    seo_og_image: normalizeCdnUrl(seo.ogImage, `${fieldPath}.seo.ogImage`, warnings),
    seo_noindex: seo.noindex,
  }
}

// Shared by memo and signal.
function mapMemoItem(item: AnyRecord, index: number, fieldPath: string, warnings: string[]) {
  const itemPath = `${fieldPath}.items[${index}]`
  return {
    ...mapStoryCategory(item),
    title: item.title,
    what: item.what,
    teaser: item.teaser,
    why: item.why,
    sources: Array.isArray(item.sources) ? item.sources.map(mapSource) : [],
    signal: item.signal,
    image: normalizeCdnUrl(item.image, `${itemPath}.image`, warnings),
    image_alt: item.imageAlt,
    image_credit: item.imageCredit,
  }
}

export async function mapMemo({ client, warnings }: MapContext, file: ParsedMarkdownFile) {
  const { slug, data } = file
  const featuredVideo = await resolveRelation(client, 'video', data.featuredVideoSlug as string | undefined, warnings)
  return {
    slug,
    title: data.title,
    date: normalizeDate(data.date),
    status: DEFAULT_STATUS,
    reading_time: data.readingTime,
    summary: data.summary,
    items: Array.isArray(data.items)
      ? data.items.map((item: AnyRecord, i: number) => mapMemoItem(item, i, slug, warnings))
      : [],
    featured_video: featuredVideo,
    ...mapSeo(data.seo as AnyRecord | undefined, slug, warnings),
  }
}

export async function mapSignal({ warnings }: MapContext, file: ParsedMarkdownFile) {
  const { slug, data } = file
  return {
    slug,
    title: data.title,
    date: normalizeDate(data.date),
    status: DEFAULT_STATUS,
    reading_time: data.readingTime,
    summary: data.summary,
    image: normalizeCdnUrl(data.image, `${slug}.image`, warnings),
    image_alt: data.imageAlt,
    image_credit: data.imageCredit,
    items: Array.isArray(data.items)
      ? data.items.map((item: AnyRecord, i: number) => mapMemoItem(item, i, slug, warnings))
      : [],
    ...mapSeo(data.seo as AnyRecord | undefined, slug, warnings),
  }
}

export async function mapFocus({ client, warnings }: MapContext, file: ParsedMarkdownFile) {
  const { slug, data, body } = file
  const visuelSlug = slugFromContentPath(data.visuel as string | undefined)
  const visuel = await resolveRelation(client, 'visuels', visuelSlug, warnings)
  const video = data.video as AnyRecord | undefined
  return {
    slug,
    title: data.title,
    description: data.description,
    teaser: data.teaser,
    date: normalizeDate(data.date),
    status: DEFAULT_STATUS,
    region: data.region,
    category: data.category,
    subcategory: data.subcategory,
    reading_time: data.readingTime,
    image: normalizeCdnUrl(data.image, `${slug}.image`, warnings),
    image_alt: data.imageAlt,
    image_credit: data.imageCredit,
    // Raw markdown, stored as-is -- Directus's markdown field needs no
    // conversion, unlike Payload's Lexical richText.
    body: body || undefined,
    video_youtube_id: video?.youtubeId,
    video_title: video?.title,
    visuel,
    author: data.author,
    hide_description: data.hideDescription ?? false,
    hide_author_byline: data.hideAuthorByline ?? false,
    special_publication: data.specialPublication ?? false,
    author_bio: data.authorBio,
    author_thumbnail: normalizeCdnUrl(data.authorThumbnail, `${slug}.authorThumbnail`, warnings),
    author_url: data.authorUrl,
    updates: Array.isArray(data.updates)
      ? data.updates.map((u: AnyRecord) => ({ date: normalizeDate(u.date), note: u.note }))
      : undefined,
    ...mapSeo(data.seo as AnyRecord | undefined, slug, warnings),
  }
}

export async function mapVideo({ warnings }: MapContext, file: ParsedMarkdownFile) {
  const { slug, data } = file
  return {
    slug,
    title: data.title,
    description: data.description,
    date: normalizeDate(data.date),
    status: DEFAULT_STATUS,
    duration: data.duration,
    thumbnail: normalizeCdnUrl(data.thumbnail, `${slug}.thumbnail`, warnings),
    platform: data.platform ?? 'youtube',
    video_url: data.videoUrl,
    ...mapSeo(data.seo as AnyRecord | undefined, slug, warnings),
  }
}

export async function mapVisuels({ client, warnings }: MapContext, file: ParsedMarkdownFile) {
  const { slug, data } = file
  const relatedSlug = slugFromContentPath(data.relatedLink as string | undefined)
  const relatedLink = await resolveRelation(client, 'focus', relatedSlug, warnings)
  return {
    slug,
    title: data.title,
    description: data.description,
    date: normalizeDate(data.date),
    status: DEFAULT_STATUS,
    image: normalizeCdnUrl(data.image, `${slug}.image`, warnings),
    image_alt: data.imageAlt,
    items: Array.isArray(data.items)
      ? data.items.map((item: AnyRecord, i: number) => ({
          image: normalizeCdnUrl(item.image, `${slug}.items[${i}].image`, warnings),
          image_alt: item.imageAlt,
        }))
      : [],
    related_link: relatedLink,
    related_link_title: data.relatedLinkTitle,
    ...mapSeo(data.seo as AnyRecord | undefined, slug, warnings),
  }
}

export async function mapPages({ warnings }: MapContext, file: ParsedMarkdownFile) {
  const { slug, data, body } = file
  return {
    slug,
    title: data.title,
    description: data.description,
    last_updated: normalizeDate(data.lastUpdated),
    status: DEFAULT_STATUS,
    body: body || undefined,
    ...mapSeo(data.seo as AnyRecord | undefined, slug, warnings),
  }
}

function mapChronologyEvent(event: AnyRecord, eventPath: string, warnings: string[]) {
  return {
    event: event.event,
    note: event.note,
    category: event.category,
    presidency: event.presidency,
    importance: event.importance,
    show: event.show ?? true,
    location: event.location,
    tags: Array.isArray(event.tags) ? event.tags.filter((t: string) => t.trim().length > 0) : [],
    // Directus schema flattens media.images/media.videos to top-level
    // images/videos on the event object (no "media" wrapper field).
    images: Array.isArray(event.media?.images)
      ? event.media.images.map((img: AnyRecord, i: number) => ({
          src: normalizeCdnUrl(img.src, `${eventPath}.media.images[${i}].src`, warnings),
          alt: img.alt,
          credit: img.credit,
        }))
      : [],
    videos: Array.isArray(event.media?.videos)
      ? event.media.videos.map((v: AnyRecord) => ({ url: v.url, title: v.title }))
      : [],
  }
}

export async function mapChronologie({ warnings }: MapContext, file: ParsedMarkdownFile) {
  const { slug, data } = file
  return {
    slug,
    title: data.title,
    description: data.description,
    status: DEFAULT_STATUS,
    image: normalizeCdnUrl(data.image, `${slug}.image`, warnings),
    image_alt: data.imageAlt,
    image_credit: data.imageCredit,
    type: data.type,
    country: data.country,
    start_year: coerceNumber(data.startYear),
    end_year: coerceNumber(data.endYear),
    featured: data.featured ?? false,
    items: Array.isArray(data.items)
      ? data.items.map((group: AnyRecord, gi: number) => ({
          event_group: group.eventGroup,
          // Source field is also named "items"; renamed to "events" in the
          // Directus schema for consistency with the Payload port.
          events: Array.isArray(group.items)
            ? group.items.map((event: AnyRecord, ei: number) =>
                mapChronologyEvent(event, `${slug}.items[${gi}].items[${ei}]`, warnings),
              )
            : [],
        }))
      : [],
    ...mapSeo(data.seo as AnyRecord | undefined, slug, warnings),
  }
}
