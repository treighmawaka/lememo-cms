import type { CollectionDef, FieldDef } from '../lib'
import { booleanField, m2oField, primaryKeyField, repeaterField, sortField, tagsField, textField, textareaField, trackingFields } from '../lib'
import { CHRONOLOGY_CATEGORIES, CHRONOLOGY_IMPORTANCE, CHRONOLOGY_PRESIDENCIES } from './chronologie'

// Flat, queryable replacement for chronologie's nested items[].events[] --
// one row per timeline event, grouped by event_group (denormalized plain
// field, not its own collection: a group is just a label like "1960", it
// carries no other data) and ordered by sort. Rendered by grouping rows by
// event_group at render time, same pattern as memos/signals grouping by date.
export const chronologyEventsCollection: CollectionDef = {
  collection: 'chronology_events',
  icon: 'event',
  note: 'Individual chronology timeline events -- flat, queryable, grouped by event_group at render time.',
  fields: [
    primaryKeyField(),
    m2oField('chronologie', 'The chronology page this event belongs to'),
    textField('event_group', { required: true, note: 'e.g. a year or era label -- grouping key, not a relation' }),
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
    sortField(),
    ...trackingFields(),
  ] as FieldDef[],
}
