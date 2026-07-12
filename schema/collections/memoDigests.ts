import type { CollectionDef } from '../lib'
import { dateField, primaryKeyField, seoJsonField, sortField, textareaField, trackingFields, wpslugField } from '../lib'

// Thin day-level wrapper -- holds only what genuinely can't live on an
// individual memo item: the editorial framing summary and the day page's
// own SEO metadata. Status, reading_time, and featured_video were dropped
// deliberately: status is now per-item (a day can be partially published),
// reading_time is computed from items at render time, and featured_video is
// superseded by memos.featured.
export const memoDigestsCollection: CollectionDef = {
  collection: 'memo_digests',
  icon: 'calendar_today',
  note: 'Day-level wrapper for memo items -- date, editorial summary, and SEO only.',
  fields: [
    primaryKeyField(),
    wpslugField('{{date}}'),
    dateField('date', { required: true }),
    textareaField('summary', { required: true }),
    seoJsonField('Le Memo du {{date}}'),
    sortField(),
    ...trackingFields(),
  ],
}
