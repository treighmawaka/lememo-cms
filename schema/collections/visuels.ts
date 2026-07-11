import type { CollectionDef } from '../lib'
import { dateField, repeaterField, seoFields, slugField, statusField, textField, textareaField, trackingFields } from '../lib'

export const visuelsCollection: CollectionDef = {
  collection: 'visuels',
  icon: 'photo_library',
  note: 'Photo sets, optionally tied to a Focus piece.',
  fields: [
    slugField(),
    textField('title', { required: true }),
    textareaField('description', { required: true }),
    dateField('date', { required: true }),
    statusField(),
    textField('image', { note: 'CDN URL' }),
    textField('image_alt'),
    repeaterField('items', 'Photo set items', [
      textField('image', { required: true, note: 'CDN URL' }),
      textField('image_alt'),
    ]),
    // related_link -> focus.id, wired up as an M2O relation in apply.ts after all
    // collections exist (visuels <-> focus reference each other).
    textField('related_link_title'),
    ...seoFields(),
    ...trackingFields(),
  ],
}
