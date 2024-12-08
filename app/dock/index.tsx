import { PiBooksDuotone, PiInfoDuotone, PiGearDuotone, PiRewindDuotone } from 'react-icons/pi'
import { FloatingDock } from './floating-dock'

export default function Dock() {
    return <div className='fixed bottom-0 left-0 right-0 z-30'>
        <FloatingDock items={[{
            title: 'Read',
            icon: <PiBooksDuotone />,
            href: '/library'
        }, {
            title: 'Review',
            icon: <PiRewindDuotone />,
            href: '/daily'
        }, {
            title: 'Settings',
            icon: <PiGearDuotone />,
            href: '/settings'
        }, {
            title: 'About',
            icon: <PiInfoDuotone />,
            href: '/about',
        }]} />
    </div>
}
