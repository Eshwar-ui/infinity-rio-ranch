import { ContentEditor } from '@/components/admin/content-editor'

export const AdminFaqs = () => (
  <ContentEditor
    table="faqs"
    title="FAQs"
    fields={[
      { key: 'question', label: 'Question', type: 'text', required: true },
      { key: 'answer', label: 'Answer', type: 'textarea', required: true },
    ]}
    primary={(r) => r.question}
  />
)
