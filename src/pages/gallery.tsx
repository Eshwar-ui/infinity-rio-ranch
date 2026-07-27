import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { galleryFilters, venueImg, type Filter } from '@/data/site'
import { useGallery } from '@/hooks/use-site-content'
import { useLightboxStore } from '@/store/lightbox'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/effects/reveal'
import { GalleryFeatured, GalleryGrid } from '@/components/gallery/gallery-grid'
import { PageHero } from '@/components/layout/page-hero'

export const GalleryPage = () => {
  const items = useGallery()
  const open = useLightboxStore((s) => s.open)
  const [active, setActive] = useState<Filter['key']>('all')

  // The first flagged photo (or the first photo) becomes the featured banner.
  const featuredTile = items.find((i) => i.featured) ?? items[0]
  const rest = items.filter((i) => i !== featuredTile)

  const tiles = useMemo(
    () => (active === 'all' ? rest : rest.filter((t) => t.cat === active)),
    [active, rest],
  )

  return (
    <div style={{ animation: 'riseIn .6s ease forwards' }}>
      <PageHero
        eyebrow="Get inspired"
        title="Gallery"
        crumb="Gallery"
        image={venueImg(10)}
      />

      <section className="relative bg-ink px-[clamp(20px,6vw,80px)] pb-[clamp(70px,10vw,120px)] pt-[clamp(50px,7vw,80px)]">
        <div className="mx-auto max-w-wide">
          {/*
            A photo wall with no prose is invisible to search: this intro gives
            the page indexable copy and names the spaces the photos show.
          */}
          <Reveal className="mx-auto mb-12 max-w-[720px] text-center">
            <h2 className="mb-4 font-serif text-[clamp(1.6rem,3.2vw,2.4rem)] font-normal leading-[1.15] text-cream">
              Real weddings and events at Infinity at Rio Ranch
            </h2>
            <p className="text-[15.5px] font-light leading-[1.85] text-muted">
              A look around our two acres in Liberty Hill, Texas — the ceremony
              lawn and floral arch, the 2,600 sq ft indoor reception hall, the
              string-lit outdoor terrace, the private bridal suite, and the
              golden-hour light our couples come back for. Filter by ceremony,
              reception, outdoor spaces or details, and tap any photo to enlarge.
            </p>
          </Reveal>

          {featuredTile && (
            <Reveal className="mb-14">
              <GalleryFeatured
                tile={featuredTile}
                onOpen={() =>
                  open(
                    items.map((t) => ({ src: t.src, label: t.label })),
                    items.indexOf(featuredTile),
                  )
                }
                className="aspect-[16/9] sm:aspect-[21/9]"
              />
            </Reveal>
          )}

          <div className="mb-11 flex flex-wrap justify-center gap-2.5">
            {galleryFilters.map((f) => {
              const isActive = active === f.key
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActive(f.key)}
                  className={cn(
                    'border px-[22px] py-[11px] text-[10.5px] font-medium uppercase tracking-[0.2em] transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-95 active:duration-150',
                    isActive
                      ? 'border-brass bg-brass text-onbrass'
                      : 'border-line text-cream hover:border-brass hover:text-brass2',
                  )}
                >
                  {f.label}
                </button>
              )
            })}
          </div>

          <GalleryGrid key={active} tiles={tiles} rowHeight={220} />

          <Reveal className="mt-16 text-center">
            <p className="mb-[22px] font-serif text-[clamp(1.5rem,3vw,2.1rem)] text-cream">
              Ready to see it in person?
            </p>
            <Button asChild variant="brass">
              <Link to="/contact">Schedule a Tour</Link>
            </Button>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
