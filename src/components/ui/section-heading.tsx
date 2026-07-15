import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type SectionHeadingProps = {
  /** Dancing Script eyebrow above the title. */
  eyebrow: string
  title: ReactNode
  align?: 'left' | 'center'
  /** Prefix the eyebrow with a short brass rule (welcome-section style). */
  withRule?: boolean
  className?: string
  titleClassName?: string
}

/** The recurring script-eyebrow + serif-heading pairing used across sections. */
export const SectionHeading = ({
  eyebrow,
  title,
  align = 'left',
  withRule = false,
  className,
  titleClassName,
}: SectionHeadingProps) => (
  <div className={cn(align === 'center' && 'text-center', className)}>
    {withRule ? (
      <div className="mb-5 inline-flex items-center gap-3">
        <span className="h-px w-[34px] bg-brass" />
        <span className="font-script text-[30px] font-bold leading-none text-brass2">
          {eyebrow}
        </span>
      </div>
    ) : (
      <span className="font-script text-[32px] font-bold text-brass2">
        {eyebrow}
      </span>
    )}
    <h2
      className={cn(
        'font-serif font-normal text-cream',
        // leading must come after the font-size utility — tailwind-merge
        // treats a later text-[size] as resetting any leading before it.
        'text-[clamp(2.1rem,4.6vw,3.5rem)] leading-[1.08]',
        !withRule && 'mt-2',
        titleClassName,
      )}
    >
      {title}
    </h2>
  </div>
)
