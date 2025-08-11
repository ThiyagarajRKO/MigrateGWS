/**
 * Spike-themed Progress Component
 * Based on the Spike Bootstrap Admin Dashboard design system
 */

import * as React from "react"
import { cn } from "../../lib/utils"

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
  variant?: "default" | "success" | "warning" | "danger"
  size?: "sm" | "default" | "lg"
  showLabel?: boolean
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ 
    className, 
    value = 0, 
    max = 100, 
    variant = "default", 
    size = "default",
    showLabel = false,
    ...props 
  }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

    const variantStyles = {
      default: "bg-primary-500",
      success: "bg-success-500",
      warning: "bg-warning-500", 
      danger: "bg-danger-500"
    }

    const sizeStyles = {
      sm: "h-1",
      default: "h-2",
      lg: "h-3"
    }

    return (
      <div 
        ref={ref}
        className={cn(
          "w-full bg-gray-200 rounded-full overflow-hidden",
          sizeStyles[size],
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full transition-all duration-300 ease-in-out rounded-full",
            variantStyles[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
        {showLabel && (
          <div className="mt-1 text-sm text-gray-600 text-center">
            {Math.round(percentage)}%
          </div>
        )}
      </div>
    )
  }
)
Progress.displayName = "Progress"

export { Progress }
