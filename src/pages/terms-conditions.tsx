import { contact } from '@/data/site'
import { LegalPage, legal } from '@/components/layout/legal-page'

const LAST_UPDATED = 'September 3, 2026'

export const TermsConditionsPage = () => (
  <LegalPage eyebrow="The Fine Print" title="Terms & Conditions" updated={LAST_UPDATED}>
    <p className={legal.p}>
      These terms govern your use of this website. They cover the website only — if
      you book Infinity at Rio Ranch for an event, that booking is governed by the
      separate rental agreement (or, for vendors, the vendor services agreement) you
      sign at that time, which takes priority over anything here for the event itself.
    </p>

    <h2 className={legal.h2}>Use of this website</h2>
    <p className={legal.p}>
      You may browse this site and use the contact form to make an inquiry. You agree
      not to misuse the site — including attempting to access non-public areas,
      submitting false information, or using it to send unsolicited or unlawful
      content.
    </p>

    <h2 className={legal.h2}>Inquiries are not a booking</h2>
    <p className={legal.p}>
      Submitting the contact form or otherwise reaching out is an inquiry, not a
      reservation. A date is held only once we&rsquo;ve confirmed availability, agreed
      on pricing and received the signed rental agreement and deposit described in
      that agreement.
    </p>

    <h2 className={legal.h2}>Content and intellectual property</h2>
    <p className={legal.p}>
      The text, photos and design on this site belong to Infinity at Rio Ranch or are
      used with permission, and may not be copied, reproduced or reused without our
      written consent.
    </p>

    <h2 className={legal.h2}>Accuracy of information</h2>
    <p className={legal.p}>
      We do our best to keep pricing, availability and venue details on this site
      accurate and current, but they may change without notice and are not binding
      until confirmed in writing for a specific booking.
    </p>

    <h2 className={legal.h2}>Third-party links</h2>
    <p className={legal.p}>
      This site links to third-party services, such as our Instagram page and a Google
      Maps embed. We aren&rsquo;t responsible for the content or practices of those
      third-party sites.
    </p>

    <h2 className={legal.h2}>Disclaimer &amp; limitation of liability</h2>
    <p className={legal.p}>
      This website and its content are provided &ldquo;as is,&rdquo; without warranties
      of any kind. To the fullest extent permitted by law, Infinity at Rio Ranch is not
      liable for any indirect, incidental or consequential damages arising from your
      use of this site.
    </p>

    <h2 className={legal.h2}>Governing law</h2>
    <p className={legal.p}>
      These terms are governed by the laws of the State of Texas, without regard to
      conflict-of-law principles.
    </p>

    <h2 className={legal.h2}>Changes to these terms</h2>
    <p className={legal.p}>
      We may update these terms from time to time. The &ldquo;Last updated&rdquo; date
      at the top reflects the most recent revision.
    </p>

    <h2 className={legal.h2}>Contact us</h2>
    <p className={legal.p}>
      Questions about these terms can be sent to{' '}
      <a href={`mailto:${contact.email}`} className="text-cream underline decoration-line hover:text-brass2">
        {contact.email}
      </a>{' '}
      or {contact.phones[0]}, or by mail to {contact.address}.
    </p>
  </LegalPage>
)
