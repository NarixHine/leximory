'use client'

import { cn } from '@/lib/utils'
import { createClient } from '@/server/client/supabase/client'
import { Button } from '@heroui/button'
import { Card, CardBody, CardHeader } from '@heroui/card'
import { Input } from '@heroui/input'
import Link from 'next/link'
import { useState } from 'react'
import { SIGN_IN_URL } from '@/lib/config'

export function ForgotPasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    const supabase = createClient()
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
      setSuccess('Password reset email sent!')
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
          <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleForgotPassword} className="space-y-4">
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
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
            )}
            {success && (
              <div className="rounded-md bg-success/15 p-3 text-sm text-success">{success}</div>
            )}
            <Button type="submit" className="w-full h-10" disabled={isLoading} color="primary">
              {isLoading ? 'Sending...' : 'Send reset link'}
            </Button>
            <div className="text-center text-sm">
              <Link href={SIGN_IN_URL} className="text-primary hover:underline">Back to login</Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
} 