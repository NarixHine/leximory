'use client'

import { Button } from '@heroui/button'
import { Input } from '@heroui/input'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import H from '../ui/h'
import { PiEnvelopeSimple, PiLockKey } from 'react-icons/pi'
import { cn } from '@/lib/utils'
import { login } from './actions'
import { Form } from '@heroui/form'

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, startTransition] = useTransition()

  return <div className={cn('w-full h-full max-w-sm flex flex-col gap-6 prose', className)} {...props}>
    <H className='mb-1'>继续语言学习之旅</H>
    <Form action={() => {
      startTransition(() => login({ email, password }))
    }} className='space-y-4 max-w-sm'>
      <div className='space-y-1 w-full'>
        <label
          htmlFor='email'
          className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
        >
          邮箱
        </label>
        <Input
          name='email'
          type='email'
          placeholder='yourname@example.com'
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className='h-10'
          startContent={<PiEnvelopeSimple className='text-xl text-muted-foreground' />}
        />
      </div>
      <div className='space-y-1 w-full'>
        <div className='flex items-center justify-between'>
          <label
            htmlFor='password'
            className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
          >
            密码
          </label>
          <Link
            href='/forgot-password'
            className='text-sm text-primary hover:underline'
          >
            忘记密码？
          </Link>
        </div>
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
      <Button
        type='submit'
        className='w-full h-10 mt-1'
        isLoading={isLoading}
        color='primary'
      >
        {isLoading ? '登录中…' : '登录'}
      </Button>
      <div className='text-center text-sm pt-1'>
        没有账号？{' '}
        <Link
          href='/sign-up'
          className='text-primary hover:underline'
        >
          注册
        </Link>
      </div>
    </Form>
  </div>
}
