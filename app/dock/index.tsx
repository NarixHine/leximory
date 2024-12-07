import { PiBooksDuotone, PiInfoDuotone, PiRewindDuotone } from 'react-icons/pi'
import { FloatingDock } from './floating-dock'

export default function Dock() {
    return <div className='fixed bottom-0 left-0 right-0'>
        <FloatingDock items={[{
            title: 'Read',
            icon: <PiBooksDuotone />,
            href: '/library'
        }, {
            title: 'Review',
            icon: <PiRewindDuotone />,
            href: '/daily'
        }, {
            title: 'Reference',
            icon: <PiInfoDuotone />,
            href: '/about',
        },]}
        />
    </div>
}
