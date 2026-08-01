import * as React from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { Plus } from '@phosphor-icons/react'

import { cn } from '@/lib/utils'

const Accordion = AccordionPrimitive.Root

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn('border-b border-line', className)}
    {...props}
  />
))
AccordionItem.displayName = 'AccordionItem'

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        'group flex flex-1 items-center justify-between gap-6 py-6 text-left font-serif text-[clamp(1.15rem,2.2vw,1.5rem)] text-cream transition-colors hover:text-brass2',
        className,
      )}
      {...props}
    >
      {children}
      <Plus
        size={20}
        weight="light"
        className="shrink-0 text-brass transition-transform duration-300 group-data-[state=open]:rotate-45"
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = 'AccordionTrigger'

/**
 * `forceMount` keeps every answer in the DOM even while collapsed, so the text
 * ships in the prerendered HTML — that is what answer engines and featured
 * snippets extract, and without it a collapsed FAQ ships zero indexable answers.
 *
 * The catch, and the reason this collapses in CSS rather than leaning on the
 * library: `forceMount` also disables Radix's own hiding. It computes
 * `isOpen = context.open || isPresent` and renders `hidden={!isOpen}`, and
 * forcing the mount pins `isPresent` true — so `hidden` is never applied and
 * every panel renders fully expanded while `data-state` still reads "closed"
 * (open answers under an unrotated `+`). The height keyframes can't hold the
 * closed state either: they're plain animations with no fill mode, so height
 * springs back to auto the moment they finish.
 *
 * So `data-state` drives a grid-template-rows collapse instead. It animates
 * to and from intrinsic height with no JS measurement and no dependence on
 * `--radix-accordion-content-height`, and it renders identically on the server
 * and the client's first paint, which keeps hydration intact.
 */
const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    forceMount
    className="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out data-[state=closed]:grid-rows-[0fr] data-[state=open]:grid-rows-[1fr]"
    {...props}
  >
    <div className="min-h-0 overflow-hidden">
      <div className={cn('max-w-[62ch] pb-7 text-[15px] font-light leading-[1.8] text-muted', className)}>
        {children}
      </div>
    </div>
  </AccordionPrimitive.Content>
))
AccordionContent.displayName = 'AccordionContent'

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
