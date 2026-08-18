/**
 * Shared by the vendor agreements list (`vendors.tsx`) and one agreement's page
 * (`vendor-detail.tsx`).
 *
 * Same arrangement as `client-shared.ts`, and for the same reason: the row type
 * and the way a service type is printed have to match across both views, or the
 * list and the page end up describing the same vendor differently.
 */
import { SERVICE_LABELS, type ServiceType } from '@/lib/vendor-services'

export type VendorAgreement = {
  id: string
  business_name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  client_event_name: string | null
  service_types: ServiceType[]
  agreement_date: string | null
  event_date: string | null
  vendor_rep_name: string | null
  venue_rep_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** Colour per service, so the list reads as categories rather than as text. */
export const serviceClass: Record<ServiceType, string> = {
  catering: 'bg-brass/15 text-brass2 border-brass/40',
  decor: 'bg-[#6a9a7a]/15 text-[#8fc0a0] border-[#6a9a7a]/40',
  dj: 'bg-[#7d8fb3]/15 text-[#9fb0d0] border-[#7d8fb3]/40',
  event_manager: 'bg-[#c08a9a]/15 text-[#d6a3b1] border-[#c08a9a]/40',
}

/** "Catering · DJ" — what this vendor is doing, for a screen reader and a search. */
export const serviceSummary = (v: Pick<VendorAgreement, 'service_types'>) =>
  (v.service_types ?? []).map((s) => SERVICE_LABELS[s]).join(' · ')

/** `event_date` is a bare date — parsing it without a time zone shifts it a day. */
export const fmtDate = (d: string | null) =>
  d
    ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

/** Fields the search box looks at, in both views. */
export const searchable = (v: VendorAgreement) => [
  v.business_name,
  v.contact_person,
  v.email,
  v.phone,
  v.client_event_name,
  ...(v.service_types ?? []).map((s) => SERVICE_LABELS[s]),
]
