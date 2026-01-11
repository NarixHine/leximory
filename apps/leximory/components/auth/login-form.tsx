'use client'

import { Button } from '@heroui/button'
import { Input } from '@heroui/input'
import { Divider } from '@heroui/divider'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import H from '../ui/h'
import { PiEnvelopeSimple, PiGithubLogoFill, PiFingerprintFill, PiPassword } from 'react-icons/pi'
import { cn } from '@/lib/utils'
import { login } from './actions'
import { Form } from '@heroui/form'
import { toast } from 'sonner'
import { createClient } from '@repo/supabase/client'
import { prefixUrl } from '@repo/env/config'
import { useSearchParams } from 'next/navigation'

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const searchParams = useSearchParams()
  const [isLoading, startTransition] = useTransition()
  const next = decodeURIComponent(searchParams.get('next') || '')

  const handleGithubLogin = async () => {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: next ? prefixUrl('/callback?next=' + encodeURIComponent(next)) : prefixUrl('/callback'),
      },
    })

    if (error) {
      toast.error('GitHub 登录失败')
    }
  }

  return <div className={cn('w-full h-full max-w-sm flex flex-col gap-3 prose dark:prose-invert', className)} {...props}>
    <H className='mb-1'>继续语言学习之旅</H>
    <Form action={() => {
      startTransition(async () => {
        const { error } = await login({ email, password, next })
        if (error) {
          toast.error(error)
        } else {
          toast.success('登录成功')
        }
      })
    }} className='space-y-2 max-w-sm'>
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
          startContent={<PiEnvelopeSimple className='text-xl' />}
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
            className='text-sm text-primary no-underline hover:underline'
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
          startContent={<PiPassword className='text-xl' />}
        />
      </div>
      <Button
        type='submit'
        className='w-full h-10 mt-1'
        isLoading={isLoading}
        color='primary'
        startContent={<PiFingerprintFill className='text-xl' />}
      >
        {isLoading ? '登录中…' : '登录'}
      </Button>
      <div className='text-center text-sm pt-1'>
        没有账号？{' '}
        <Link
          href='/sign-up'
          className='text-primary font-bold no-underline hover:underline'
        >
          注册
        </Link>
      </div>
    </Form>

    <div className='relative not-prose'>
      <Divider className='my-5' />
      <div className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-sm'>
        或
      </div>
    </div>

    <Button
      variant='flat'
      color='primary'
      fullWidth
      startContent={<PiGithubLogoFill className='text-xl' />}
      isLoading={isLoading}
      onPress={() => startTransition(handleGithubLogin)}
    >
      GitHub 登录
    </Button>
  </div>
}
