import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { InstagramLogo } from '@phosphor-icons/react'

import { contact, navLinks } from '@/data/site'
import { logoFor, useThemeStore } from '@/store/theme'

/** Small brass sparkle that echoes the hero's twinkling lights. */
const Sparkle = () => (
  <span aria-hidden className="text-[13px] leading-none text-brass2">
    &#10022;
  </span>
)

/** A faint dot separator between inline links. */
const Dot = () => (
  <span aria-hidden className="select-none text-line">
    &middot;
  </span>
)

export const Footer = () => {
  const theme = useThemeStore((s) => s.theme)

  const contactItems = [
    { label: contact.email, href: `mailto:${contact.email}`, external: false },
    { label: contact.phones[0], href: contact.phoneHref, external: false },
    { label: contact.location, href: contact.mapUrl, external: true },
  ]

  return (
    <footer
      className="relative overflow-hidden border-t border-line px-[clamp(20px,6vw,80px)] pb-9 pt-[clamp(64px,9vw,104px)]"
      style={{ background: 'var(--footer-bg)' }}
    >
      <div className="mx-auto flex max-w-content flex-col items-center text-center">
        {/* Crest — centered medallion with flanking rule + sparkle */}
        <div className="relative flex items-center justify-center gap-4 sm:gap-6">
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(201,168,106,0.14), transparent 68%)',
            }}
          />
          <span className="hidden h-px w-14 bg-gradient-to-r from-transparent to-brass/45 sm:block lg:w-24" />
          <Sparkle />
          <img
            src={logoFor(theme)}
            alt="Infinity at Rio Ranch"
            className="relative block h-auto w-[132px] shrink-0 [filter:drop-shadow(0_14px_34px_rgba(0,0,0,0.45))] sm:w-[148px]"
          />
          <Sparkle />
          <span className="hidden h-px w-14 bg-gradient-to-l from-transparent to-brass/45 sm:block lg:w-24" />
        </div>

        {/* Primary nav */}
        <nav
          aria-label="Footer"
          className="mt-11 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.24em]"
        >
          {navLinks.map((link, i) => (
            <Fragment key={link.key}>
              {i > 0 && <Dot />}
              <Link
                to={link.to}
                className="px-1 py-1.5 text-cream/85 transition-colors duration-300 hover:text-brass2"
              >
                {link.label}
              </Link>
            </Fragment>
          ))}
        </nav>

        {/* Contact line */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13.5px] text-muted">
          {contactItems.map((item, i) => (
            <Fragment key={item.label}>
              {i > 0 && <Dot />}
              <a
                href={item.href}
                {...(item.external
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
                className="py-1 transition-colors duration-300 hover:text-brass2"
              >
                {item.label}
              </a>
            </Fragment>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mx-auto mt-12 flex max-w-content flex-col-reverse items-center gap-4 border-t border-line pt-6 sm:flex-row sm:justify-between">
        <span className="text-xs text-muted">
          &copy; 2025 Infinity Rio Ranch. All Rights Reserved.
        </span>
        <div className="flex items-center gap-4">
          <span className="hidden text-[11px] uppercase tracking-[0.24em] text-muted sm:inline">
            Follow along
          </span>
          <a
            href={contact.instagram}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Infinity at Rio Ranch on Instagram"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-brass2 transition-all duration-300 ease-out hover:scale-110 hover:-translate-y-0.5 hover:border-brass hover:text-brass active:scale-90 active:duration-150"
          >
            <InstagramLogo size={18} />
          </a>
        </div>
      </div>
    </footer>
  )
}
