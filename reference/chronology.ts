export const CHRONOLOGY_CATEGORIES = [
  'Politique',
  'Conflits',
  'Infrastructure',
  'Économie',
  'Éducation',
  'Diplomatie',
  'Culture & Sport',
] as const

export const CHRONOLOGY_PRESIDENCIES = [
  'Kasa-Vubu',
  'Mobutu',
  'Laurent-Désiré Kabila',
  'Joseph Kabila',
  'Félix Tshisekedi',
] as const

export const CHRONOLOGY_DECADES = [
  '1960s',
  '1970s',
  '1980s',
  '1990s',
  '2000s',
  '2010s',
  '2020s',
] as const

export const CHRONOLOGY_IMPORTANCE_LEVELS = ['low', 'medium', 'high'] as const

export type ChronologyCategory = (typeof CHRONOLOGY_CATEGORIES)[number]
export type ChronologyPresidency = (typeof CHRONOLOGY_PRESIDENCIES)[number]
export type ChronologyDecade = (typeof CHRONOLOGY_DECADES)[number]
export type ChronologyImportance = (typeof CHRONOLOGY_IMPORTANCE_LEVELS)[number]

export interface ChronologyMediaImage {
  src: string
  alt?: string
  credit?: string
}

export interface ChronologyMediaVideo {
  url: string
  title?: string
}

export interface ChronologyMedia {
  images?: ChronologyMediaImage[]
  videos?: ChronologyMediaVideo[]
}

export interface ChronologyEventItem {
  event: string
  note: string
  category?: ChronologyCategory
  presidency?: ChronologyPresidency
  importance?: ChronologyImportance
  show?: boolean
  location?: string
  tags?: string[]
  media?: ChronologyMedia
  link?: string
}

export interface ChronologyEventGroup {
  eventGroup: string
  items: ChronologyEventItem[]
}

export type ChronologyEntry = ChronologyEventItem | ChronologyEventGroup

export interface ChronologyDocument {
  title: string
  description: string
  image?: string
  imageAlt?: string
  imageCredit?: string
  type?: string
  country?: string
  startYear?: number
  endYear?: number
  featured?: boolean
  items: ChronologyEntry[]
}

export interface ChronologyTimelineEvent extends ChronologyEventItem {
  id: string
  groupYear: string
  order: number
}

export interface ChronologyTimelineGroup {
  year: string
  events: ChronologyTimelineEvent[]
}

export interface ChronologyFilterState {
  search: string
  decade: ChronologyDecade | 'all'
  category: ChronologyCategory | 'all'
  presidency: ChronologyPresidency | 'all'
}
