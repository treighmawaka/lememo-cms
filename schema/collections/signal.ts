import type { CollectionDef } from '../lib'
import { dateField, numberField, repeaterField, seoFields, slugField, sortField, statusField, textField, textareaField, trackingFields } from '../lib'
import { memoItemSubFields } from './memo'

export const signalCollection: CollectionDef = {
  collection: 'signal',
  icon: 'bolt',
  note: 'Short-form digest, same item shape as memo.',
  fields: [
    slugField(),
    textField('title', { required: true }),
    dateField('date', { required: true }),
    statusField(),
    numberField('reading_time'),
    textareaField('summary', { required: true }),
    textField('image', { note: 'CDN URL' }),
    textField('image_alt'),
    textField('image_credit'),
    repeaterField('items', 'Story items', memoItemSubFields()),
    ...seoFields(),
    sortField(),
    ...trackingFields(),
  ],
}
