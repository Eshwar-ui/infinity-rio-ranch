import { ContentEditor } from '@/components/admin/content-editor'

export const AdminTestimonials = () => (
  <ContentEditor
    table="testimonials"
    title="Testimonials"
    fields={[
      { key: 'quote', label: 'Quote', type: 'textarea', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'event', label: 'Event', type: 'text' },
    ]}
    primary={(r) => r.name}
    subtitle={(r) => r.event ?? ''}
  />
)
