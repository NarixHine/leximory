'use client'

import { cn } from '@/lib/utils'
import { createClient } from '@/server/client/supabase/client'
import { Button } from '@heroui/button'
import {
  Card,
  CardBody,
  CardHeader,
} from '@heroui/card'
import { Input } from '@heroui/input'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      router.push('/library')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn('flex min-h-[80vh] items-center justify-center', className)} {...props}>
      <Card className="w-96 p-3" shadow="sm">
        <CardHeader className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label 
                htmlFor="email" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label 
                  htmlFor="password" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Password
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10"
              />
            </div>
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button 
              type="submit" 
              className="w-full h-10" 
              disabled={isLoading}
              color="primary"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
            <div className="text-center text-sm">
              Don&apos;t have an account?{' '}
              <Link 
                href="/auth/sign-up" 
                className="text-primary hover:underline"
              >
                Sign up
              </Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}