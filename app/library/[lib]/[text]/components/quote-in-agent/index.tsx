import { getPlan } from '@/server/auth/user'
import QuoteInAgentButton from './button'
import { Suspense } from 'react'
import { Button } from '@heroui/button'
import { PiChatsDuotone } from 'react-icons/pi'

async function PlanProvider({ className }: { className?: string }) {
    const plan = await getPlan()
    return <QuoteInAgentButton plan={plan} className={className} />
}

export default function QuoteInAgent({ className }: { className?: string }) {
    return (
        <Suspense fallback={<Button isIconOnly variant='light' className={className} startContent={<PiChatsDuotone />} isDisabled />}>
            <PlanProvider className={className} />
        </Suspense>
    )
}
