import { CaretDown, MagnifyingGlass, X } from '@phosphor-icons/react'

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

/**
 * A native `<select>`, not a custom popup.
 *
 * The segmented row this replaced grew with the option list — five booking
 * statuses next to four payment ones filled the whole bar and still didn't read
 * as controls. A dropdown states the *current* filter in one place and hides
 * the rest until asked, which is what a filter should do.
 *
 * Native because it gets keyboard handling, type-ahead, mobile pickers and
 * labelling for free, and because the option popup is drawn by the OS — no
 * portal, no outside-click handling, nothing to escape an `overflow` ancestor.
 * The trade is that the popup ignores most styling, so the only colours set on
 * `<option>` are a solid background and text: left to inherit, several browsers
 * render the list light-on-light under the dark theme.
 */
const selectClass =
  'w-full appearance-none rounded-md border border-line bg-panel/30 py-1.5 pl-2.5 pr-7 text-[12px] font-medium text-cream outline-none transition-colors hover:border-brass/40 focus:border-brass focus:bg-panel/60 focus:ring-2 focus:ring-brass/25 [&>option]:bg-panel [&>option]:text-cream'

/** Options come through lowercase (`'all'`, `'booked'`); `capitalize` doesn't
 *  reach into a native option list, so do it in the string. */
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

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
    <label className="flex min-w-[172px] max-w-[280px] flex-1 items-center gap-2">
      <span className="shrink-0 text-[11px] font-medium text-muted/70">{label}</span>
      {/* The caret is absolute inside this wrapper, so the width has to be set
          here — `selectClass` carries `w-full` and would win over any width
          appended to it. */}
      <div className="relative min-w-0 flex-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className={selectClass}
        >
          {options.map((o) => (
            // Zero counts stay listed — "Cancelled (0)" is information, and
            // dropping the option would hide a status that exists.
            <option key={o.value} value={o.value}>
              {titleCase(o.label)} ({o.count})
            </option>
          ))}
        </select>
        <CaretDown
          size={12}
          weight="bold"
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
        />
      </div>
    </label>
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

/**
 * Wrapper: the bar itself, plus the result line and a reset when it's narrowed.
 *
 * `row` is for a bar above a full-width list rather than a narrow rail — the
 * groups sit on one line with the count at the far end, instead of stacking and
 * wrapping every option onto its own row.
 */
export const FilterBar = ({
  children,
  showing,
  total,
  active,
  onReset,
  row = false,
}: {
  children: React.ReactNode
  showing: number
  total: number
  active: boolean
  onReset: () => void
  row?: boolean
}) => {
  const count = (
    <>
      <span>{active ? `${showing} of ${total}` : `${total} total`}</span>
      {active && (
        <button
          onClick={onReset}
          className="font-medium text-brass2 transition-colors hover:text-brass"
        >
          Reset
        </button>
      )}
    </>
  )

  if (row) {
    return (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-8 py-3">
        {children}
        <div className="ml-auto flex items-center gap-3 text-[12px] text-muted">{count}</div>
      </div>
    )
  }

  return (
    <div className="space-y-2 border-b border-line px-4 py-3">
      {children}
      <div className="flex items-center justify-between gap-2 pt-0.5 text-[12px] text-muted">
        {count}
      </div>
    </div>
  )
}
