'use client'

import { Button, ButtonProps } from '@heroui/button'
import Link, { LinkProps } from 'next/link'

type LinkButtonProps = ButtonProps & LinkProps

export default function LinkButton({ ...props }: LinkButtonProps) {
    return <Button as={Link} {...props} />
}