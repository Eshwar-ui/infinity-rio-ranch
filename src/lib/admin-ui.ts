/**
 * Shared class strings for the admin panel.
 *
 * Every admin page had its own copy of `field` and `label`, which is how they
 * drifted apart. One definition each, imported everywhere, so a change to the
 * input style is a change in one place.
 *
 * Two rules the old styling broke and this restores:
 *  - Nothing structural is set in ALL CAPS with wide tracking. That treatment
 *    is branding from the public site; on a form label it costs legibility for
 *    no gain. `eyebrow` keeps it for the rare section marker.
 *  - Interactive things have a visible focus ring. The panel is keyboard-driven
 *    (tab through a lead, tab through an invoice) and a brass border alone was
 *    almost invisible against the dark theme.
 */

/** Text input, textarea, and the trigger of a `<Select>` / `<SuggestInput>`. */
export const field =
  'w-full rounded-md border border-line bg-panel/30 px-3 py-2 text-[14px] leading-normal text-cream outline-none transition-colors placeholder:text-muted/50 focus:border-brass focus:bg-panel/60 focus:ring-2 focus:ring-brass/25'

/** Label above a field. */
export const label = 'mb-1.5 block text-[12px] font-medium text-muted'

/** Helper text under a field. */
export const hint = 'mt-1.5 text-[12px] leading-relaxed text-muted/80'

/** Primary action — one per view. */
export const btnPrimary =
  'inline-flex min-h-10 items-center justify-center rounded-md border border-brass bg-brass px-4 py-2 text-[13px] font-semibold text-onbrass shadow-[0_2px_0_rgba(0,0,0,0.3),0_5px_12px_rgba(0,0,0,0.16)] transition-all hover:-translate-y-px hover:bg-brass2 hover:shadow-[0_3px_0_rgba(0,0,0,0.3),0_8px_16px_rgba(0,0,0,0.2)] active:translate-y-0 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:opacity-50'

/** Secondary action. */
export const btnGhost =
  'inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-panel2/80 px-4 py-2 text-[13px] font-semibold text-cream shadow-[0_2px_0_rgba(0,0,0,0.25),0_4px_10px_rgba(0,0,0,0.12)] transition-all hover:-translate-y-px hover:border-brass hover:bg-panel hover:text-brass2 active:translate-y-0 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/40 disabled:opacity-50'

/** Tertiary / inline action — no chrome until hovered. */
export const btnQuiet =
  'inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-panel/70 px-4 py-2 text-[13px] font-semibold text-cream shadow-[0_2px_0_rgba(0,0,0,0.2),0_3px_8px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-px hover:border-brass/60 hover:bg-panel2 hover:text-brass2 active:translate-y-0 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/40 disabled:opacity-50'

/** Destructive inline action. */
export const btnDanger =
  'inline-flex min-h-10 items-center justify-center rounded-md border border-[#e0916f]/45 bg-[#e0916f]/10 px-4 py-2 text-[13px] font-semibold text-[#eeb099] shadow-[0_2px_0_rgba(0,0,0,0.2),0_3px_8px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-px hover:border-[#e0916f] hover:bg-[#e0916f]/20 active:translate-y-0 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e0916f]/40'

/** Compact raised control for action rows and inline toolbars. */
export const btnSmall =
  'inline-flex min-h-8 items-center justify-center rounded-md border border-line bg-panel2/80 px-2.5 py-1 text-[12px] font-semibold text-cream shadow-[0_1px_0_rgba(0,0,0,0.25),0_2px_6px_rgba(0,0,0,0.12)] transition-all hover:-translate-y-px hover:border-brass hover:bg-panel hover:text-brass2 active:translate-y-0 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/40 disabled:opacity-50'

/**
 * Icon-only action. ALWAYS pass an `aria-label` and a `title` — the icon is the
 * whole control, so without them it is unusable by screen reader and ambiguous
 * to everyone else. Sized to a 30px hit area, the floor for a comfortable click.
 */
export const iconBtn =
  'grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2/80 text-muted shadow-[0_2px_0_rgba(0,0,0,0.2),0_3px_8px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-px hover:border-brass hover:bg-panel hover:text-cream active:translate-y-0 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/40'

/** Icon-only destructive action. Same rules. */
export const iconBtnDanger =
  'grid h-10 w-10 place-items-center rounded-md border border-[#e0916f]/35 bg-[#e0916f]/10 text-[#eeb099] shadow-[0_2px_0_rgba(0,0,0,0.2),0_3px_8px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-px hover:border-[#e0916f] hover:bg-[#e0916f]/20 active:translate-y-0 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e0916f]/40'

/** Page heading in a view's top bar. */
export const pageTitle = 'text-[22px] font-semibold tracking-[-0.01em] text-cream'

/** Heading for a block within a page. */
export const sectionTitle = 'text-[15px] font-semibold tracking-[-0.005em] text-cream'

/** Small caps marker. Use sparingly — see the note above. */
export const eyebrow = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-muted/70'

/** Status tag. Combine with a colour class per status. */
export const pill =
  'inline-flex rounded-full border bg-panel/70 px-2.5 py-0.5 text-[11px] font-medium capitalize shadow-[0_1px_0_rgba(0,0,0,0.2),0_2px_5px_rgba(0,0,0,0.1)]'

/** Segmented filter button; pass `true` for the selected one. */
export const chip = (active: boolean) =>
  `inline-flex min-h-8 items-center justify-center rounded-md border px-2.5 py-1 text-[12px] font-semibold shadow-[0_1px_0_rgba(0,0,0,0.2),0_2px_6px_rgba(0,0,0,0.1)] transition-all active:translate-y-px active:shadow-none ${
    active
      ? 'border-brass/60 bg-brass/20 text-brass2'
      : 'border-line bg-panel2/70 text-muted hover:-translate-y-px hover:border-brass/50 hover:bg-panel hover:text-cream'
  }`

/** Bordered container for a group of related facts. */
export const card = 'rounded-lg border border-line bg-panel/30'

/** Table header cell. */
export const th = 'py-2.5 text-left text-[12px] font-medium text-muted'
