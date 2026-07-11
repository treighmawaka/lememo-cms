import type { CollectionDef } from '../lib'
import { booleanField, numberField, repeaterField, seoFields, slugField, statusField, tagsField, textField, textareaField, trackingFields } from '../lib'

// Mirrors reference/chronology.ts
const CHRONOLOGY_CATEGORIES = ['Politique', 'Conflits', 'Infrastructure', 'Économie', 'Éducation', 'Diplomatie', 'Culture & Sport'] as const
const CHRONOLOGY_PRESIDENCIES = ['Kasa-Vubu', 'Mobutu', 'Laurent-Désiré Kabila', 'Joseph Kabila', 'Félix Tshisekedi'] as const
const CHRONOLOGY_IMPORTANCE = ['low', 'medium', 'high'] as const

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
  note: 'Country/topic timelines -- two levels of nested groups.',
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
    repeaterField('items', 'Event groups', [
      textField('event_group', { required: true }),
      repeaterField('events', 'Events', eventFields),
    ]),
    ...seoFields(),
    ...trackingFields(),
  ],
}
