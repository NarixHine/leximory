import { httpBatchLink } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@repo/service/trpc'

export const trpc = createTRPCReact<AppRouter>()

// For local development, you'll need to use your local IP address
// For production, use your backend URL
function getBaseUrl() {
  // In React Native, we need to use the full URL
  // For development with Expo, use your computer's IP address
  // Example: 'http://192.168.1.100:3002'
  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3002'
  return API_URL
}

export const trpcConfig = {
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
    }),
  ],
}
