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
import { uploadAvatar } from '../actions'
import { toast } from 'sonner'
import { PiUser, PiImage, PiEnvelopeSimple, PiLock, PiSignOut } from 'react-icons/pi'

function SectionCard({ children, footer, title, onSubmit }: { children: React.ReactNode, footer?: React.ReactNode, title: string, onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void }) {
    return (<form onSubmit={onSubmit} className='w-full h-full'>
        <Card className='rounded-2xl border border-default-100 bg-default-50/50 shadow-sm p-0 w-full h-full'>
            <CardHeader className='px-6 pt-6 pb-2'>
                <h2 className='text-lg tracking-tight'>{title}</h2>
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
    const supabase = createClient()
    return (
        <SectionCard title='Update Username' footer={<Button type='submit' className='w-full h-10' variant='flat' color='primary' isLoading={isLoading} startContent={<PiUser size={20} />}>
            {isLoading ? 'Updating...' : 'Update Username'}
        </Button>} onSubmit={async e => {
            e.preventDefault()
            setIsLoading(true)
            try {
                const { error } = await supabase.auth.updateUser({ data: { username } })
                if (error) throw error
                setUsername('')
                onSuccess?.()
                toast.success('用户名已更新')
            } catch {
                toast.error('更新失败')
            } finally {
                setIsLoading(false)
            }
        }
        }>
            <div className='space-y-2'>
                <label htmlFor='username' className='text-sm font-medium leading-none'>Username</label>
                <Input id='username' value={username} onChange={e => setUsername(e.target.value)} placeholder='Your username' className='h-10' />
            </div>
        </SectionCard>
    )
}

export function AvatarSection({ image }: { image?: string }) {
    const [preview, setPreview] = useState<string | null>(image || null)
    const [isLoading, setIsLoading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setPreview(URL.createObjectURL(file))
            setSelectedFile(file)
        }
    }

    const handleUpload = async () => {
        if (!selectedFile) {
            toast.error('Please select an image')
            return
        }
        setIsLoading(true)
        try {
            const url = await uploadAvatar(selectedFile)
            const supabase = createClient()
            const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: url } })
            if (updateError) throw new Error(updateError.message)
            setPreview(url)
            toast.success('头像已更新')
        } catch {
            toast.error('上传失败')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <SectionCard title='Update Avatar'>
            <div className="flex flex-col items-center gap-4">
                <div className='w-20 h-20 rounded-full overflow-hidden border border-default-200 bg-default-100 flex items-center justify-center'>
                    {preview ? (
                        <img src={preview} alt='Avatar preview' className='object-cover w-full h-full' />
                    ) : (
                        <span className='text-default-400 text-xs'>No Avatar</span>
                    )}
                </div>
                <input
                    ref={fileInputRef}
                    type='file'
                    accept='image/*'
                    className='hidden'
                    onChange={handleFileChange}
                />
                <Button
                    type='button'
                    className='w-full h-10'
                    color='secondary'
                    variant='flat'
                    onPress={() => fileInputRef.current?.click()}
                    isLoading={isLoading}
                    startContent={<PiImage size={20} />}
                >
                    Choose Image
                </Button>
                <Button
                    type='button'
                    className='w-full h-10'
                    color='primary'
                    onPress={handleUpload}
                    isLoading={isLoading}
                    startContent={<PiImage size={20} />}
                >
                    {isLoading ? 'Uploading...' : 'Upload Avatar'}
                </Button>
            </div>
        </SectionCard>
    )
}

function EmailSection({ onSuccess }: { onSuccess?: () => void }) {
    const [email, setEmail] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const supabase = createClient()
    return (
        <SectionCard title='Update Email' footer={<Button type='submit' className='w-full h-10' variant='flat' color='primary' isLoading={isLoading} startContent={<PiEnvelopeSimple size={20} />}>
            {isLoading ? 'Updating...' : 'Update Email'}
        </Button>} onSubmit={async e => {
            e.preventDefault()
            setIsLoading(true)
            try {
                const { error } = await supabase.auth.updateUser({ email })
                if (error) throw error
                setEmail('')
                onSuccess?.()
                toast.success('邮箱已更新')
            } catch {
                toast.error('更新失败')
            } finally {
                setIsLoading(false)
            }
        }}>
            <div className='space-y-2'>
                <label htmlFor='email' className='text-sm font-medium leading-none'>Email</label>
                <Input id='email' type='email' value={email} onChange={e => setEmail(e.target.value)} placeholder='Email' className='h-10' />
            </div>
        </SectionCard>
    )
}

function PasswordSection({ onSuccess }: { onSuccess?: () => void }) {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const supabase = createClient()
    return (
        <SectionCard title='Update Password' onSubmit={async e => {
            e.preventDefault()
            setIsLoading(true)
            if (password !== confirmPassword) {
                toast.error('Passwords do not match')
                setIsLoading(false)
                return
            }
            try {
                const { error } = await supabase.auth.updateUser({ password })
                if (error) throw error
                setPassword('')
                setConfirmPassword('')
                onSuccess?.()
                toast.success('密码已更新')
            } catch {
                toast.error('更新失败')
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
            <Button type='submit' className='w-full h-10' variant='flat' color='primary' isLoading={isLoading} startContent={<PiLock size={20} />}>
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
            }} className='w-full h-10' color='primary' variant='flat' isLoading={isLoading} startContent={<PiSignOut size={20} />}>
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
        <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[60vh] w-full items-center justify-center bg-background', className)} {...props}>
            <UsernameSection username={username} />
            <AvatarSection image={image} />
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
        <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[60vh] w-full items-center justify-center bg-background', className)} {...props}>
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
