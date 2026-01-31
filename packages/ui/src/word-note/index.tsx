import { Button } from '@heroui/button'
import { Card, CardBody } from '@heroui/card'
import { Spinner } from '@heroui/spinner'
import { cn } from '@heroui/theme'
import { BookmarkIcon } from '@phosphor-icons/react/ssr'
import { saveWordAction } from '@repo/service/word'
import { useMutation } from '@tanstack/react-query'
import { Streamdown } from 'streamdown'

export function WordNote({ portions, isPending, showSaveButton, className, cardBodyClassName }: { portions: string[], isPending?: boolean, showSaveButton?: boolean, className?: string, cardBodyClassName?: string }) {
    return (
        <Card fullWidth radius='sm' shadow='none' className={className}>
            <CardBody className={cn('px-5 py-3 leading-snug gap-2', cardBodyClassName)}>
                <div className={'font-bold text-lg'}>{portions[1] ?? portions[0]}</div>
                <div className='overflow-hidden'>
                    {
                        isPending && portions.length === 0
                            ? <div className='flex font-mono items-center gap-1.5 -mt-2.5'>
                                Generating <Spinner variant='dots' color='default' />
                            </div>
                            : <></>
                    }
                    {portions[2] && <div>
                        <div className='text-default-600 text-sm'>释义</div>
                        <Streamdown className='prose-code:before:content-["["] prose-code:after:content-["]"]'>{portions[2]}</Streamdown>
                    </div>}
                    {portions[3] && <div className={'mt-3'}>
                        <div className='text-default-600 text-sm'>语源</div>
                        <Streamdown>{portions[3]}</Streamdown>
                    </div>}
                    {portions[4] && <div className={'mt-3'}>
                        <div className='text-default-600 text-sm'>同源词</div>
                        <Streamdown>{portions[4]}</Streamdown>
                    </div>}
                </div>
                {portions[2] && showSaveButton && <div className='my-1'><Save portions={portions} /></div>}
            </CardBody>
        </Card>
    )
}


function Save({ portions }: { portions: string[] }) {
    const { mutate, isPending, isSuccess } = useMutation({
        mutationFn: async () => {
            await saveWordAction({ portions })
        },
    })
    return (
        <Button
            color='secondary'
            isLoading={isPending}
            startContent={<BookmarkIcon weight='duotone' />}
            isDisabled={isSuccess}
            onPress={() => {
                mutate()
            }}
        >
            {isSuccess ? '已保存' : '保存'}
        </Button>
    )
}
