import { PiChatCircleDotsDuotone, PiUserCircleGearDuotone } from 'react-icons/pi'
import { PiBooksDuotone, PiRewindDuotone, PiStorefrontDuotone } from 'react-icons/pi'
import { FloatingDock } from './floating-dock'

export default function ServerDock() {
    return <FloatingDock items={[{
        icon: <PiBooksDuotone />,
        href: '/library'
    }, {
        icon: <PiRewindDuotone />,
        href: '/daily'
    }, {
        icon: <PiStorefrontDuotone />,
        href: '/marketplace/1'
    }, {
        icon: <PiChatCircleDotsDuotone />,
        href: '/library/chat'
    }, {
        icon: <PiUserCircleGearDuotone />,
        href: '/settings'
    }]} />
}
