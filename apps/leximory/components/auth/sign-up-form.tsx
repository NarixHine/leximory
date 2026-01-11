'use client'

import { cn } from '@/lib/utils'
import { Button } from '@heroui/button'
import { Input } from '@heroui/input'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { SIGN_IN_URL } from '@repo/env/config'
import { PiEnvelopeSimple, PiPaperPlaneRightFill, PiPassword } from 'react-icons/pi'
import H from '../ui/h'
import { signup } from './actions'
import { toast } from 'sonner'

export function SignUpForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, startTransition] = useTransition()

  return <div className={cn('w-full h-full max-w-sm flex flex-col gap-6 prose dark:prose-invert', className)} {...props}>
    <H className='mb-1 text-3xl'>开始语言学习之旅</H>
    <form action={() => {
      startTransition(async () => {
        const { error } = await signup({ email, password })
        if (error) {
          toast.error(error)
        }
      })
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
          startContent={<PiEnvelopeSimple className='text-xl' />}
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
          startContent={<PiPassword className='text-xl' />}
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
          startContent={<PiPassword className='text-xl' />}
        />
      </div>
      <Button type='submit' className='w-full h-10' isLoading={isLoading} endContent={<PiPaperPlaneRightFill />} color='primary'>
        {isLoading ? '注册中…' : '发送验证邮件'}
      </Button>
      <div className='text-center text-sm'>
        已有账号？{' '}
        <Link href={SIGN_IN_URL} className='text-primary hover:underline'>登录</Link>
      </div>
    </form>
  </div>
} 
