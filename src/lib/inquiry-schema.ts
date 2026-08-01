import { z } from 'zod'

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
  /*
   * A bounded string, not an enum. The choices are CMS-driven now
   * (`list_items` where list = 'event_types'), so a type the owner adds after
   * this bundle was built has to validate too — an enum baked at build time
   * would silently reject the option the form itself offered. 100 chars is the
   * `leads_type_len` CHECK in 0002_hardening.sql, so the form now rejects
   * exactly what the database would.
   */
  type: z.string().trim().min(1, 'Please choose an event type.').max(100),
  message: z.string().trim().optional(),
})

export type InquiryValues = z.infer<typeof inquirySchema>
