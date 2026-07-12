import { authentication, createDirectus, rest } from '@directus/sdk'

export function getClient() {
  const url = process.env.PUBLIC_URL || 'http://localhost:8055'
  return createDirectus(url).with(authentication('json')).with(rest())
}

export async function login(client: ReturnType<typeof getClient>) {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) throw new Error('ADMIN_EMAIL / ADMIN_PASSWORD not set in .env')
  await client.login({ email, password })
}

export interface FieldDef {
  field: string
  type: string
  meta?: Record<string, unknown>
  schema?: Record<string, unknown>
}

export interface CollectionDef {
  collection: string
  icon: string
  note: string
  fields: FieldDef[]
}

// Standard Directus system-tracking fields, replaces Payload's custom createdBy field.
export function trackingFields(): FieldDef[] {
  return [
    {
      field: 'user_created',
      type: 'uuid',
      meta: {
        special: ['user-created'],
        interface: 'select-dropdown-m2o',
        options: { template: '{{avatar}} {{first_name}} {{last_name}}' },
        display: 'user',
        readonly: true,
        hidden: true,
        width: 'half',
      },
    },
    {
      field: 'date_created',
      type: 'timestamp',
      meta: { special: ['date-created'], interface: 'datetime', readonly: true, hidden: true, width: 'half' },
    },
    {
      field: 'user_updated',
      type: 'uuid',
      meta: {
        special: ['user-updated'],
        interface: 'select-dropdown-m2o',
        options: { template: '{{avatar}} {{first_name}} {{last_name}}' },
        display: 'user',
        readonly: true,
        hidden: true,
        width: 'half',
      },
    },
    {
      field: 'date_updated',
      type: 'timestamp',
      meta: { special: ['date-updated'], interface: 'datetime', readonly: true, hidden: true, width: 'half' },
    },
  ]
}

// Manual drag-and-drop ordering. Also needs the owning collection's
// meta.sort_field set to 'sort' for the browse view to enable reordering.
export function sortField(): FieldDef {
  return { field: 'sort', type: 'integer', meta: { interface: 'input', hidden: true } }
}

export function primaryKeyField(): FieldDef {
  return {
    field: 'id',
    type: 'uuid',
    meta: { hidden: true, readonly: true, interface: 'input', special: ['uuid'] },
    schema: { is_primary_key: true, length: 36, has_auto_increment: false },
  }
}

export function textField(field: string, opts: { required?: boolean; note?: string } = {}): FieldDef {
  return {
    field,
    type: 'string',
    meta: { interface: 'input', required: opts.required ?? false, note: opts.note },
    schema: { is_nullable: !opts.required },
  }
}

export function textareaField(field: string, opts: { required?: boolean } = {}): FieldDef {
  return {
    field,
    type: 'text',
    meta: { interface: 'input-multiline', required: opts.required ?? false },
    schema: { is_nullable: !opts.required },
  }
}

// Raw markdown text, stored as-is -- no markdown<->JSON conversion needed unlike Payload's Lexical richText.
export function markdownField(field: string): FieldDef {
  return { field, type: 'text', meta: { interface: 'input-rich-text-md' } }
}

export function dateField(field: string, opts: { required?: boolean; time?: boolean } = {}): FieldDef {
  return {
    field,
    type: opts.time ? 'timestamp' : 'date',
    meta: { interface: 'datetime', required: opts.required ?? false },
    schema: { is_nullable: !opts.required },
  }
}

export function numberField(field: string): FieldDef {
  return { field, type: 'integer', meta: { interface: 'input' } }
}

export function booleanField(field: string, defaultValue = false): FieldDef {
  return { field, type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: defaultValue } }
}

export function selectField(field: string, choices: readonly string[], opts: { required?: boolean } = {}): FieldDef {
  return {
    field,
    type: 'string',
    meta: {
      interface: 'select-dropdown',
      options: { choices: choices.map((c) => ({ text: c, value: c })) },
      required: opts.required ?? false,
    },
    schema: { is_nullable: !opts.required },
  }
}

// Array of plain strings (e.g. chronologie event tags) -- Directus's native tags interface.
export function tagsField(field: string): FieldDef {
  return { field, type: 'json', meta: { interface: 'tags' } }
}

export function slugField(): FieldDef {
  return {
    field: 'slug',
    type: 'string',
    meta: { interface: 'input', required: true, note: 'Stable natural key from the original filename' },
    schema: { is_unique: true, is_nullable: false },
  }
}

export function statusField(choices: readonly string[] = ['draft', 'review', 'published']): FieldDef {
  return {
    field: 'status',
    type: 'string',
    meta: {
      interface: 'select-dropdown',
      options: { choices: choices.map((c) => ({ text: c, value: c })) },
      display: 'labels',
      width: 'half',
    },
    schema: { default_value: 'draft', is_nullable: false },
  }
}

export function seoFields(): FieldDef[] {
  return [
    { field: 'seo', type: 'alias', meta: { interface: 'group-detail', special: ['alias', 'no-data'], options: { title: 'SEO' } } },
    { field: 'seo_title', type: 'string', meta: { interface: 'input', group: 'seo' } },
    { field: 'seo_description', type: 'text', meta: { interface: 'input-multiline', group: 'seo' } },
    { field: 'seo_og_image', type: 'string', meta: { interface: 'input', group: 'seo', note: 'CDN URL' } },
    { field: 'seo_noindex', type: 'boolean', meta: { interface: 'boolean', group: 'seo' }, schema: { default_value: false } },
  ]
}

// JSON column edited via Directus's built-in repeater ("list") interface. Sub-fields
// can themselves be repeaterField() output for nested arrays (e.g. chronologie groups->events).
export function repeaterField(field: string, note: string, subFields: FieldDef[]): FieldDef {
  return {
    field,
    type: 'json',
    meta: {
      interface: 'list',
      options: {
        fields: subFields.map((f) => ({
          field: f.field,
          name: f.field,
          type: f.type,
          meta: { interface: f.meta?.interface ?? 'input', options: f.meta?.options },
        })),
      },
      note,
    },
  }
}

export function m2oField(field: string, note?: string): FieldDef {
  return { field, type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'], note } }
}

// File-picker field pointing at directus_files (the R2-backed media library),
// with an image-specific preview interface.
export function fileField(field: string, note?: string): FieldDef {
  return { field, type: 'uuid', meta: { interface: 'file-image', special: ['file'], note } }
}
