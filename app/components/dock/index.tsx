import { PiBooksDuotone, PiInfoDuotone, PiRewindDuotone, PiStorefrontDuotone, PiUserCircleGearDuotone, PiChatCircleDotsDuotone } from 'react-icons/pi'
import { FloatingDock } from './floating-dock'

export default function Dock() {
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
    }, {
        icon: <PiInfoDuotone />,
        href: '/about',
    }]} />
}
