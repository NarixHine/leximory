'use client'

import { useState, useEffect } from 'react'
import { useCopyToClipboard } from 'usehooks-ts'
import { PiCheck, PiShareNetworkDuotone } from 'react-icons/pi'
import { Button, type ButtonProps } from '@heroui/button'

export default function ShareButton(props: ButtonProps) {
    const [isCopied, setIsCopied] = useState(false)
    const [, copy] = useCopyToClipboard()

    const handleCopy = async () => {
        const success = await copy(window.location.href)
        if (success) {
            setIsCopied(true)
        }
    }

    useEffect(() => {
        if (isCopied) {
            const timer = setTimeout(() => {
                setIsCopied(false)
            }, 2000)
            return () => clearTimeout(timer)
        }
    }, [isCopied])

    return (
        <Button
            variant='light'
            onPress={handleCopy}
            startContent={isCopied ? (
                <PiCheck />
            ) : (
                <PiShareNetworkDuotone />
            )}
            isIconOnly
            {...props}
        />
    )
}
