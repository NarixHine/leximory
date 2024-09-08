'use client'

import { ReactNode } from 'react'
import Main from './main'

export default function Center({ children }: { children: ReactNode }) {
    return <Main className='flex items-center justify-center mx-auto h-full'>
        {children}
    </Main>
}
