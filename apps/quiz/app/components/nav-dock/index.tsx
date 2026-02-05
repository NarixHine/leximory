import { ArrowSquareOutIcon, BookBookmarkIcon, HouseLineIcon, NotebookIcon } from '@phosphor-icons/react/ssr'
import { prefixUrl } from '@repo/env/config'
import { Dock } from '@repo/ui/dock'

export function NavDock() {
    return (
        <div className='fixed bottom-3 left-1/2 -translate-x-1/2 w-fit'>
            <Dock
                items={[
                    { title: '主页', icon: <HouseLineIcon weight='duotone' size={20} />, href: '/' },
                    { title: '生词本', icon: <BookBookmarkIcon weight='duotone' size={20} />, href: '/notebook' },
                    { title: '错题本', icon: <NotebookIcon weight='duotone' size={20} />, href: '/question-notebook' },
                    { title: 'Leximory', icon: <ArrowSquareOutIcon weight='duotone' size={20} />, href: prefixUrl('/daily'), target: '_blank' },
                ]}
            />
        </div>
    )
}
