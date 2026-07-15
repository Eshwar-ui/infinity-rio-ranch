import { cn } from '@/lib/utils'
import { stats } from '@/data/site'

type StatListProps = {
  /** 'inline' = hero/welcome row, 'band' = large centered band. */
  variant?: 'inline' | 'band'
  /** 'onDark' pins light-on-dark colors for use on the always-dark Hero, independent of the site theme. */
  tone?: 'auto' | 'onDark'
  className?: string
}

/** The 2 acres / 2,600 / 12,400 statistics, in two visual scales. */
export const StatList = ({ variant = 'inline', tone = 'auto', className }: StatListProps) => {
  const isBand = variant === 'band'
  const onDark = tone === 'onDark'

  return (
    <div
      className={cn(
        'flex flex-wrap',
        isBand
          ? 'justify-center gap-[clamp(30px,8vw,110px)] text-center'
          : 'gap-[clamp(22px,4vw,54px)]',
        className,
      )}
    >
      {stats.map((stat) => (
        <div key={stat.label}>
          <div
            className={cn(
              'font-serif leading-none',
              onDark ? 'text-[#e2c690]' : 'text-brass2',
              isBand
                ? 'text-[clamp(3rem,6vw,4.6rem)]'
                : 'text-[clamp(2.4rem,4vw,3.2rem)]',
            )}
          >
            {stat.value}
          </div>
          <div
            className={cn(
              'mt-2 uppercase tracking-[0.24em]',
              onDark ? 'text-[rgba(243,237,226,0.6)]' : 'text-muted',
              isBand ? 'text-[11px]' : 'text-[10.5px]',
            )}
          >
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  )
}
