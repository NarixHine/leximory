import { cn } from '@heroui/theme'

export function QuizLogo({ className, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
    return (
        <img
            src='/assets/logo.webp'
            alt='猫谜 Logo'
            className={cn('pointer-events-none select-none dark:brightness-80', className)}
            {...props}
        />
    )
}
