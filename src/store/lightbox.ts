import { create } from 'zustand'

export type LightboxItem = { src: string; label: string }

type LightboxState = {
  items: LightboxItem[]
  index: number | null
  /** Open the lightbox over a specific list at position `index`. */
  open: (items: LightboxItem[], index: number) => void
  close: () => void
  next: () => void
  prev: () => void
}

/**
 * Lightbox navigates whatever list it was opened with (a filtered grid, the
 * carousel, etc.) and wraps around. It holds the items itself, so it no longer
 * depends on any static gallery array — the gallery can be fully dynamic.
 */
export const useLightboxStore = create<LightboxState>((set) => ({
  items: [],
  index: null,
  open: (items, index) => set({ items, index }),
  close: () => set({ index: null }),
  next: () =>
    set((s) =>
      s.index === null || s.items.length === 0
        ? s
        : { index: (s.index + 1) % s.items.length },
    ),
  prev: () =>
    set((s) =>
      s.index === null || s.items.length === 0
        ? s
        : { index: (s.index - 1 + s.items.length) % s.items.length },
    ),
}))
