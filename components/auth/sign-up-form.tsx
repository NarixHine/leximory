'use client'

import { cn } from '@/lib/utils'
import { Button } from '@heroui/button'
import { Input } from '@heroui/input'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { SIGN_IN_URL } from '@/lib/config'
import { PiEnvelopeSimple, PiLockKey } from 'react-icons/pi'
import H from '../ui/h'
import { signup } from './actions'

export function SignUpForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, startTransition] = useTransition()

  return <div className={cn('w-full h-full max-w-sm flex flex-col gap-6 prose dark:prose-invert', className)} {...props}>
    <H className='mb-1 text-3xl'>开始语言学习之旅</H>
    <form action={() => {
      startTransition(() => signup({ email, password }))
    }} className='space-y-4'>
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
          name='password'
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
          name='confirm-password'
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
