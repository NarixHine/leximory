'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/server/client/supabase/client'
import { Card, CardHeader, CardBody, CardFooter } from '@heroui/card'
import { Input } from '@heroui/input'
import { Button } from '@heroui/button'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { CopyProfileLink } from './copy'
import { SIGN_IN_URL } from '@/lib/config'
import { Skeleton } from '@heroui/skeleton'

function SectionCard({ children, footer, title, onSubmit }: { children: React.ReactNode, footer?: React.ReactNode, title: string, onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void }) {
    return (<form onSubmit={onSubmit} className='w-full h-full'>
        <Card className='rounded-2xl border border-default-100 bg-default-50/50 shadow-sm p-0 w-full h-full'>
            <CardHeader className='px-6 pt-6 pb-2'>
                <h2 className='text-lg font-semibold tracking-tight'>{title}</h2>
            </CardHeader>
            <CardBody className='px-6 pb-6 pt-2'>{children}</CardBody>
            {footer && <CardFooter className='px-6 pb-6 pt-2'>{footer}</CardFooter>}
        </Card>
    </form>
    )
}

function UsernameSection({ username: currentUsername, onSuccess }: { username?: string, onSuccess?: () => void }) {
    const [username, setUsername] = useState(currentUsername)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const supabase = createClient()
    return (
        <SectionCard title='Update Username' footer={<Button type='submit' className='w-full h-10' disabled={isLoading || !username} variant='flat' color='primary'>
            {isLoading ? 'Updating...' : 'Update Username'}
        </Button>} onSubmit={async e => {
            e.preventDefault()
            setIsLoading(true)
            setError(null)
            setSuccess(null)
            try {
                const { error } = await supabase.auth.updateUser({ data: { username } })
                if (error) throw error
                setSuccess('Username updated!')
                setUsername('')
                onSuccess?.()
            } catch (err: any) {
                setError(err.message || 'An error occurred')
            } finally {
                setIsLoading(false)
            }
        }
        }>
            <div className='space-y-2'>
                <label htmlFor='username' className='text-sm font-medium leading-none'>Username</label>
                <Input id='username' value={username} onChange={e => setUsername(e.target.value)} placeholder='Your username' className='h-10' />
            </div>
            {error && <div className='rounded bg-destructive/10 p-2 text-xs text-destructive'>{error}</div>}
            {success && <div className='rounded bg-success/10 p-2 text-xs text-success'>{success}</div>}
        </SectionCard>
    )
}

function AvatarSection({ avatar: currentAvatar, onSuccess }: { avatar?: string, onSuccess?: () => void }) {
    const [avatar, setAvatar] = useState(currentAvatar)
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setAvatarPreview(URL.createObjectURL(file))
        setIsLoading(true)
        setError(null)
        setSuccess(null)

        // TODO: upload avatar to supabase storage 
    }

    return (
        <SectionCard
            onSubmit={async e => {
                e.preventDefault()
                setIsLoading(true)
                setError(null)
                setSuccess(null)
                try {
                    const { error } = await supabase.auth.updateUser({ data: { avatar_url: avatar } })
                    if (error) throw error
                    setSuccess('Avatar updated!')
                    setAvatar('')
                    setAvatarPreview(null)
                    onSuccess?.()
                } catch (err: any) {
                    setError(err.message || 'An error occurred')
                } finally {
                    setIsLoading(false)
                }
            }}
            title='Update Avatar'
            footer={<div className='flex flex-col gap-2 w-full'>
                <button
                    type='button'
                    className='w-full h-10 rounded-md border border-default-200 bg-default-100 text-default-800 hover:bg-default-200 transition-colors'
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                >
                    Upload Avatar
                </button>
                <Button type='submit' className='w-full h-10' disabled={isLoading || !avatar} variant='flat' color='primary'>
                    Update Avatar
                </Button>
            </div>}
        >
            <div className='flex flex-col items-center gap-4'>
                <div className='w-20 h-20 rounded-full overflow-hidden border border-default-200 bg-default-100 flex items-center justify-center'>
                    {avatarPreview || avatar ? (
                        <img src={avatarPreview || avatar} alt='Avatar preview' className='object-cover w-full h-full' />
                    ) : (
                        <span className='text-default-400 text-xs'>No Avatar</span>
                    )}
                </div>
                <input
                    ref={fileInputRef}
                    type='file'
                    accept='image/*'
                    className='hidden'
                    onChange={handleAvatarChange}
                />
                {error && <div className='rounded bg-destructive/10 p-2 text-xs text-destructive'>{error}</div>}
                {success && <div className='rounded bg-success/10 p-2 text-xs text-success'>{success}</div>}
            </div>
        </SectionCard>
    )
}

function EmailSection({ onSuccess }: { onSuccess?: () => void }) {
    const [email, setEmail] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const supabase = createClient()
    return (
        <SectionCard title='Update Email' footer={<Button type='submit' className='w-full h-10' disabled={isLoading || !email} variant='flat' color='primary'>
            {isLoading ? 'Updating...' : 'Update Email'}
        </Button>} onSubmit={async e => {
            e.preventDefault()
            setIsLoading(true)
            setError(null)
            setSuccess(null)
            try {
                const { error } = await supabase.auth.updateUser({ email })
                if (error) throw error
                setSuccess('Email updated!')
                setEmail('')
                onSuccess?.()
            } catch (err: any) {
                setError(err.message || 'An error occurred')
            } finally {
                setIsLoading(false)
            }
        }}>
            <div className='space-y-2'>
                <label htmlFor='email' className='text-sm font-medium leading-none'>Email</label>
                <Input id='email' type='email' value={email} onChange={e => setEmail(e.target.value)} placeholder='Email' className='h-10' />
            </div>
            {error && <div className='rounded bg-destructive/10 p-2 text-xs text-destructive'>{error}</div>}
            {success && <div className='rounded bg-success/10 p-2 text-xs text-success'>{success}</div>}
        </SectionCard>
    )
}

function PasswordSection({ onSuccess }: { onSuccess?: () => void }) {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const supabase = createClient()
    return (
        <SectionCard title='Update Password' onSubmit={async e => {
            e.preventDefault()
            setIsLoading(true)
            setError(null)
            setSuccess(null)
            if (password !== confirmPassword) {
                setError('Passwords do not match')
                setIsLoading(false)
                return
            }
            try {
                const { error } = await supabase.auth.updateUser({ password })
                if (error) throw error
                setSuccess('Password updated!')
                setPassword('')
                setConfirmPassword('')
                onSuccess?.()
            } catch (err: any) {
                setError(err.message || 'An error occurred')
            } finally {
                setIsLoading(false)
            }
        }}>
            <div>
                <label htmlFor='password' className='text-sm font-medium leading-none'>New Password</label>
                <Input id='password' type='password' value={password} onChange={e => setPassword(e.target.value)} placeholder='New password' className='h-10' />
            </div>
            <div className='my-4'>
                <label htmlFor='confirm-password' className='text-sm font-medium leading-none'>Confirm Password</label>
                <Input id='confirm-password' type='password' value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder='Confirm password' className='h-10' />
            </div>
            {error && <div className='rounded bg-destructive/10 p-2 text-xs text-destructive'>{error}</div>}
            {success && <div className='rounded bg-success/10 p-2 text-xs text-success'>{success}</div>}
            <Button type='submit' className='w-full h-10' disabled={isLoading || !password || !confirmPassword} variant='flat' color='primary'>
                {isLoading ? 'Updating...' : 'Update Password'}
            </Button>
        </SectionCard>
    )
}

function LogoutSection() {
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()
    return (
        <SectionCard title='Logout'>
            <Button onPress={async () => {
                setIsLoading(true)
                await supabase.auth.signOut()
                router.push(SIGN_IN_URL)
            }} className='w-full h-10' color='primary' variant='flat' disabled={isLoading}>
                Logout
            </Button>
        </SectionCard>
    )
}

function ProfileLink({ userId }: { userId: string }) {
    return <CopyProfileLink userId={userId} />
}

export default function UpdateProfile({ userId, username, image, className, ...props }: React.ComponentPropsWithoutRef<'div'> & { userId: string, username?: string, image?: string }) {
    return (
        <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[60vh] w-full items-center justify-center bg-background py-8', className)} {...props}>
            <UsernameSection username={username} />
            <AvatarSection avatar={image} />
            <EmailSection />
            <PasswordSection />
            <LogoutSection />
            <div className='flex justify-center items-center'>
                <ProfileLink userId={userId} />
            </div>
        </div>
    )
}

export function UpdateProfileSkeleton({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
    return (
        <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[60vh] w-full items-center justify-center bg-background py-8', className)} {...props}>
            <SectionCard title='Update Username'>
                <Skeleton className='w-full h-10 rounded-full' />
            </SectionCard>
            <SectionCard title='Update Avatar'>
                <Skeleton className='w-full h-10 rounded-full' />
            </SectionCard>
            <SectionCard title='Update Email'>
                <Skeleton className='w-full h-10 rounded-full' />
            </SectionCard>
            <SectionCard title='Update Password'>
                <Skeleton className='w-full h-10 rounded-full' />
            </SectionCard>
        </div>
    )
}
