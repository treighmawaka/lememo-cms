import type { CollectionDef } from '../lib'
import { dateField, seoFields, slugField, statusField, textField, textareaField, trackingFields } from '../lib'

export const videoCollection: CollectionDef = {
  collection: 'video',
  icon: 'movie',
  note: 'Standalone video entries (YouTube/Vimeo/other).',
  fields: [
    slugField(),
    textField('title', { required: true }),
    textareaField('description', { required: true }),
    dateField('date', { required: true }),
    statusField(),
    textField('duration'),
    textField('thumbnail', { note: 'CDN URL' }),
    { field: 'platform', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [{ text: 'YouTube', value: 'youtube' }, { text: 'Vimeo', value: 'vimeo' }, { text: 'Other', value: 'other' }] } }, schema: { default_value: 'youtube' } },
    textField('video_url', { required: true }),
    ...seoFields(),
    ...trackingFields(),
  ],
}
