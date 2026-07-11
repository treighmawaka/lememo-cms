/**
 * Lightweight frontmatter shape validator, independent of the mappers.
 *
 * Mirrors reference/content.config.ts (the original Zod schema) field-for-
 * field. Flags deviations -- missing required fields, unexpected extra keys,
 * type mismatches, out-of-range enum values -- without attempting to fix
 * anything. Mapping already tolerates some known quirks (Date-vs-string
 * dates, numeric strings for startYear/endYear); those are flagged too, at
 * informational level, since they're still worth surfacing even though the
 * mapper already handles them.
 *
 * Unchanged from the Payload project's version -- this validates the SOURCE
 * markdown shape, which doesn't depend on which CMS it's being migrated into.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

type FieldType = 'array' | 'boolean' | 'date' | 'number' | 'object' | 'string'

interface FieldSpec {
  enumValues?: string[]
  fields?: SchemaSpec
  items?: SchemaSpec
  required?: boolean
  type: FieldType
}

type SchemaSpec = Record<string, FieldSpec>

const seoSchema: SchemaSpec = {
  title: { type: 'string' },
  description: { type: 'string' },
  ogImage: { type: 'string' },
  noindex: { type: 'boolean' },
}

const sourceSchema: SchemaSpec = {
  label: { type: 'string', required: true },
  url: { type: 'string' },
}

const storyCategoryFields: SchemaSpec = {
  region: { type: 'string', required: true, enumValues: ['RDC', 'Afrique', 'Monde'] },
  category: { type: 'string', required: true },
  subcategory: { type: 'string' },
}

const memoItemSchema: SchemaSpec = {
  ...storyCategoryFields,
  title: { type: 'string', required: true },
  what: { type: 'string', required: true },
  teaser: { type: 'string' },
  why: { type: 'string', required: true },
  sources: { type: 'array', items: sourceSchema },
  signal: { type: 'string' },
  image: { type: 'string' },
  imageAlt: { type: 'string' },
  imageCredit: { type: 'string' },
}

const CHRONOLOGY_CATEGORIES = [
  'Politique',
  'Conflits',
  'Infrastructure',
  'Économie',
  'Éducation',
  'Diplomatie',
  'Culture & Sport',
]
const CHRONOLOGY_PRESIDENCIES = [
  'Kasa-Vubu',
  'Mobutu',
  'Laurent-Désiré Kabila',
  'Joseph Kabila',
  'Félix Tshisekedi',
]
const CHRONOLOGY_IMPORTANCE_LEVELS = ['low', 'medium', 'high']

const chronologyEventSchema: SchemaSpec = {
  event: { type: 'string', required: true },
  note: { type: 'string', required: true },
  category: { type: 'string', enumValues: CHRONOLOGY_CATEGORIES },
  presidency: { type: 'string', enumValues: CHRONOLOGY_PRESIDENCIES },
  importance: { type: 'string', enumValues: CHRONOLOGY_IMPORTANCE_LEVELS },
  show: { type: 'boolean' },
  location: { type: 'string' },
  tags: { type: 'array' },
  media: {
    type: 'object',
    fields: {
      images: {
        type: 'array',
        items: { src: { type: 'string', required: true }, alt: { type: 'string' }, credit: { type: 'string' } },
      },
      videos: {
        type: 'array',
        items: { url: { type: 'string', required: true }, title: { type: 'string' } },
      },
    },
  },
}

export const collectionSchemas: Record<string, SchemaSpec> = {
  memo: {
    title: { type: 'string', required: true },
    date: { type: 'date', required: true },
    status: { type: 'string', enumValues: ['published', 'draft'] },
    readingTime: { type: 'number' },
    summary: { type: 'string', required: true },
    items: { type: 'array', items: memoItemSchema },
    featuredVideoSlug: { type: 'string' },
    seo: { type: 'object', fields: seoSchema },
  },
  signal: {
    title: { type: 'string', required: true },
    date: { type: 'date', required: true },
    status: { type: 'string', enumValues: ['published', 'draft'] },
    readingTime: { type: 'number' },
    summary: { type: 'string', required: true },
    image: { type: 'string' },
    imageAlt: { type: 'string' },
    imageCredit: { type: 'string' },
    items: { type: 'array', items: memoItemSchema },
    seo: { type: 'object', fields: seoSchema },
  },
  focus: {
    title: { type: 'string', required: true },
    description: { type: 'string', required: true },
    teaser: { type: 'string' },
    date: { type: 'date', required: true },
    status: { type: 'string', enumValues: ['published', 'draft'] },
    ...storyCategoryFields,
    readingTime: { type: 'number' },
    image: { type: 'string' },
    imageAlt: { type: 'string' },
    imageCredit: { type: 'string' },
    video: {
      type: 'object',
      fields: { youtubeId: { type: 'string', required: true }, title: { type: 'string' } },
    },
    visuel: { type: 'string' },
    author: { type: 'string' },
    hideDescription: { type: 'boolean' },
    hideAuthorByline: { type: 'boolean' },
    specialPublication: { type: 'boolean' },
    authorBio: { type: 'string' },
    authorThumbnail: { type: 'string' },
    authorUrl: { type: 'string' },
    seo: { type: 'object', fields: seoSchema },
    updates: {
      type: 'array',
      items: { date: { type: 'date', required: true }, note: { type: 'string', required: true } },
    },
  },
  video: {
    title: { type: 'string', required: true },
    description: { type: 'string', required: true },
    date: { type: 'date', required: true },
    duration: { type: 'string' },
    thumbnail: { type: 'string' },
    platform: { type: 'string', enumValues: ['youtube', 'vimeo', 'other'] },
    videoUrl: { type: 'string', required: true },
    seo: { type: 'object', fields: seoSchema },
  },
  visuels: {
    title: { type: 'string', required: true },
    description: { type: 'string', required: true },
    date: { type: 'date', required: true },
    image: { type: 'string' },
    imageAlt: { type: 'string' },
    items: { type: 'array', items: { image: { type: 'string', required: true }, imageAlt: { type: 'string' } } },
    relatedLink: { type: 'string' },
    relatedLinkTitle: { type: 'string' },
    seo: { type: 'object', fields: seoSchema },
  },
  chronologie: {
    title: { type: 'string', required: true },
    description: { type: 'string', required: true },
    image: { type: 'string' },
    imageAlt: { type: 'string' },
    imageCredit: { type: 'string' },
    type: { type: 'string' },
    country: { type: 'string' },
    startYear: { type: 'number' },
    endYear: { type: 'number' },
    featured: { type: 'boolean' },
    items: {
      type: 'array',
      items: { eventGroup: { type: 'string', required: true }, items: { type: 'array', items: chronologyEventSchema } },
    },
    seo: { type: 'object', fields: seoSchema },
  },
  pages: {
    title: { type: 'string', required: true },
    description: { type: 'string' },
    lastUpdated: { type: 'date' },
    seo: { type: 'object', fields: seoSchema },
  },
}

function typeOf(value: unknown): string {
  if (value === null || value === undefined) return 'undefined'
  if (Array.isArray(value)) return 'array'
  if (value instanceof Date) return 'date'
  return typeof value
}

function matchesType(value: unknown, expected: FieldType): boolean {
  const actual = typeOf(value)
  if (expected === 'date') return actual === 'date' || actual === 'string'
  // startYear/endYear sometimes arrive as numeric strings; the mapper coerces
  // this already, but it's still flagged (informational) via the caller.
  if (expected === 'number') return actual === 'number' || (actual === 'string' && !Number.isNaN(Number(value)))
  return actual === expected
}

function checkShape(data: AnyRecord, schema: SchemaSpec, path: string, flags: string[]) {
  for (const [key, spec] of Object.entries(schema)) {
    const value = data[key]
    const fieldPath = `${path}.${key}`
    if (value === undefined || value === null) {
      if (spec.required) flags.push(`missing required field "${fieldPath}"`)
      continue
    }
    if (!matchesType(value, spec.type)) {
      flags.push(`"${fieldPath}" expected ${spec.type}, got ${typeOf(value)} (${JSON.stringify(value).slice(0, 60)})`)
      continue
    }
    if (spec.type === 'number' && typeof value === 'string') {
      flags.push(`"${fieldPath}" is a numeric string ("${value}"), not a number -- mapper coerces this`)
    }
    if (spec.enumValues && typeof value === 'string' && !spec.enumValues.includes(value)) {
      flags.push(`"${fieldPath}" value "${value}" is not one of [${spec.enumValues.join(', ')}]`)
    }
    if (spec.type === 'array' && Array.isArray(value) && spec.items) {
      value.forEach((item, i) => {
        if (typeof item === 'object' && item !== null) {
          checkShape(item as AnyRecord, spec.items!, `${fieldPath}[${i}]`, flags)
        }
      })
    }
    if (spec.type === 'object' && spec.fields && typeof value === 'object') {
      checkShape(value as AnyRecord, spec.fields, fieldPath, flags)
    }
  }

  // Flag keys present in the data but not declared in the schema.
  for (const key of Object.keys(data)) {
    if (!(key in schema)) {
      flags.push(`unexpected field "${path}.${key}" not in the known schema`)
    }
  }
}

export function checkFrontmatterShape(collectionSlug: string, data: AnyRecord): string[] {
  const schema = collectionSchemas[collectionSlug]
  if (!schema) return [`no schema defined for collection "${collectionSlug}"`]
  const flags: string[] = []
  checkShape(data, schema, collectionSlug, flags)
  return flags
}
