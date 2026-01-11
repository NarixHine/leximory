import { getPlan } from '@repo/user'
import QuoteInAgentButton from './button'
import { Suspense } from 'react'
import { Button } from '@heroui/button'
import { PiChatsDuotone } from 'react-icons/pi'

async function PlanProvider({ className }: { className?: string }) {
    const plan = await getPlan()
    return plan === 'beginner' ? null : <QuoteInAgentButton className={className} />
}

export default function QuoteInAgent({ className }: { className?: string }) {
    return (
        <Suspense fallback={<Button isIconOnly variant='light' className={className} startContent={<PiChatsDuotone />} isDisabled />}>
            <PlanProvider className={className} />
        </Suspense>
    )
}
