import Center from '@/components/center'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { Link } from 'next-view-transitions'

export default function NotFound() {
    return (
        <Center>
            <div className={cn('relative w-full max-w-4xl aspect-video bg-white rounded-2xl shadow-sm overflow-hidden', CHINESE_ZCOOL.className)}>
                {/* Left side: 404 */}
                <div className='absolute left-0 top-0 bottom-0 w-1/3 bg-[#B8C5B6] flex items-center justify-center'>
                    <div className='text-center'>
                        <h1 className='text-9xl font-bold text-white tracking-tighter mb-2'>
                            404
                        </h1>
                        <p className='text-2xl text-white/90'>
                            页面未找到
                        </p>
                    </div>
                </div>

                {/* Right side: Content */}
                <div className='absolute right-0 top-0 bottom-0 w-2/3 flex flex-col items-center justify-center p-8 z-10'>
                    <p className='text-3xl text-gray-700 mb-8 font-medium text-center'>
                        您访问的页面不存在
                    </p>
                    <Link
                        href='/'
                        className='inline-block px-8 py-3 bg-[#B8C5B6] text-white rounded-full font-medium text-lg transition-all duration-300 hover:bg-[#A7B6A4] hover:shadow-sm'
                    >
                        Go Back
                    </Link>
                </div>

                {/* Decorative elements */}
                <div className='absolute top-8 right-8 w-16 h-16 bg-[#D9E4D7] rounded-full opacity-60' />
                <div className='absolute bottom-8 right-24 w-12 h-12 bg-[#D9E4D7] rounded-lg opacity-60' />
                <div className='absolute top-1/3 right-1/3 w-8 h-8 bg-[#D9E4D7] rounded-full opacity-60' />

                {/* Static lines */}
                <svg className='absolute inset-0 w-full h-full' xmlns='http://www.w3.org/2000/svg'>
                    <path
                        d='M 0 50 Q 200 0 400 50 Q 600 100 800 50'
                        stroke='#D9E4D7'
                        strokeWidth='2'
                        fill='none'
                    />
                    <path
                        d='M 0 70 Q 200 120 400 70 Q 600 20 800 70'
                        stroke='#B8C5B6'
                        strokeWidth='2'
                        fill='none'
                    />
                </svg>

            </div>
        </Center>
    )
}
