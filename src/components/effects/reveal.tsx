import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { useReveal } from '@/hooks/use-reveal'

type RevealProps = {
  children: ReactNode
  /** Stagger in seconds, matching the prototype's data-delay. */
  delay?: number
  className?: string
  as?: 'div' | 'section' | 'span'
}

/** Fade + rise element into view on scroll. */
export const Reveal = ({
  children,
  delay = 0,
  className,
  as: Tag = 'div',
}: RevealProps) => {
  const { ref, shown } = useReveal<HTMLDivElement>()

  return (
    <Tag
      ref={ref as never}
      className={cn(
        shown ? 'translate-y-0 opacity-100' : 'translate-y-7 opacity-0',
        className,
      )}
      style={{
        transitionProperty: 'opacity, transform',
        transitionDuration: '0.9s',
        transitionTimingFunction: 'cubic-bezier(0.22,0.61,0.36,1)',
        transitionDelay: delay ? `${delay}s` : undefined,
      }}
    >
      {children}
    </Tag>
  )
}
