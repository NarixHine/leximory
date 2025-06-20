'use client'

import { cn } from '@/lib/utils'
import { createClient } from '@/server/client/supabase/client'
import { Button } from '@heroui/button'
import { Input } from '@heroui/input'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { SIGN_IN_URL } from '@/lib/config'
import { toast } from 'sonner'
import { PiEnvelopeSimple, PiLockKey } from 'react-icons/pi'
import H from '../ui/h'

export function SignUpForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    if (password !== confirmPassword) {
      toast.error('两次输入的密码不一致')
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
      toast.success('请查收邮箱以确认账号！')
      setTimeout(() => router.push(SIGN_IN_URL), 2000)
    } catch {
      toast.error('发生错误')
    } finally {
      setIsLoading(false)
    }
  }

  return <div className={cn('w-full h-full max-w-sm flex flex-col gap-6', className)} {...props}>
    <H className='mb-1 text-3xl'>欢迎加入 Leximory！</H>
    <form onSubmit={handleSignUp} className='space-y-4'>
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
      <div className='space-y-1'>
        <label htmlFor='password' className='text-sm font-medium leading-none'>密码</label>
        <Input
          id='password'
          type='password'
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className='h-10'
          startContent={<PiLockKey className='text-xl text-muted-foreground' />}
        />
      </div>
      <div className='space-y-1'>
        <label htmlFor='confirm-password' className='text-sm font-medium leading-none'>确认密码</label>
        <Input
          id='confirm-password'
          type='password'
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className='h-10'
          startContent={<PiLockKey className='text-xl text-muted-foreground' />}
        />
      </div>
      <Button type='submit' className='w-full h-10' isLoading={isLoading} color='primary'>
        {isLoading ? '注册中…' : '注册'}
      </Button>
      <div className='text-center text-sm'>
        已有账号？{' '}
        <Link href={SIGN_IN_URL} className='text-primary hover:underline'>登录</Link>
      </div>
    </form>
  </div>
} 