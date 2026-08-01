import { WhatsappLogo } from '@phosphor-icons/react'

import { useContact } from '@/hooks/use-site-content'

export const WhatsAppFab = () => {
  const contact = useContact()
  return (
  <a
    href={contact.whatsappUrl}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Chat with Infinity at Rio Ranch on WhatsApp"
    className="fixed bottom-5 right-5 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_14px_32px_rgba(0,0,0,0.32)] transition-transform duration-300 hover:-translate-y-1 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:bottom-7 sm:right-7"
  >
    <WhatsappLogo size={29} weight="fill" aria-hidden="true" />
  </a>
  )
}
