'use client'

import { cn } from '@/lib/utils'
import { createClient } from '@/server/client/supabase/client'
import { Button } from '@heroui/button'
import { Input } from '@heroui/input'
import Link from 'next/link'
import { useState } from 'react'
import { prefixUrl, SIGN_IN_URL } from '@/lib/config'
import { PiEnvelopeSimple } from 'react-icons/pi'
import H from '../ui/h'
import { toast } from 'sonner'

export function ForgotPasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: prefixUrl('/update-password'),
      })
      if (error) throw error
      toast.success('重置密码邮件已发送！')
    } catch {
      toast.error('发生错误')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn('w-full h-full max-w-sm flex flex-col gap-6 prose', className)} {...props}>
      <H className='mb-1 text-3xl'>找回密码</H>
      <form onSubmit={handleForgotPassword} className='space-y-4'>
        <div className='space-y-1'>
          <label htmlFor='email' className='text-sm font-medium leading-none'>邮箱</label>
          <Input
            id='email'
            type='email'
            placeholder='yourname@example.com'
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className='h-10'
            startContent={<PiEnvelopeSimple className='text-xl text-muted-foreground' />}
          />
        </div>
        <Button type='submit' className='w-full h-10' isLoading={isLoading} color='primary'>
          {isLoading ? '发送中…' : '发送重置链接'}
        </Button>
        <div className='text-center text-sm'>
          <Link href={SIGN_IN_URL} className='text-primary hover:underline'>返回登录</Link>
        </div>
      </form>
    </div>
  )
} 
