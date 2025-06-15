import { PiBooksFill, PiRewindFill, PiStorefrontFill, PiChatCircleDotsFill, PiUserCircleGearFill, PiNewspaperFill } from 'react-icons/pi'
import { FloatingDock } from './floating-dock'

export default function Dock() {
    return <FloatingDock items={[{
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
}
