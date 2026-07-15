import type { CollectionDef, FieldDef } from '../lib'
import {
  booleanField,
  dateField,
  fileField,
  m2oField,
  primaryKeyField,
  repeaterField,
  sortField,
  statusField,
  textField,
  textareaField,
  trackingFields,
  wpslugField,
} from '../lib'

const STORY_REGIONS = ['RDC', 'Afrique', 'Monde'] as const

// Identical shape to memos -- same item structure, different digest cadence.
export const signalsCollection: CollectionDef = {
  collection: 'signals',
  icon: 'bolt',
  note: 'Individual signal story items -- flat, queryable, grouped by date into a digest at render time.',
  fields: [
    primaryKeyField(),
    wpslugField('{{title}}'),
    dateField('date', { required: true }),
    m2oField('signal_digest', 'The day this item belongs to'),
    { field: 'region', type: 'string', meta: { interface: 'select-dropdown', options: { choices: STORY_REGIONS.map((r) => ({ text: r, value: r })) } } },
    textField('category', { required: true }),
    textField('subcategory'),
    textField('title', { required: true }),
    textareaField('what', { required: true }),
    textareaField('teaser'),
    textareaField('why', { required: true }),
    repeaterField('sources', 'Sources', [textField('label', { required: true }), textField('url')]),
    textField('signal'),
    fileField('thumbnail_file'),
    textareaField('image_alt'),
    textField('image_credit'),
    booleanField('featured', false),
    statusField(),
    sortField(),
    ...trackingFields(),
  ] as FieldDef[],
}
