'use client'

import { useState, useRef } from 'react'
import { createClient } from '@repo/supabase/client'
import { Card, CardHeader, CardBody, CardFooter } from '@heroui/card'
import { Input } from '@heroui/input'
import { Button } from '@heroui/button'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { CopyProfileLink } from './copy'
import { MAX_FILE_SIZE, SIGN_IN_URL } from '@repo/env/config'
import { uploadAvatar } from '../actions'
import { toast } from 'sonner'
import { PiUser, PiImage, PiEnvelopeSimple, PiLock, PiSignOut, PiUpload } from 'react-icons/pi'

export function SectionCard({ children, footer, title, onSubmit }: { children: React.ReactNode, footer?: React.ReactNode, title: string, onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void }) {
    return (<form onSubmit={onSubmit} className='w-full h-full'>
        <Card shadow='none' className='rounded-2xl bg-default-50/50 p-0 w-full h-full'>
            <CardHeader className='px-6 pt-5 pb-1'>
                <h2 className='text-sm font-formal tracking-tight text-default-500'>{title}</h2>
            </CardHeader>
            <CardBody className='px-6 pb-5 pt-2'>{children}</CardBody>
            {footer && <CardFooter className='px-6 pb-5 pt-2'>{footer}</CardFooter>}
        </Card>
    </form>
    )
}

function UsernameSection({ username: currentUsername, onSuccess }: { username?: string, onSuccess?: () => void }) {
    const [username, setUsername] = useState(currentUsername)
    const [isLoading, setIsLoading] = useState(false)
    const supabase = createClient()
    return (
        <SectionCard title='用户名' footer={<Button type='submit' className='w-full h-10' variant='flat' color='default' isLoading={isLoading} startContent={<PiUser size={20} />}>
            {isLoading ? '更新中...' : '更新用户名'}
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
                <label htmlFor='username' className='text-sm font-medium leading-none'>用户名</label>
                <Input id='username' value={username} onChange={e => setUsername(e.target.value)} placeholder='你的用户名' className='h-10' />
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
        if (selectedFile.size > MAX_FILE_SIZE) {
            toast.error(`请上传小于 ${MAX_FILE_SIZE / 1024 / 1024}MB 的图片`)
            return
        }
        setIsLoading(true)
        try {
            const url = await uploadAvatar(selectedFile)
            const supabase = createClient()
            const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: url } })
            if (updateError) throw new Error(updateError.message)
            toast.success('头像已更新')
        } catch {
            toast.error('上传失败')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <SectionCard title='头像'>
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
                    color='default'
                    variant='flat'
                    onPress={() => fileInputRef.current?.click()}
                    isLoading={isLoading}
                    startContent={<PiImage size={20} />}
                >
                    选择图片
                </Button>
                <Button
                    type='button'
                    className='w-full h-10'
                    color='default'
                    onPress={handleUpload}
                    isLoading={isLoading}
                    startContent={<PiUpload size={20} />}
                >
                    {isLoading ? '上传中...' : '上传头像'}
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
        <SectionCard title='邮箱' footer={<Button type='submit' className='w-full h-10' variant='flat' color='default' isLoading={isLoading} startContent={<PiEnvelopeSimple size={20} />}>
            {isLoading ? '更新中...' : '更新邮箱'}
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
                <label htmlFor='email' className='text-sm font-medium leading-none'>电子邮箱地址</label>
                <Input id='email' type='email' value={email} onChange={e => setEmail(e.target.value)} placeholder='yourname@example.com' className='h-10' />
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
        <SectionCard title='密码' onSubmit={async e => {
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
                <label htmlFor='password' className='text-sm font-medium leading-none'>新密码</label>
                <Input id='password' type='password' value={password} onChange={e => setPassword(e.target.value)} placeholder='新密码' className='h-10' />
            </div>
            <div className='my-4'>
                <label htmlFor='confirm-password' className='text-sm font-medium leading-none'>确认密码</label>
                <Input id='confirm-password' type='password' value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder='确认密码' className='h-10' />
            </div>
            <Button type='submit' className='w-full h-10' variant='flat' color='default' isLoading={isLoading} startContent={<PiLock size={20} />}>
                {isLoading ? '更新中...' : '更新密码'}
            </Button>
        </SectionCard>
    )
}

function LogoutSection() {
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()
    return (
        <SectionCard title='登出'>
            <Button onPress={async () => {
                setIsLoading(true)
                await supabase.auth.signOut()
                router.push(SIGN_IN_URL)
            }} className='w-full h-10' color='default' variant='flat' isLoading={isLoading} startContent={<PiSignOut size={20} />}>
                退出登录
            </Button>
        </SectionCard>
    )
}

function ProfileLink({ userId }: { userId: string }) {
    return <SectionCard title='分享链接'>
        <CopyProfileLink userId={userId} />
    </SectionCard>
}

export default function UpdateProfile({ userId, username, image, className, ...props }: React.ComponentPropsWithoutRef<'div'> & { userId: string, username?: string, image?: string }) {
    return (
        <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[60vh] w-full items-center justify-center bg-background', className)} {...props}>
            <UsernameSection username={username} />
            <AvatarSection image={image} />
            <EmailSection />
            <PasswordSection />
            <LogoutSection />
            <ProfileLink userId={userId} />
        </div>
    )
}

export function UpdateProfileSkeleton({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
    return (
        <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[60vh] w-full items-center justify-center bg-background', className)} {...props}>
            <SectionCard title='用户名'>
                <div className='w-full h-10 animate-pulse rounded-xl bg-default-100' />
            </SectionCard>
            <SectionCard title='头像'>
                <div className='w-full h-10 animate-pulse rounded-xl bg-default-100' />
            </SectionCard>
            <SectionCard title='邮箱'>
                <div className='w-full h-10 animate-pulse rounded-xl bg-default-100' />
            </SectionCard>
            <SectionCard title='密码'>
                <div className='w-full h-10 animate-pulse rounded-xl bg-default-100' />
            </SectionCard>
            <SectionCard title='登出'>
                <div className='w-full h-10 animate-pulse rounded-xl bg-default-100' />
            </SectionCard>
            <SectionCard title='分享链接'>
                <div className='w-full h-10 animate-pulse rounded-xl bg-default-100' />
            </SectionCard>
        </div>
    )
}
