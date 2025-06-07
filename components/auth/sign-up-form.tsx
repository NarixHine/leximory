'use client'

import { cn } from '@/lib/utils'
import { createClient } from '@/server/client/supabase/client'
import { Button } from '@heroui/button'
import { Card, CardBody, CardHeader } from '@heroui/card'
import { Input } from '@heroui/input'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { SIGN_IN_URL } from '@/lib/config'
import { toast } from 'sonner'

export function SignUpForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }
    const supabase = createClient()
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })
      if (error) {
        toast.error(error.message)
        throw error
      }
      setSuccess('Check your email to confirm your account!')
      setTimeout(() => router.push(SIGN_IN_URL), 2000)
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
          <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium leading-none">Email</label>
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
              <label htmlFor="password" className="text-sm font-medium leading-none">Password</label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirm-password" className="text-sm font-medium leading-none">Confirm Password</label>
              <Input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-10"
              />
            </div>
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
            )}
            {success && (
              <div className="rounded-md bg-success/15 p-3 text-sm text-success">{success}</div>
            )}
            <Button type="submit" className="w-full h-10" disabled={isLoading} color="primary">
              {isLoading ? 'Signing up...' : 'Sign up'}
            </Button>
            <div className="text-center text-sm">
              Already have an account?{' '}
              <Link href={SIGN_IN_URL} className="text-primary hover:underline">Sign in</Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
} 