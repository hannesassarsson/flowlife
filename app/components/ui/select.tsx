import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Deliberately a styled native <select>, not Radix UI Select. The full
 * shadcn Select primitive is the right long-term choice (keyboard nav,
 * custom positioning, etc.) but pulls in @radix-ui/react-select as a new
 * dependency for a single status/assignee dropdown. For a same-day
 * vertical slice, a native select with matching visual treatment gets
 * the same job done with zero extra setup. Swap in the real primitive
 * when the UI layer gets a proper pass.
 */
function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="select"
      className={cn(
        'h-9 rounded-sm border border-line bg-paper px-2 text-sm outline-none focus-visible:border-ink disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export { Select }
