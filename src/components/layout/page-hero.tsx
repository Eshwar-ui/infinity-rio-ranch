import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { useParallax } from '@/hooks/use-parallax'

type PageHeroProps = {
  eyebrow: string
  title: string
  crumb: string
  image: string
  className?: string
}

/** Interior-page banner: parallax image, gradient wash, script eyebrow + breadcrumb. */
export const PageHero = ({ eyebrow, title, crumb, image, className }: PageHeroProps) => {
  const parallaxRef = useParallax<HTMLDivElement>(0.2)

  return (
    <section
      className={cn(
        'relative flex items-center justify-center overflow-hidden',
        className ?? 'min-h-[52vh]',
      )}
    >
      <div
        ref={parallaxRef}
        className="absolute inset-x-0 -inset-y-[12%] z-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${image})` }}
      />
      <div className="absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(14,11,8,0.45)_0%,rgba(14,11,8,0.7)_55%,rgba(10,8,6,0.97)_100%)]" />
      <div className="relative z-[3] px-5 pb-[60px] pt-[130px] text-center">
        <div className="mb-0.5 font-script text-[34px] font-bold text-[#e6cfa0]">
          {eyebrow}
        </div>
        <h1 className="m-0 font-serif text-[clamp(2.6rem,6vw,4.6rem)] font-normal text-[#f5efe6]">
          {title}
        </h1>
        <div className="mt-5 flex items-center justify-center gap-2.5 text-[10.5px] uppercase tracking-[0.24em] text-[rgba(245,239,230,0.7)]">
          <Link to="/">Home</Link>
          <span>·</span>
          <span className="text-[#e6cfa0]">{crumb}</span>
        </div>
      </div>
    </section>
  )
}
