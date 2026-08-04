import { MagnifyingGlass, X } from '@phosphor-icons/react'

/**
 * Search + filter toolbar that sits directly above a list rail.
 *
 * It lives here rather than in the page header for one reason: filters belong
 * next to the thing they filter. Floated into the top-right corner they read as
 * page furniture, and with two groups stacked there it was never obvious which
 * row did what, or that any of it was clickable at all.
 *
 * Each option carries its own count, so you can see there are no cancelled
 * bookings without clicking Cancelled to find an empty list.
 */

export type FilterOption<T extends string> = {
  value: T
  label: string
  count: number
}

const optionClass = (active: boolean) =>
  `rounded-md border px-2 py-1 text-[12px] font-medium capitalize transition-colors ${
    active
      ? 'border-brass/50 bg-brass/15 text-brass2'
      : 'border-transparent text-muted hover:bg-panel2/70 hover:text-cream'
  }`

export function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: FilterOption<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-0.5 w-[52px] shrink-0 text-[11px] font-medium text-muted/70">
        {label}
      </span>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={optionClass(value === o.value)}
        >
          {o.label}
          {/* Zero counts stay visible but recede — "Cancelled 0" is information,
              and hiding the option entirely would make the row jump around. */}
          <span className={`ml-1 tabular-nums ${o.count === 0 ? 'opacity-40' : 'opacity-60'}`}>
            {o.count}
          </span>
        </button>
      ))}
    </div>
  )
}

export const SearchBox = ({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) => (
  <div className="relative">
    <MagnifyingGlass
      size={15}
      aria-hidden
      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
    />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-full rounded-md border border-line bg-panel/30 py-1.5 pl-8 pr-8 text-[13px] text-cream outline-none transition-colors placeholder:text-muted/60 focus:border-brass focus:bg-panel/60 focus:ring-2 focus:ring-brass/25"
    />
    {value && (
      <button
        onClick={() => onChange('')}
        aria-label="Clear search"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-cream"
      >
        <X size={13} />
      </button>
    )}
  </div>
)

/** Wrapper: the bar itself, plus the result line and a reset when it's narrowed. */
export const FilterBar = ({
  children,
  showing,
  total,
  active,
  onReset,
}: {
  children: React.ReactNode
  showing: number
  total: number
  active: boolean
  onReset: () => void
}) => (
  <div className="space-y-2 border-b border-line px-4 py-3">
    {children}
    <div className="flex items-center justify-between gap-2 pt-0.5 text-[12px] text-muted">
      <span>
        {active ? `${showing} of ${total}` : `${total} total`}
      </span>
      {active && (
        <button
          onClick={onReset}
          className="font-medium text-brass2 transition-colors hover:text-brass"
        >
          Reset
        </button>
      )}
    </div>
  </div>
)
