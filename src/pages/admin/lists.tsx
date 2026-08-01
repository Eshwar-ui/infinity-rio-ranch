import { ContentEditor } from '@/components/admin/content-editor'

/**
 * The venue's headline numbers. No longer rendered as a stat row anywhere on the
 * site — they now feed only the "Grounds" line of the About page's at-a-glance
 * table, plus `llms.txt` / `facts.json` (see `groundsDetail()` in lib/seo.ts).
 * Deleting them all is safe; the Grounds line falls back to a generic sentence.
 */
export const AdminStats = () => (
  <ContentEditor
    table="stats"
    title="Venue numbers"
    fields={[
      { key: 'value', label: 'Number', type: 'text', required: true },
      { key: 'label', label: 'Caption', type: 'text', required: true },
    ]}
    primary={(r) => `${r.value} — ${r.label}`}
  />
)

/** The amenity cards on the About page. */
export const AdminAmenities = () => (
  <ContentEditor
    table="amenities"
    title="Amenities"
    fields={[
      { key: 'icon', label: 'Icon (a single character, e.g. ✦)', type: 'text' },
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'sub', label: 'Description', type: 'textarea' },
    ]}
    primary={(r) => r.title}
    subtitle={(r) => r.sub ?? ''}
  />
)

/** "Every celebration includes" on the About page. */
export const AdminIncluded = () => (
  <ContentEditor
    table="list_items"
    title="What's included"
    scope={{ column: 'list', value: 'included' }}
    fields={[{ key: 'value', label: 'Item', type: 'text', required: true }]}
    primary={(r) => r.value}
  />
)

/**
 * The Event Type dropdown on the inquiry form. Free text by design — the zod
 * schema validates length, not membership, so a type added here works straight
 * away without a redeploy. See the note in src/lib/inquiry-schema.ts.
 */
export const AdminEventTypes = () => (
  <ContentEditor
    table="list_items"
    title="Event types"
    scope={{ column: 'list', value: 'event_types' }}
    fields={[{ key: 'value', label: 'Option', type: 'text', required: true }]}
    primary={(r) => r.value}
  />
)
