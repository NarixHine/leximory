import '../global.css'
import { HeroUINativeProvider } from 'heroui-native'
import type { HeroUINativeConfig } from 'heroui-native'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trpc, trpcConfig } from '@/lib/trpc'
import { useState } from 'react'
import { Provider as JotaiProvider } from 'jotai'

const heroUIConfig: HeroUINativeConfig = {
  textProps: {
    minimumFontScale: 0.5,
    maxFontSizeMultiplier: 1.5,
  },
  toast: {
    placement: 'top',
    variant: 'default',
    maxVisibleToasts: 3,
  },
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() => trpc.createClient(trpcConfig))

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <JotaiProvider>
            <HeroUINativeProvider config={heroUIConfig}>
              <Stack>
                <Stack.Screen name="index" options={{ title: '猫谜' }} />
                <Stack.Screen name="paper/[id]" options={{ title: 'Paper' }} />
              </Stack>
            </HeroUINativeProvider>
          </JotaiProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  )
}

