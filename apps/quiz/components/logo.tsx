import { cn } from '@heroui/theme'

export function Logo({ className, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
    return (
        <img
            src='/assets/logo.webp'
            alt='猫谜 Logo'
            className={cn('pointer-events-none select-none', className)}
            {...props}
        />
    )
}
