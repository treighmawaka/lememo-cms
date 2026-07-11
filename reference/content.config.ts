import { defineCollection, defineContentConfig, z } from '@nuxt/content'
import {
  CHRONOLOGY_CATEGORIES,
  CHRONOLOGY_IMPORTANCE_LEVELS,
  CHRONOLOGY_PRESIDENCIES,
} from './app/types/chronology'

const seoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  ogImage: z.string().optional(),
  noindex: z.boolean().optional().default(false),
})

const sourceSchema = z.object({
  label: z.string(),
  url: z.string().optional(),
})

const storyCategorySchema = z.object({
  region: z.enum(['RDC', 'Afrique', 'Monde']),
  category: z.string(),
  subcategory: z.string().optional(),
})

const memoItemSchema = z.object({
  ...storyCategorySchema.shape,
  title: z.string(),
  what: z.string(),
  teaser: z.string().optional(),
  why: z.string(),
  sources: z.array(sourceSchema).optional().default([]),
  signal: z.string().optional(),
  image: z.string().optional(),
  imageAlt: z.string().optional(),
  imageCredit: z.string().optional(),
})

const chronologyMediaImageSchema = z.object({
  src: z.string(),
  alt: z.string().optional(),
  credit: z.string().optional(),
})

const chronologyMediaVideoSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
})

const chronologyEventSchema = z.object({
  event: z.string(),
  note: z.string(),
  category: z.enum(CHRONOLOGY_CATEGORIES).optional(),
  presidency: z.enum(CHRONOLOGY_PRESIDENCIES).optional(),
  importance: z.enum(CHRONOLOGY_IMPORTANCE_LEVELS).optional(),
  show: z.boolean().default(true),
  location: z.string().optional(),
  tags: z.array(z.string()).default([]),
  media: z.object({
    images: z.array(chronologyMediaImageSchema).default([]),
    videos: z.array(chronologyMediaVideoSchema).default([]),
  }).optional(),
})

const chronologyGroupSchema = z.object({
  eventGroup: z.string(),
  items: z.array(chronologyEventSchema).default([]),
})

export default defineContentConfig({
  collections: {
    signal: defineCollection({
      type: 'page',
      source: 'signal/*.md',
      schema: z.object({
        title: z.string(),
        date: z.string(),
        status: z.enum(['published', 'draft']).default('published'),
        readingTime: z.number().optional(),
        summary: z.string(),
        image: z.string().optional(),
        imageAlt: z.string().optional(),
        imageCredit: z.string().optional(),
        items: z.array(memoItemSchema).default([]),
        seo: seoSchema.optional(),
      }),
    }),

    memo: defineCollection({
      type: 'page',
      source: 'memo/*.md',
      schema: z.object({
        title: z.string(),
        date: z.string(),
        status: z.enum(['published', 'draft']).default('published'),
        readingTime: z.number().optional(),
        summary: z.string(),
        items: z.array(memoItemSchema).default([]),
        featuredVideoSlug: z.string().optional(),
        seo: seoSchema.optional(),
      }),
    }),

    focus: defineCollection({
      type: 'page',
      source: 'focus/*.md',
      schema: z.object({
        title: z.string(),
        description: z.string(),
        teaser: z.string().optional(),
        date: z.string(),
        status: z.enum(['published', 'draft']).default('published'),
        ...storyCategorySchema.shape,
        readingTime: z.number().optional(),
        image: z.string().optional(),
        imageAlt: z.string().optional(),
        imageCredit: z.string().optional(),
        video: z.object({
          youtubeId: z.string(),
          title: z.string().optional(),
        }).optional(),
        visuel: z.string().optional(),
        author: z.string().optional(),
        hideDescription: z.boolean().optional().default(false),
        hideAuthorByline: z.boolean().optional().default(false),
        specialPublication: z.boolean().optional().default(false),
        authorBio: z.string().optional(),
        authorThumbnail: z.string().optional(),
        authorUrl: z.string().optional(),
        seo: seoSchema.optional(),
        updates: z.array(z.object({
          date: z.string(),
          note: z.string(),
        })).optional(),
      }),
    }),

    video: defineCollection({
      type: 'page',
      source: 'video/*.md',
      schema: z.object({
        title: z.string(),
        description: z.string(),
        date: z.string(),
        duration: z.string().optional(),
        thumbnail: z.string().optional(),
        platform: z.enum(['youtube', 'vimeo', 'other']).default('youtube'),
        videoUrl: z.string(),
        seo: seoSchema.optional(),
      }),
    }),

    visuels: defineCollection({
      type: 'page',
      source: 'visuels/*.md',
      schema: z.object({
        title: z.string(),
        description: z.string(),
        date: z.string(),
        image: z.string().optional(),
        imageAlt: z.string().optional(),
        items: z.array(z.object({
          image: z.string(),
          imageAlt: z.string().optional(),
        })).default([]),
        relatedLink: z.string().optional(),
        relatedLinkTitle: z.string().optional(),
        seo: seoSchema.optional(),
      }),
    }),

    chronologie: defineCollection({
      type: 'page',
      source: 'chronologie/*.md',
      schema: z.object({
        title: z.string(),
        description: z.string(),
        image: z.string().optional(),
        imageAlt: z.string().optional(),
        imageCredit: z.string().optional(),
        type: z.string().optional(),
        country: z.string().optional(),
        startYear: z.number().int().optional(),
        endYear: z.number().int().optional(),
        featured: z.boolean().optional().default(false),
        // Studio hydrates nested array fields more reliably when the item shape
        // is stable, and the chronology content here is group-based only.
        items: z.array(chronologyGroupSchema).default([]),
        seo: seoSchema.optional(),
      }),
    }),

    pages: defineCollection({
      type: 'page',
      source: 'pages/*.md',
      schema: z.object({
        title: z.string(),
        description: z.string().optional(),
        lastUpdated: z.string().optional(),
        seo: seoSchema.optional(),
      }),
    }),
  },
})
