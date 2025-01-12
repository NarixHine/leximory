'use client'

import { useAtom } from 'jotai'
import { Radio, RadioGroup } from '@nextui-org/radio'
import { lexiconAtom } from '@/app/library/[lib]/[text]/atoms'
import { cn } from '@/lib/utils'
import { CustomLexicon } from '@/lib/types'

export default function LexiconSelector({ className }: { className?: string }) {
  const [customLexicon, setCustomLexicon] = useAtom(lexiconAtom)

  return (
    <div className={cn('flex justify-center items-center', className)}>
      <RadioGroup
        value={customLexicon}
        orientation='horizontal'
        onValueChange={(value) => { setCustomLexicon(value as CustomLexicon) }}
      >
        <Radio value='none'>无</Radio>
        <Radio value='chuzhong'>初中</Radio>
        <Radio value='gaozhong'>高中</Radio>
        <Radio value='cet6'>六级</Radio>
      </RadioGroup>
    </div>
  )
}
