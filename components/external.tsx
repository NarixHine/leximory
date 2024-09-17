import { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Button } from '@nextui-org/react'
import { PiArrowSquareOutDuotone } from 'react-icons/pi'
import Link from 'next/link'

export default function External({ children, link, ...props }: {
    children: ReactNode
    link: string
} & ComponentPropsWithoutRef<typeof Button>) {
    return <Button target='_blank' as={Link} variant='light' size='sm' startContent={<PiArrowSquareOutDuotone />} href={link} {...props}>
        {children}
    </Button>
}
