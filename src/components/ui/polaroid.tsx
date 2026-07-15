import type { CSSProperties } from 'react'

import { cn } from '@/lib/utils'

type PolaroidProps = {
  src: string
  alt?: string
  caption?: string
  /** Tilt in degrees; straightens on hover. */
  rotate?: number
  aspect?: string
  className?: string
}

/**
 * A physical-photo frame: warm paper border, deep bottom margin, slight
 * tilt that straightens on hover. The paper tone is fixed (not a theme
 * token) since a printed photo's border doesn't swap with light/dark mode.
 */
export const Polaroid = ({
  src,
  alt = '',
  caption,
  rotate = -3,
  aspect = 'aspect-[4/5]',
  className,
}: PolaroidProps) => (
  <div
    className={cn(
      'rounded-[2px] bg-[#f6f1e6] p-3 pb-8 shadow-[0_30px_70px_rgba(0,0,0,0.45)]',
      'transition-transform duration-500 ease-out [transform:rotate(var(--tilt))] hover:[transform:rotate(0deg)]',
      className,
    )}
    style={{ '--tilt': `${rotate}deg` } as CSSProperties}
  >
    <div
      role="img"
      aria-label={alt}
      className={cn('w-full overflow-hidden rounded-[1px] bg-cover bg-center shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]', aspect)}
      style={{ backgroundImage: `url(${src})` }}
    />
    {caption && (
      <p className="mt-2.5 truncate text-center font-script text-[19px] leading-none text-[#6b5a41]/80">
        {caption}
      </p>
    )}
  </div>
)
