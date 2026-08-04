import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CaretDown, Check } from '@phosphor-icons/react'

import { cn } from '@/lib/utils'

/**
 * The site's dropdowns. Nothing here uses a native `<select>` or `<datalist>`.
 *
 * The native controls were dropped on purpose: their popup is drawn by the OS,
 * so it ignores the theme entirely — a cream-on-panel panel everywhere else and
 * a stark system menu the moment you click a filter, white-on-white under the
 * dark theme on some browsers, and unstylable rows that can't carry a count or
 * a tick. `<datalist>` is worse: no keyboard model worth the name, no control
 * over what matches, and Safari renders it as nothing at all.
 *
 * What that costs is the behaviour the OS gave us free, so it is all built back
 * here rather than left out:
 *  - full keyboard model (arrows, Home/End, Enter, Escape, Tab, type-ahead),
 *  - the listbox ARIA pattern with `aria-activedescendant`, so focus never
 *    leaves the trigger and Tab still does the obvious thing,
 *  - a portal to `document.body`, because every one of these sits inside a
 *    scrolling panel or an `overflow-hidden` card that would clip it,
 *  - flip-up placement when the trigger is near the bottom of the window.
 */

export type SelectOption<T extends string> = {
  value: T
  label: string
  /** Trailing secondary text, e.g. a filter's count. */
  hint?: string
}

/*
 * `useLayoutEffect` warns when React renders on the server, and the contact
 * page is prerendered. Nothing here runs before the popup opens, which can only
 * happen in a browser, so falling back to `useEffect` on the server costs
 * nothing and keeps the prerender output clean.
 */
const useLayout = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** Fixed-position box for a popup anchored to `anchor`, kept in step while open. */
const useAnchoredBox = (anchor: React.RefObject<HTMLElement | null>, open: boolean) => {
  const [box, setBox] = useState<{
    left: number
    width: number
    top?: number
    bottom?: number
    maxHeight: number
  } | null>(null)

  const place = useCallback(() => {
    const el = anchor.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const below = window.innerHeight - r.bottom - 12
    const above = r.top - 12
    // Only flip when there genuinely isn't room below, so the menu doesn't
    // jump sides between two similar-looking triggers on the same screen.
    const up = below < 200 && above > below
    setBox({
      left: r.left,
      width: r.width,
      top: up ? undefined : r.bottom + 4,
      bottom: up ? window.innerHeight - r.top + 4 : undefined,
      maxHeight: Math.max(132, Math.min(300, up ? above : below)),
    })
  }, [anchor])

  useLayout(() => {
    if (!open) return
    place()
    // `true` catches scrolls in the admin's inner panes, which don't bubble.
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, place])

  return box
}

const menuClass =
  'z-50 overflow-y-auto overscroll-contain rounded-md border border-line bg-panel py-1 shadow-xl'

const optionClass = (active: boolean) =>
  cn(
    'flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-[13px] transition-colors',
    active ? 'bg-brass/15 text-brass2' : 'text-cream',
  )

/** Type-ahead: letters typed in quick succession jump to a matching label. */
const useTypeahead = () => {
  const buffer = useRef('')
  const timer = useRef<number | null>(null)
  return (key: string, labels: string[], from: number) => {
    if (key.length !== 1 || key === ' ') return -1
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => (buffer.current = ''), 600)
    buffer.current += key.toLowerCase()
    const start = buffer.current.length === 1 ? from + 1 : from
    for (let i = 0; i < labels.length; i++) {
      const at = (start + i + labels.length) % labels.length
      if (labels[at].toLowerCase().startsWith(buffer.current)) return at
    }
    return -1
  }
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  className,
  placeholder = 'Select',
  disabled,
  id,
  name,
  ariaLabel,
}: {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  id?: string
  /** Renders a hidden input, for the rare form that posts natively. */
  name?: string
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const rows = useRef<(HTMLDivElement | null)[]>([])
  const box = useAnchoredBox(trigger, open)
  const typeahead = useTypeahead()

  const listId = useId()
  const optionId = (i: number) => `${listId}-o${i}`
  const selected = options.findIndex((o) => o.value === value)
  const current = selected >= 0 ? options[selected] : null

  const show = () => {
    if (disabled) return
    setActive(selected >= 0 ? selected : 0)
    setOpen(true)
  }

  const choose = (i: number) => {
    const option = options[i]
    if (option) onChange(option.value)
    setOpen(false)
    trigger.current?.focus()
  }

  // Pointer, not click: closing on mousedown matches every other menu, and a
  // click listener would fire after the next control has already been pressed.
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      const target = e.target as Node
      if (trigger.current?.contains(target) || list.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  useEffect(() => {
    if (open) rows.current[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = options.length - 1
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        show()
        return
      }
      // Typing with the menu shut picks straight away, as a native select does.
      const hit = typeahead(e.key, options.map((o) => o.label), selected)
      if (hit >= 0) {
        e.preventDefault()
        onChange(options[hit].value)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive((i) => (i >= last ? 0 : i + 1))
        return
      case 'ArrowUp':
        e.preventDefault()
        setActive((i) => (i <= 0 ? last : i - 1))
        return
      case 'Home':
        e.preventDefault()
        setActive(0)
        return
      case 'End':
        e.preventDefault()
        setActive(last)
        return
      case 'Enter':
      case ' ':
        e.preventDefault()
        choose(active)
        return
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        return
      case 'Tab':
        // No preventDefault: Tab should close this and move on, not be eaten.
        setOpen(false)
        return
      default: {
        const hit = typeahead(e.key, options.map((o) => o.label), active)
        if (hit >= 0) {
          e.preventDefault()
          setActive(hit)
        }
      }
    }
  }

  return (
    <>
      <button
        type="button"
        ref={trigger}
        id={id}
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? optionId(active) : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={cn(
          'flex w-full items-center justify-between gap-2 text-left disabled:opacity-50',
          className,
        )}
      >
        <span className={cn('truncate', !current && 'text-muted')}>
          {current?.label ?? placeholder}
        </span>
        <CaretDown
          size={12}
          weight="bold"
          aria-hidden
          className={cn('shrink-0 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {name && <input type="hidden" name={name} value={value} />}

      {open &&
        box &&
        createPortal(
          <div
            ref={list}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            style={{
              position: 'fixed',
              left: box.left,
              width: box.width,
              top: box.top,
              bottom: box.bottom,
              maxHeight: box.maxHeight,
            }}
            className={menuClass}
          >
            {options.map((o, i) => (
              <div
                key={o.value}
                id={optionId(i)}
                role="option"
                aria-selected={o.value === value}
                ref={(el) => {
                  rows.current[i] = el
                }}
                onMouseMove={() => setActive(i)}
                onClick={() => choose(i)}
                className={optionClass(i === active)}
              >
                <span className="truncate">{o.label}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {o.hint && (
                    <span
                      className={cn(
                        'text-[12px] tabular-nums',
                        i === active ? 'text-brass2/80' : 'text-muted',
                      )}
                    >
                      {o.hint}
                    </span>
                  )}
                  <Check
                    size={13}
                    weight="bold"
                    aria-hidden
                    className={cn(o.value === value ? 'opacity-100' : 'opacity-0')}
                  />
                </span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}

/**
 * An input that suggests, but takes anything typed. Replaces `<datalist>`.
 *
 * Used where the list is CMS-editable and old rows keep values that were since
 * renamed or removed: the suggestions are a convenience, never a constraint.
 */
export const SuggestInput = ({
  value,
  onChange,
  suggestions,
  className,
  id,
  placeholder,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  className?: string
  id?: string
  placeholder?: string
  ariaLabel?: string
}) => {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const rows = useRef<(HTMLDivElement | null)[]>([])
  const box = useAnchoredBox(input, open)

  const listId = useId()
  const optionId = (i: number) => `${listId}-o${i}`
  // Substring, not prefix: "reception" should find "Wedding reception".
  const query = value.trim().toLowerCase()
  const matches = suggestions.filter((s) => !query || s.toLowerCase().includes(query))
  const shown = open && matches.length > 0

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      const target = e.target as Node
      if (input.current?.contains(target) || list.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  useEffect(() => {
    if (shown && active >= 0) rows.current[active]?.scrollIntoView({ block: 'nearest' })
  }, [shown, active])

  const pick = (s: string) => {
    onChange(s)
    setOpen(false)
    setActive(-1)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && !open) {
      setOpen(true)
      setActive(0)
      e.preventDefault()
      return
    }
    if (!shown) return
    const last = matches.length - 1
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive((i) => (i >= last ? 0 : i + 1))
        return
      case 'ArrowUp':
        e.preventDefault()
        setActive((i) => (i <= 0 ? last : i - 1))
        return
      case 'Enter':
        // Only swallow Enter when a suggestion is highlighted; otherwise the
        // form should submit as it would from any other field.
        if (active >= 0) {
          e.preventDefault()
          pick(matches[active])
        }
        return
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        setActive(-1)
        return
      case 'Tab':
        setOpen(false)
        return
    }
  }

  return (
    <>
      <input
        ref={input}
        id={id}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={shown ? listId : undefined}
        aria-activedescendant={shown && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={className}
      />

      {shown &&
        box &&
        createPortal(
          <div
            ref={list}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            style={{
              position: 'fixed',
              left: box.left,
              width: box.width,
              top: box.top,
              bottom: box.bottom,
              maxHeight: box.maxHeight,
            }}
            className={menuClass}
          >
            {matches.map((s, i) => (
              <div
                key={s}
                id={optionId(i)}
                role="option"
                aria-selected={s === value}
                ref={(el) => {
                  rows.current[i] = el
                }}
                onMouseMove={() => setActive(i)}
                onClick={() => pick(s)}
                className={optionClass(i === active)}
              >
                <span className="truncate">{s}</span>
                {s === value && <Check size={13} weight="bold" aria-hidden />}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
