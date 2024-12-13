import { PiBooksDuotone, PiInfoDuotone, PiGearDuotone, PiRewindDuotone } from 'react-icons/pi'
import { FloatingDock } from './floating-dock'

export default function Dock() {
    return <div className='fixed bottom-0 left-0 right-0 z-30'>
        <FloatingDock items={[{
            icon: <PiBooksDuotone />,
            href: '/library'
        }, {
            icon: <PiRewindDuotone />,
            href: '/daily'
        }, {
            icon: <PiGearDuotone />,
            href: '/settings'
        }, {
            icon: <PiInfoDuotone />,
            href: '/about',
        }]} />
    </div>
}
