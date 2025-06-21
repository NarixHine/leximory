'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/server/client/supabase/client'
import { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Initial check for the session
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Error getting session:', error.message)
      }
      setUser(session?.user || null)
      setIsLoading(false)
    }

    checkSession()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null)
        setIsLoading(false) // Ensure loading is false after any auth event
      }
    )

    // Clean up the subscription on component unmount
    return () => {
      subscription?.unsubscribe()
    }
  }, [supabase]) // Re-run effect if supabase client changes (shouldn't typically happen)

  return { user, isLoading }
}

export const useIsMobileIos = () => {
    const { navigator } = globalThis
    if (!navigator)
        return false
    const userAgent = navigator.userAgent.toLowerCase()
    return /iphone|ipad|ipod|macintosh|safari/.test(userAgent) && !/chrome/.test(userAgent) && !/android/.test(userAgent)
}

export const useOnWindowResize = (handler: { (): void }) => {
    useEffect(() => {
        const handleResize = () => {
            handler()
        }
        handleResize()
        window.addEventListener("resize", handleResize)

        return () => window.removeEventListener("resize", handleResize)
    }, [handler])
}
