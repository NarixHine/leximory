import { PiPaperPlaneTilt, PiSignIn } from 'react-icons/pi'
import Link from 'next/link'
import { Button } from '@heroui/button'

export default function SignUpSuccessPage() {
    return (
        <div className='flex w-full items-center justify-center p-4'>
            <div className='w-full max-w-md space-y-8 text-center'>
                <div className='flex flex-col items-center gap-4'>
                    <PiPaperPlaneTilt className='h-16 w-16 text-default-400' />
                    <h1 className='text-4xl font-bold tracking-tight'>就差一步了！</h1>
                    <p className='max-w-md text-lg text-default-600'>
                        我们已发送了一封确认邮件，请点击链接以完成注册。
                    </p>
                </div>

                <div>
                    <Button
                        variant='flat'
                        as={Link}
                        href='/login'
                        startContent={<PiSignIn />}
                    >
                        返回登录
                    </Button>
                </div>
            </div>
        </div>
    )
}