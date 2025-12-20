import { PiChatCircleDotsFill, PiUserCircleGearFill } from 'react-icons/pi'
import { PiBooksFill, PiRewindFill, PiStorefrontFill } from 'react-icons/pi'
import { FloatingDock } from './floating-dock'

export default function ServerDock() {
    return <FloatingDock items={[{
        icon: <PiBooksFill />,
        href: '/library'
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
}
