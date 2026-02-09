'use client'

import { HeroUIProvider } from '@heroui/system'
import { useRouter } from 'next/navigation'
import { ThemeProvider, type ThemeProviderProps } from 'next-themes'
import { ReactNode, useState } from 'react'
import { Provider as JotaiProvider } from 'jotai'
import { Toaster } from 'sonner'
import { cn } from '@heroui/theme'
import { AuthProvider } from '@repo/ui/auth'
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/next'
import { trpc, trpcConfig } from '@/lib/trpc'

export interface ProvidersProps {
  children: ReactNode
  themeProps?: ThemeProviderProps
}

export function Providers({ children, themeProps }: ProvidersProps) {
  const router = useRouter()
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() => trpc.createClient(trpcConfig))

  return (
    <AuthProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <NuqsAdapter>
            <HeroUIProvider navigate={router.push}>
              <ThemeProvider {...themeProps}>
                <JotaiProvider>
                  <Toaster toastOptions={{
                    classNames: {
                      toast: cn(
                        'font-ui! pl-5! text-default-900! bg-default-100/80!',
                        'border-0! shadow-none!',
                        'backdrop-blur-lg! backdrop-saturate-150!',
                      )
                    },
                  }}></Toaster>
                  {children}
                </JotaiProvider>
              </ThemeProvider>
            </HeroUIProvider>
          </NuqsAdapter>
        </QueryClientProvider>
      </trpc.Provider>
    </AuthProvider>
  )
}
