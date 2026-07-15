import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-2.5 overflow-hidden whitespace-nowrap font-medium uppercase tracking-[0.2em] no-underline transition-all duration-300 ease-out cursor-pointer active:scale-[0.97] active:duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brass',
  {
    variants: {
      variant: {
        brass:
          'btn-shine bg-brass text-onbrass hover:-translate-y-0.5 hover:bg-brass2 hover:shadow-[0_16px_36px_-10px_rgba(201,168,106,0.6)]',
        outline:
          'border border-[var(--btn-outline)] text-cream hover:-translate-y-0.5 hover:border-brass hover:text-brass2 hover:shadow-[0_12px_28px_-10px_rgba(0,0,0,0.35)]',
        ghost:
          'border border-line text-brass2 hover:-translate-y-0.5 hover:border-brass hover:text-brass hover:shadow-[0_12px_28px_-10px_rgba(201,168,106,0.3)]',
      },
      size: {
        default: 'px-[34px] py-[17px] text-xs',
        lg: 'px-[38px] py-[18px] text-xs',
        sm: 'px-6 py-3 text-[11px]',
      },
    },
    defaultVariants: {
      variant: 'brass',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
