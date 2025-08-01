'use client'

import { useEffect, useState } from 'react'

/**
 * Hook to prevent hydration mismatches by ensuring components
 * only render on the client side after initial hydration
 */
export function useIsClient() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  return isClient
}

/**
 * Component wrapper that only renders children after client-side hydration
 */
interface ClientOnlyProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const isClient = useIsClient()

  if (!isClient) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

export default ClientOnly
