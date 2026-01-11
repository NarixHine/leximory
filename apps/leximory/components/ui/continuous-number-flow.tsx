'use client'

import NumberFlow from '@number-flow/react'
import { continuous } from '@number-flow/react'
import { ComponentProps } from 'react'
export default function ContinuousNumberFlow({ ...props }: ComponentProps<typeof NumberFlow>) {
    return <NumberFlow plugins={[continuous]} {...props} />
}

