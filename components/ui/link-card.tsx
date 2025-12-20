'use client'

import { Card, CardProps } from '@heroui/card'
import Link, { LinkProps } from 'next/link'

type LinkCardProps = CardProps & LinkProps

export default function LinkCard({ ...props }: LinkCardProps) {
    return <Card as={Link} {...props} />
}
