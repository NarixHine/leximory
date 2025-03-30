'use client'

import { CHINESE_ZCOOL } from '@/lib/fonts'
import { useIsMobileIos } from '@/lib/hooks'
import { resetSelection } from '@/lib/utils'
import { Button } from "@heroui/button"
import { PiTrashDuotone } from 'react-icons/pi'

export default function EmptySelection() {
    const isMobileIos = useIsMobileIos()
    return isMobileIos && <Button
        className={CHINESE_ZCOOL.className}
        variant='flat'
        color='primary'
        startContent={<PiTrashDuotone />}
        onPress={() => {
            resetSelection()
        }}>
        清空选中
    </Button>
}
