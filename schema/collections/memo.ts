import type { CollectionDef, FieldDef } from '../lib'
import { dateField, numberField, repeaterField, seoFields, slugField, sortField, statusField, textField, textareaField, trackingFields } from '../lib'

const STORY_REGIONS = ['RDC', 'Afrique', 'Monde'] as const

// Shared by memo and signal -- mirrors Payload's memoItemFields.
export function memoItemSubFields(): FieldDef[] {
  return [
    { field: 'region', type: 'string', meta: { interface: 'select-dropdown', options: { choices: STORY_REGIONS.map((r) => ({ text: r, value: r })) } } },
    textField('category', { required: true }),
    textField('subcategory'),
    textField('title', { required: true }),
    textareaField('what', { required: true }),
    textareaField('teaser'),
    textareaField('why', { required: true }),
    repeaterField('sources', 'Sources', [textField('label', { required: true }), textField('url')]),
    textField('signal'),
    textField('image', { note: 'CDN URL' }),
    textField('image_alt'),
    textField('image_credit'),
  ]
}

export const memoCollection: CollectionDef = {
  collection: 'memo',
  icon: 'article',
  note: 'Daily digest issue -- a set of short story items.',
  fields: [
    slugField(),
    textField('title', { required: true }),
    dateField('date', { required: true }),
    statusField(),
    numberField('reading_time'),
    textareaField('summary', { required: true }),
    repeaterField('items', 'Story items', memoItemSubFields()),
    // featured_video -> video.id, wired up as an M2O relation in apply.ts.
    ...seoFields(),
    sortField(),
    ...trackingFields(),
  ],
}
