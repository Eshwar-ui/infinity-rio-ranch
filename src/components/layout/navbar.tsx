import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Moon, Sun, X } from '@phosphor-icons/react'

import { cn } from '@/lib/utils'
import { navLinks } from '@/data/site'
import { logoFor, useThemeStore } from '@/store/theme'
import { useScrolled } from '@/hooks/use-scrolled'
import { Button } from '@/components/ui/button'
import { SmartImage } from '@/components/ui/smart-image'

export const Navbar = () => {
  const scrolled = useScrolled(40)
  const [menuOpen, setMenuOpen] = useState(false)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  /**
   * Unscrolled, the header always floats over a Hero/PageHero — which stays
   * dark in both themes — so its contents need fixed light-on-dark colors
   * regardless of site theme. Once scrolled, it sits on the themed
   * `--nav-scrolled` backdrop, so it can use theme-reactive tokens.
   */
  const onHero = !scrolled

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'relative text-xs uppercase tracking-[0.16em] transition-colors duration-300',
      'after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100',
      isActive && 'after:scale-x-100',
      onHero
        ? cn('hover:text-[#e2c690]', isActive ? 'text-[#e2c690]' : 'text-[rgba(243,237,226,0.8)]')
        : cn('hover:text-brass2', isActive ? 'text-brass2' : 'text-cream/80'),
    )

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-[80] flex items-center justify-between px-[clamp(20px,5vw,64px)] transition-all duration-500',
          scrolled
            ? 'py-3 shadow-[0_10px_40px_rgba(0,0,0,0.4)] backdrop-blur-[14px]'
            : 'py-5',
        )}
        style={{
          background: scrolled
            ? 'var(--nav-scrolled)'
            : 'linear-gradient(180deg, rgba(8,6,4,0.55) 0%, rgba(8,6,4,0.24) 65%, transparent 100%)',
        }}
      >
        <Link to="/" className="flex items-center" aria-label="Infinity at Rio Ranch — home">
          <SmartImage
            src={logoFor(onHero ? 'dark' : theme)}
            alt="Infinity at Rio Ranch"
            sizes="62px"
            priority
            className="h-[62px] w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-[38px] md:flex">
          {navLinks.map((link) => (
            <NavLink key={link.key} to={link.to} end={link.to === '/'} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle light or dark theme"
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full border transition-all duration-300 ease-out hover:scale-110 hover:rotate-[18deg] active:scale-90 active:duration-150',
              onHero
                ? 'border-[rgba(243,237,226,0.35)] text-[#e2c690] hover:border-[#e2c690] hover:text-[#e2c690]'
                : 'border-line text-brass2 hover:border-brass hover:text-brass',
            )}
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>

          <Button
            asChild
            variant="brass"
            size="sm"
            className={cn(
              'hidden md:inline-flex',
            )}
          >
            <Link to="/contact">Enquire Now</Link>
          </Button>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className={cn(
              'flex h-11 w-11 flex-col items-center justify-center gap-[5px] border transition-all duration-300 ease-out hover:scale-110 active:scale-90 active:duration-150 md:hidden',
              onHero ? 'border-[rgba(243,237,226,0.35)]' : 'border-line',
            )}
          >
            <span className={cn('block h-[1.5px] w-[18px]', onHero ? 'bg-[#f3ede2]' : 'bg-cream')} />
            <span className={cn('block h-[1.5px] w-[18px]', onHero ? 'bg-[#f3ede2]' : 'bg-cream')} />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-[26px]"
          style={{ background: 'var(--menu-bg)' }}
        >
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            className="absolute right-6 top-6 flex h-[46px] w-[46px] items-center justify-center border border-line text-cream transition-all duration-300 ease-out hover:scale-110 hover:rotate-90 hover:border-brass hover:text-brass2 active:scale-90 active:duration-150"
          >
            <X size={22} />
          </button>
          {navLinks.map((link) => (
            <NavLink
              key={link.key}
              to={link.to}
              end={link.to === '/'}
              onClick={() => setMenuOpen(false)}
              className="font-serif text-[34px] tracking-[0.02em] text-cream"
            >
              {link.label}
            </NavLink>
          ))}
          <Button asChild variant="brass" size="sm" onClick={() => setMenuOpen(false)}>
            <Link to="/contact">Enquire Now</Link>
          </Button>
        </div>
      )}
    </>
  )
}
