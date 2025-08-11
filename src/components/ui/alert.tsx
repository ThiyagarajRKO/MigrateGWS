/**
 * Spike-themed Alert Component
 * Based on the Spike Bootstrap Admin Dashboard design system
 */

import * as React from "react"
import { cn } from "../../lib/utils"
import { 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  X 
} from "lucide-react"

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info"
  title?: string
  dismissible?: boolean
  onDismiss?: () => void
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ 
    className, 
    variant = "default", 
    title, 
    dismissible = false,
    onDismiss,
    children, 
    ...props 
  }, ref) => {
    const variantStyles = {
      default: "bg-gray-50 border-gray-200 text-gray-800",
      success: "bg-success-50 border-success-200 text-success-800",
      warning: "bg-warning-50 border-warning-200 text-warning-800",
      danger: "bg-danger-50 border-danger-200 text-danger-800",
      info: "bg-info-50 border-info-200 text-info-800"
    }

    const iconStyles = {
      default: "text-gray-500",
      success: "text-success-500",
      warning: "text-warning-500", 
      danger: "text-danger-500",
      info: "text-info-500"
    }

    const icons = {
      default: Info,
      success: CheckCircle,
      warning: AlertTriangle,
      danger: AlertCircle,
      info: Info
    }

    const Icon = icons[variant]

    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-lg border p-4",
          variantStyles[variant],
          className
        )}
        {...props}
      >
        <div className="flex">
          <div className="flex-shrink-0">
            <Icon className={cn("h-5 w-5", iconStyles[variant])} />
          </div>
          <div className="ml-3 flex-1">
            {title && (
              <h3 className="text-sm font-medium mb-1">
                {title}
              </h3>
            )}
            <div className="text-sm">
              {children}
            </div>
          </div>
          {dismissible && onDismiss && (
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  type="button"
                  onClick={onDismiss}
                  className={cn(
                    "inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2",
                    iconStyles[variant],
                    "hover:bg-black hover:bg-opacity-10"
                  )}
                >
                  <span className="sr-only">Dismiss</span>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
)
Alert.displayName = "Alert"

export { Alert }
