import type { CollectionDef } from '../lib'
import { booleanField, numberField, repeaterField, seoFields, slugField, sortField, statusField, tagsField, textField, textareaField, trackingFields } from '../lib'

// Mirrors reference/chronology.ts
// Exported for reuse by collections/chronologyEvents.ts.
export const CHRONOLOGY_CATEGORIES = ['Politique', 'Conflits', 'Infrastructure', 'Économie', 'Éducation', 'Diplomatie', 'Culture & Sport'] as const
export const CHRONOLOGY_PRESIDENCIES = ['Kasa-Vubu', 'Mobutu', 'Laurent-Désiré Kabila', 'Joseph Kabila', 'Félix Tshisekedi'] as const
export const CHRONOLOGY_IMPORTANCE = ['low', 'medium', 'high'] as const

const eventFields = [
  textField('event', { required: true }),
  textareaField('note', { required: true }),
  { field: 'category', type: 'string', meta: { interface: 'select-dropdown', options: { choices: CHRONOLOGY_CATEGORIES.map((c) => ({ text: c, value: c })) } } },
  { field: 'presidency', type: 'string', meta: { interface: 'select-dropdown', options: { choices: CHRONOLOGY_PRESIDENCIES.map((p) => ({ text: p, value: p })) } } },
  { field: 'importance', type: 'string', meta: { interface: 'select-dropdown', options: { choices: CHRONOLOGY_IMPORTANCE.map((i) => ({ text: i, value: i })) } } },
  booleanField('show', true),
  textField('location'),
  tagsField('tags'),
  repeaterField('images', 'Event images', [textField('src', { required: true, note: 'CDN URL' }), textField('alt'), textField('credit')]),
  repeaterField('videos', 'Event videos', [textField('url', { required: true }), textField('title')]),
]

export const chronologieCollection: CollectionDef = {
  collection: 'chronologie',
  icon: 'timeline',
  note: 'Country/topic timeline pages -- page-level metadata only. Events live in chronology_events (see schema/collections/chronologyEvents.ts); the legacy nested `items` field below is kept read-only for historical reference, hidden via schema/polishFlatChronologie.ts.',
  fields: [
    slugField(),
    textField('title', { required: true }),
    textareaField('description', { required: true }),
    statusField(),
    textField('image', { note: 'CDN URL' }),
    textField('image_alt'),
    textField('image_credit'),
    textField('type'),
    textField('country'),
    numberField('start_year'),
    numberField('end_year'),
    booleanField('featured', false),
    repeaterField('items', 'Event groups (legacy, hidden -- see chronology_events)', [
      textField('event_group', { required: true }),
      repeaterField('events', 'Events', eventFields),
    ]),
    ...seoFields(),
    sortField(),
    ...trackingFields(),
  ],
}
