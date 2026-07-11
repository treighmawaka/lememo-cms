import type { CollectionDef } from '../lib'
import { dateField, markdownField, seoFields, slugField, statusField, textField, trackingFields } from '../lib'

export const pagesCollection: CollectionDef = {
  collection: 'pages',
  icon: 'description',
  note: 'Static informational pages (e.g. "about").',
  fields: [
    slugField(),
    textField('title', { required: true }),
    textField('description'),
    dateField('last_updated'),
    statusField(),
    markdownField('body'),
    ...seoFields(),
    ...trackingFields(),
  ],
}
