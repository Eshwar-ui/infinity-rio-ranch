import { z } from 'zod'

import { eventTypes } from '@/data/site'

/**
 * Validation rules for the contact / inquiry form.
 *
 * DESIGN DECISION (yours to shape): the prototype only hard-required Name and a
 * valid Email, leaving phone/date/message optional. That's the baseline below.
 * Consider whether your booking workflow wants stricter rules — e.g. require a
 * phone number, require a preferred date, or enforce a minimum message length so
 * the team has enough to respond. Tighten the fields here and the form + error
 * messages update automatically.
 */
export const inquirySchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name.'),
  email: z.string().trim().email('Enter a valid email.'),
  phone: z.string().trim().optional(),
  date: z.string().trim().optional(),
  type: z.enum(eventTypes),
  message: z.string().trim().optional(),
})

export type InquiryValues = z.infer<typeof inquirySchema>
