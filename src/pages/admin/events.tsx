import { ContentEditor } from '@/components/admin/content-editor'

export const AdminEvents = () => (
  <ContentEditor
    table="events"
    title="Events & Packages"
    fields={[
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'blurb', label: 'Blurb', type: 'textarea' },
      { key: 'image', label: 'Image path (e.g. /assets/site/events/ev-61.png)', type: 'text' },
    ]}
    primary={(r) => r.title}
    subtitle={(r) => r.blurb ?? ''}
  />
)
