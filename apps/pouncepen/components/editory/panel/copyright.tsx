import { prefixUrl } from '@repo/env/config'
import Link from 'next/link'
import { PouncePenIcon } from '../../ui/logo'

export function Copyright() {
  return (
    <footer className='flex items-center border-y-1 p-2 border-secondary-800/40'>
      <div className='flex flex-col text-right text-secondary-800/60 ml-1'>
        <p className='text-xs'>A <Link className='font-bold' target='_blank' href={prefixUrl('/')}>Leximory</Link> Product</p>
        <p className='text-xs'>With <Link target='_blank' rel='noopener noreferrer' className='font-bold' href={'https://github.com/Jiuzhixinzhi'}>Perennial Branch</Link></p>
      </div>
      <PouncePenIcon width={40} height={40} className='dark:opacity-70' />
    </footer>
  )
}
