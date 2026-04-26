import { PiBooksDuotone, PiRewindDuotone, PiStorefrontDuotone, PiUserCircleGearDuotone } from 'react-icons/pi'
import { FloatingDock } from './floating-dock'

export default function ServerDock() {
    return <FloatingDock items={[{
        icon: <PiBooksDuotone />,
        href: '/library'
    }, {
        icon: <PiRewindDuotone />,
        href: '/review'
    }, {
        icon: <PiStorefrontDuotone />,
        href: '/marketplace/1'
    }, {
        icon: <PiUserCircleGearDuotone />,
        href: '/settings'
    }]} />
}
