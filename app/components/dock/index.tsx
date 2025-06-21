import { PiBooksFill, PiRewindFill, PiStorefrontFill, PiChatCircleDotsFill, PiUserCircleGearFill, PiNewspaperFill, PiLockKeyFill } from 'react-icons/pi'
import { FloatingDock } from './floating-dock'
import { createClient } from '@/server/client/supabase/server'
import { Suspense } from 'react'

export default function ServerDock() {
    return <Suspense fallback={<AuthedDock />}>
        <Dock />
    </Suspense>
}

async function Dock() {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    return session ? <AuthedDock /> : <UnauthedDock />
}

const AuthedDock = () => <FloatingDock items={[{
    icon: <PiBooksFill />,
    href: '/library'
}, {
    icon: <PiNewspaperFill />,
    href: '/times'
}, {
    icon: <PiRewindFill />,
    href: '/daily'
}, {
    icon: <PiStorefrontFill />,
    href: '/marketplace/1'
}, {
    icon: <PiChatCircleDotsFill />,
    href: '/library/chat'
}, {
    icon: <PiUserCircleGearFill />,
    href: '/settings'
}]} />

const UnauthedDock = () => <FloatingDock items={[{
    icon: <PiNewspaperFill />,
    href: '/times'
}, {
    icon: <PiLockKeyFill />,
    href: '/library'
}, {
    icon: <PiLockKeyFill />,
    href: '/daily'
}, {
    icon: <PiLockKeyFill />,
    href: '/marketplace/1'
}, {
    icon: <PiLockKeyFill />,
    href: '/library/chat'
}, {
    icon: <PiLockKeyFill />,
    href: '/settings'
}]} />
