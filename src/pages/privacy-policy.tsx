import { contact } from '@/data/site'
import { LegalPage, legal } from '@/components/layout/legal-page'

const LAST_UPDATED = 'September 3, 2026'

export const PrivacyPolicyPage = () => (
  <LegalPage eyebrow="Your Privacy" title="Privacy Policy" updated={LAST_UPDATED}>
    <p className={legal.p}>
      Infinity at Rio Ranch (&ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;) operates
      this website. This policy explains what information we collect when you use it,
      why we collect it, and how it&rsquo;s handled.
    </p>

    <h2 className={legal.h2}>Information we collect</h2>
    <p className={legal.p}>We collect information in two ways:</p>
    <ul className={legal.ul}>
      <li className={legal.li}>
        <strong className="text-cream">Information you give us directly</strong> — through
        our contact form or by phone/email, such as your name, email address, phone
        number, preferred event date, event type and any details you share in your
        message. If we go on to book your event, we also keep booking details (dates,
        package, pricing) and, for invoicing, billing information.
      </li>
      <li className={legal.li}>
        <strong className="text-cream">Information collected automatically</strong> — we
        do not run analytics or advertising trackers on this site. We use only
        functionally necessary browser storage to remember your theme preference (light
        or dark); it identifies your browser only, never you personally, and nothing is
        shared with a third party. Standard server logs kept by our hosting provider may
        record IP address and browser type for security purposes.
      </li>
    </ul>

    <h2 className={legal.h2}>How we use your information</h2>
    <ul className={legal.ul}>
      <li className={legal.li}>To respond to inquiries and schedule venue tours</li>
      <li className={legal.li}>To prepare quotes, invoices and rental agreements for booked events</li>
      <li className={legal.li}>To communicate with you about your event before, during and after booking</li>
      <li className={legal.li}>To maintain our own business records</li>
    </ul>
    <p className={legal.p}>
      We do not sell your personal information, and we do not use it for advertising.
    </p>

    <h2 className={legal.h2}>How we share your information</h2>
    <p className={legal.p}>
      We share information only with the service providers that help us run the
      business and this website — our database and hosting providers, and the email
      service we use to send invoices and booking confirmations. Each is bound to
      handle your data only on our instructions. We may also disclose information if
      required to by law.
    </p>

    <h2 className={legal.h2}>Data retention</h2>
    <p className={legal.p}>
      We keep inquiry details for as long as reasonably useful for following up, and
      booking and billing records for as long as required for our business and tax
      records. You can ask us to delete information that isn&rsquo;t needed for those
      purposes — see &ldquo;Your choices&rdquo; below.
    </p>

    <h2 className={legal.h2}>Security</h2>
    <p className={legal.p}>
      We use reasonable technical and organizational measures to protect the
      information we hold, including access controls that restrict booking and billing
      records to authorized staff. No method of transmission or storage is completely
      secure, and we can&rsquo;t guarantee absolute security.
    </p>

    <h2 className={legal.h2}>Children&rsquo;s privacy</h2>
    <p className={legal.p}>
      This site is not directed at children under 13, and we do not knowingly collect
      information from them.
    </p>

    <h2 className={legal.h2}>Your choices</h2>
    <p className={legal.p}>
      You can ask us at any time what information we hold about you, or ask us to
      correct or delete it, by contacting us using the details below. We&rsquo;ll
      respond as promptly as we can.
    </p>

    <h2 className={legal.h2}>Changes to this policy</h2>
    <p className={legal.p}>
      We may update this policy from time to time. The &ldquo;Last updated&rdquo; date
      at the top reflects the most recent revision.
    </p>

    <h2 className={legal.h2}>Contact us</h2>
    <p className={legal.p}>
      Questions about this policy or your information can be sent to{' '}
      <a href={`mailto:${contact.email}`} className="text-cream underline decoration-line hover:text-brass2">
        {contact.email}
      </a>{' '}
      or {contact.phones[0]}, or by mail to {contact.address}.
    </p>
  </LegalPage>
)
