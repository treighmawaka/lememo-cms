import type { CollectionDef } from '../lib'
import { dateField, primaryKeyField, seoJsonField, sortField, textareaField, trackingFields, wpslugField } from '../lib'

// Mirrors memo_digests exactly. Signal's old day-level cover image
// (image/image_alt/image_credit) was dropped for the same reason
// featured_video was on memo: superseded by the featured item's own thumbnail.
export const signalDigestsCollection: CollectionDef = {
  collection: 'signal_digests',
  icon: 'calendar_today',
  note: 'Day-level wrapper for signal items -- date, editorial summary, and SEO only.',
  fields: [
    primaryKeyField(),
    wpslugField('{{date}}'),
    dateField('date', { required: true }),
    textareaField('summary', { required: true }),
    seoJsonField('Le Signal du {{date}}'),
    sortField(),
    ...trackingFields(),
  ],
}
