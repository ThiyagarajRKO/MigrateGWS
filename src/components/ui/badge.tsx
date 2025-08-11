/**
 * Spike-themed Badge Component
 * Based on the Spike Bootstrap Admin Dashboard design system
 */

import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'outline'
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const variants = {
      primary: "spike-badge-primary",
      secondary: "spike-badge bg-gray-100 text-gray-800",
      success: "spike-badge-success",
      warning: "spike-badge-warning",
      danger: "spike-badge-danger",
      info: "spike-badge bg-info-100 text-info-800",
      outline: "spike-badge border border-gray-300 text-gray-700 bg-transparent"
    }

    return (
      <div
        ref={ref}
        className={cn(variants[variant], className)}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge }
