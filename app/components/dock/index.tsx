import { PiChatCircleDotsFill, PiUserCircleGearFill } from 'react-icons/pi'
import { PiBooksFill, PiNewspaperFill, PiRewindFill, PiStorefrontFill } from 'react-icons/pi'
import { FloatingDock } from './floating-dock'

export default function ServerDock() {
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
