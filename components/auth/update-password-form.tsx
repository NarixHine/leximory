'use client'

import { cn } from '@/lib/utils'
import { createClient } from '@/server/client/supabase/client'
import { Button } from '@heroui/button'
import { Input } from '@heroui/input'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { SIGN_IN_URL } from '@/lib/config'
import { PiLockKey } from 'react-icons/pi'
import H from '../ui/h'
import { getAuthErrorMessage } from './error-messages'
import { toast } from 'sonner'

export function UpdatePasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    if (password !== confirmPassword) {
      toast.error('两次输入的密码不一致')
      setIsLoading(false)
      return
    }
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error(getAuthErrorMessage(error))
    }
    toast.success('密码已更新！')
    setTimeout(() => router.push(SIGN_IN_URL), 1000)
    setIsLoading(false)
  }

  return <div className={cn('w-full h-full max-w-sm flex flex-col gap-6 prose dark:prose-invert', className)} {...props}>
    <H className='mb-1 text-3xl'>更新密码</H>
    <form onSubmit={handleUpdatePassword} className='space-y-4'>
      <div className='space-y-1'>
        <label htmlFor='password' className='text-sm font-medium leading-none'>新密码</label>
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
        {isLoading ? '更新中…' : '更新密码'}
      </Button>
    </form>
  </div>
} 
