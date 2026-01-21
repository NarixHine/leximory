import Main from '@/components/ui/main'
import { OrangeIcon } from '@phosphor-icons/react/ssr'
import { cn } from '@heroui/theme'
import { ReactNode } from 'react'
import { PouncePenIcon } from './logo'

export default function Hero({
    children,
    title,
    description,
    className,
    imgSrc = '/img/bg.webp'
}: {
    children: ReactNode
    title: string
    description?: string
    className?: string
    imgSrc?: string
}) {
    return (
        <Main className='flex flex-col justify-center gap-4'>
            <header className='flex px-2'>
                <div className='flex gap-1 items-center font-bold text-secondary'>
                    <PouncePenIcon className='size-6' /> PouncePen
                </div>
                <div className='flex-1'></div>
                <div className='tracking-tight hidden sm:block'>Pen the paper. Pounce on performance.</div>
            </header>
            <div
                className={cn(
                    'rounded-2xl p-5 bg-[#7fa8aa] bg-cover bg-top flex-1 flex justify-center items-center max-h-[50vh]',
                    className
                )}
                style={{ backgroundImage: `url(${imgSrc})` }}
            >
                <div className='flex flex-col gap-2 items-center'>
                    <h1 className='text-default-50 sm:text-9xl text-8xl font-extrabold text-center'>
                        {title}
                    </h1>
                    {description && <p className='text-white text-shadow-lg rounded px-1 text-2xl font-semibold'>
                        {description}
                    </p>}
                    {children}
                </div>
            </div>
            <footer className='text-center text-sm text-muted-foreground px-4'>
                <div className='font-mono'>A Perennial Branch Product</div>
            </footer>
        </Main>
    )
}