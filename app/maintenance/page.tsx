import Center from '@/components/ui/center'
import H from '@/components/ui/h'
import { PiToolboxDuotone } from 'react-icons/pi'
import { Progress } from '@heroui/progress'

export default function MaintenancePage() {
    return (
        <Center>
            <div className='max-w-2xl mx-auto p-8 text-center'>
                <H usePlayfair className='text-4xl font-bold mb-4 flex items-center justify-center gap-2'>
                    Leximory 维护中
                </H>
                <div className='p-6 space-y-8'>
                    <div className='flex flex-col items-center space-y-6'>
                        <div className='animate-bounce text-6xl opacity-80'>
                            <PiToolboxDuotone />
                        </div>

                        <div className='w-full max-w-md h-2 rounded-full overflow-hidden'>
                            <Progress isIndeterminate />
                        </div>
                    </div>

                    <div className='space-y-4'>
                        <p className='opacity-80 text-lg'>
                            我们正在进行系统维护，以提供更好的服务体验。
                        </p>
                    </div>

                    <div className='flex items-center justify-center space-x-8 text-sm opacity-50'>
                        <div className='flex items-center space-x-2'>
                            <span>✉️</span>
                            <p>如有疑问，请通过邮件联系我们</p>
                        </div>
                    </div>

                    <div className='text-xs opacity-40 bg-default-100 rounded-lg p-4'>
                        <div className='flex items-center space-x-2 mb-2'>
                            <span>💡</span>
                            <span>维护期间，您可以：</span>
                        </div>
                        <ul className='list-none space-y-2 ml-6'>
                            <li className='flex items-center space-x-2'>
                                <span>📚</span>
                                <span>查看我们的使用教程</span>
                            </li>
                            <li className='flex items-center space-x-2'>
                                <span>🔔</span>
                                <span>关注我们的社交媒体获取最新动态</span>
                            </li>
                            <li className='flex items-center space-x-2'>
                                <span>✨</span>
                                <span>准备好想要阅读的外刊</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </Center>
    )
}
