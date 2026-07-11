import type { CollectionDef } from '../lib'
import { booleanField, dateField, markdownField, numberField, repeaterField, seoFields, slugField, statusField, textField, textareaField, trackingFields } from '../lib'

const STORY_REGIONS = ['RDC', 'Afrique', 'Monde'] as const

export const focusCollection: CollectionDef = {
  collection: 'focus',
  icon: 'center_focus_strong',
  note: 'Long-form editorial pieces.',
  fields: [
    slugField(),
    textField('title', { required: true }),
    textareaField('description', { required: true }),
    textareaField('teaser'),
    dateField('date', { required: true }),
    statusField(),
    { field: 'region', type: 'string', meta: { interface: 'select-dropdown', options: { choices: STORY_REGIONS.map((r) => ({ text: r, value: r })) } } },
    textField('category', { required: true }),
    textField('subcategory'),
    numberField('reading_time'),
    textField('image', { note: 'CDN URL' }),
    textField('image_alt'),
    textField('image_credit'),
    // Main editorial prose -- raw markdown, no Lexical/JSON conversion needed.
    markdownField('body'),
    textField('video_youtube_id'),
    textField('video_title'),
    // visuel -> visuels.id, wired up as an M2O relation in apply.ts.
    textField('author'),
    booleanField('hide_description', false),
    booleanField('hide_author_byline', false),
    booleanField('special_publication', false),
    textareaField('author_bio'),
    textField('author_thumbnail', { note: 'CDN URL' }),
    textField('author_url'),
    repeaterField('updates', 'Post-publication updates', [
      { field: 'date', type: 'date', meta: { interface: 'datetime', required: true } },
      { field: 'note', type: 'text', meta: { interface: 'input-multiline', required: true } },
    ]),
    ...seoFields(),
    ...trackingFields(),
  ],
}
