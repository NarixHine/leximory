'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@repo/supabase/client'
import { User } from '@supabase/supabase-js'
import { useMediaQuery } from 'usehooks-ts'

export const useIsMobile = () => useMediaQuery('(max-width: 768px)')

export function useAuth() {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        // Initial check for the session
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
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
