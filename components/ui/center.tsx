import { ReactNode } from 'react'
import Main from '@/components/ui/main'

export default function Center({ children }: { children: ReactNode }) {
    return <Main className='flex items-center justify-center mx-auto h-full'>
        {children}
    </Main>
}
