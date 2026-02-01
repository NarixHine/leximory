'use client'

import { Button } from '@heroui/button'
import { CardBody, CardFooter } from '@heroui/card'
import { Spacer } from '@heroui/spacer'
import { PiBookBookmarkDuotone, PiClockCounterClockwiseDuotone, PiFadersDuotone, PiLockSimpleOpenDuotone, PiFolderPlusDuotone, PiTranslateDuotone, PiTrashDuotone, PiHourglassMediumDuotone, PiPackageDuotone, PiStackMinusDuotone, PiBoxArrowDownDuotone, PiBoxArrowUpDuotone, PiWarningOctagonFill } from 'react-icons/pi'
import { LIB_ACCESS_STATUS, Lang } from '@repo/env/config'
import { getLanguageStrategy, languageStrategies } from '@/lib/languages'
import { atomWithStorage } from 'jotai/utils'
import { useAtomValue } from 'jotai'
import Form from '../../../../components/form'
import { Input, Textarea } from '@heroui/input'
import { Checkbox } from '@heroui/checkbox'
import { Select, SelectItem } from '@heroui/select'
import { create, remove, save, archive, unarchive, unstar } from './actions'
import { useForm, Controller } from 'react-hook-form'
import { useDisclosure } from '@heroui/react'
import { Popover, PopoverContent, PopoverTrigger } from '@heroui/popover'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { NumberInput } from '@heroui/number-input'
import { ConfirmUnstar } from './confirm-unstar'
import Topics from '../../[lib]/[text]/components/topics'
import FlatCard from '@/components/ui/flat-card'
import StoneSkeleton from '@/components/ui/stone-skeleton'
import LinkButton from '@repo/ui/link-button'

export function ConfirmUnstarRoot() {
    return <ConfirmUnstar.Root></ConfirmUnstar.Root>
}

export function LibrarySkeleton() {
    return (
        <FlatCard className='w-full opacity-60' background='solid'>
            <CardBody className='px-6 pt-6'>
                <StoneSkeleton className='w-48 h-10 rounded-lg' />
                <Spacer y={2} />
                <div className='flex space-x-2'>
                    <StoneSkeleton className='w-16 h-4 rounded-lg' />
                    <StoneSkeleton className='w-16 h-4 rounded-lg' />
                </div>
            </CardBody>
            <CardFooter className='px-4 pb-4 flex'>
                <StoneSkeleton className='w-24 h-9 rounded-lg' />
            </CardFooter>
        </FlatCard>
    )
}

export const recentAccessAtom = atomWithStorage<Record<string, { id: string; title: string }>>('recent-access', {}, {
    getItem: (key, initialValue) => {
        const storedValue = localStorage.getItem(key)
        return storedValue ? JSON.parse(storedValue) : initialValue
    },
    setItem: (key, value) => {
        localStorage.setItem(key, JSON.stringify(value))
    },
    removeItem: (key) => {
        localStorage.removeItem(key)
    }
})

function Library({ id, name, lang, isOwner, access, shadow, price, archived, isStarred, prompt }: {
    id: string,
    name: string,
    access: number,
    isStarred: boolean,
    lang: string,
    isOwner: boolean,
    shadow: boolean,
    price: number,
    archived: boolean,
    prompt?: string | null,
}) {
    const compact = shadow || archived

    const router = useRouter()
    const topics = ([] as string[])
        .concat(access === LIB_ACCESS_STATUS.public ? ['共享'] : [])
    const recentAccess = useAtomValue(recentAccessAtom)
    const recentAccessItem = recentAccess[id]
    const [isDeleted, setIsDeleted] = useState(false)

    const { register, handleSubmit, formState, control } = useForm<{
        id: string,
        name: string,
        access: boolean,
        price: number,
        prompt?: string | null,
    }>({
        defaultValues: {
            id,
            name,
            access: access === LIB_ACCESS_STATUS.public,
            price,
            prompt,
        }
    })

    const { isOpen, onOpen, onOpenChange } = useDisclosure()

    const [isTogglingArchive, startTogglingArchive] = useTransition()
    const [isUnstarring, startUnstarring] = useTransition()
    const MotionCard = motion.create(FlatCard)

    return (<>
        <MotionCard
            className={cn('relative', compact && 'w-fit rounded-3xl tracking-tighter')}
            animate={{ opacity: isDeleted ? 0 : 1, scale: isDeleted ? 0 : 1 }}
            transition={{ duration: 1 }}
            fullWidth
            background='solid'
            as={'div'}
            isPressable
            onPress={() => {
                router.push(`/library/${id}`)
            }}>
            {!compact && isOwner && <Button isIconOnly color='primary' variant='light' startContent={<PiFadersDuotone />} className='absolute top-2 right-2 z-1' onPress={onOpen}></Button>}
            {compact
                ? <CardBody className='pr-2 pl-3 py-2 flex flex-row items-center gap-2 relative'>
                    <div className='text-2xl font-formal'>{name}</div>
                    {
                        shadow
                            ? <LinkButton
                                href={`/library/${id}/corpus`}
                                size='sm'
                                startContent={<PiBookBookmarkDuotone className='text-lg' />}
                                color='primary'
                                variant='light'
                                radius='md'
                                isIconOnly
                            />
                            : <Button
                                size={'sm'}
                                as={'span'}
                                isLoading={isTogglingArchive}
                                startContent={!isTogglingArchive && <PiBoxArrowUpDuotone className='text-lg' />}
                                color='primary'
                                variant='light'
                                isIconOnly
                                radius='md'
                                onPress={() => {
                                    startTogglingArchive(async () => {
                                        await unarchive({ id })
                                        toast.success('已取消归档')
                                    })
                                }}
                            />
                    }
                    {
                        isStarred && <>
                            <Button
                                size={'sm'}
                                as={'span'}
                                isLoading={isUnstarring}
                                startContent={!isUnstarring && <PiStackMinusDuotone className='text-lg' />}
                                color='danger'
                                isIconOnly
                                variant='light'
                                radius='md'
                                onPress={async () => {
                                    if (await ConfirmUnstar.call()) {
                                        startUnstarring(async () => {
                                            await unstar({ id })
                                        })
                                    }
                                }}
                            />
                        </>
                    }
                </CardBody>
                : <CardBody className='px-6 pt-5 flex flex-col justify-start'>
                    <a className='text-4xl font-formal'>{name}</a>
                    <Topics topics={topics.concat([getLanguageStrategy(lang as Lang).name])}></Topics>
                </CardBody>}
            {!compact && <CardFooter className='px-4 pb-4 flex gap-4'>
                <LinkButton
                    size={'md'}
                    href={`/library/${id}/corpus`}
                    startContent={<PiBookBookmarkDuotone />}
                    variant='flat'
                    className='bg-default/20'
                >语料本</LinkButton>
                <div className='flex-1'></div>
                {recentAccessItem && <LinkButton className='-mr-2' size={'md'} color={'secondary'} startContent={<PiClockCounterClockwiseDuotone />} variant='light' prefetch href={`/library/${id}/${recentAccessItem.id}`}>
                    <span className='inline-block text-ellipsis overflow-hidden whitespace-nowrap max-w-[20vw]'>{recentAccessItem.title}</span>
                </LinkButton>}
                <Button
                    as={'span'}
                    isLoading={isTogglingArchive}
                    startContent={!isTogglingArchive && <PiBoxArrowDownDuotone />}
                    variant='flat'
                    color='primary'
                    isIconOnly
                    onPress={() => {
                        startTogglingArchive(async () => {
                            await archive({ id })
                            toast.success('已归档文库')
                        })
                    }}
                ></Button>
            </CardFooter>}
        </MotionCard>

        <Form
            actionButton={<Popover>
                <PopoverTrigger>
                    <Button isIconOnly color='danger' variant='flat' startContent={<PiTrashDuotone />} />
                </PopoverTrigger>
                <PopoverContent className='p-0'>
                    <Button color='danger' startContent={<PiWarningOctagonFill size={20} />} onPress={() => {
                        const timer = setTimeout(() => {
                            remove({ id })
                            setIsDeleted(true)
                            toast.success('删除成功')
                        }, 5000)
                        onOpenChange()
                        toast('五秒后删除……', {
                            duration: 5000,
                            icon: <PiHourglassMediumDuotone />,
                            cancel: {
                                label: '撤销',
                                onClick: () => {
                                    clearTimeout(timer)
                                    toast.dismiss()
                                },
                            },
                        })
                    }}>确认删除</Button>
                </PopoverContent>
            </Popover>}
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            isLoading={formState.isSubmitting}
            onSubmit={handleSubmit(save)}
            title='编辑文库'
        >
            <input type='hidden' {...register('id')} />
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mx-auto place-items-center'>
                <Input className='col-span-2' label='文库名' {...register('name')} />
                <Checkbox color='primary' {...register('access')} icon={<PiLockSimpleOpenDuotone />}>
                    设为公开并上架集市
                </Checkbox>
                <Controller
                    name='price'
                    control={control}
                    render={({ field }) => (
                        <NumberInput
                            {...field}
                            size='sm'
                            placeholder='0~100'
                            minValue={0}
                            maxValue={100}
                            variant='underlined'
                            label='上架价格'
                        />
                    )}
                />
            </div>
            <p className='text-xs text-center opacity-80 prose prose-sm dark:prose-invert'>你会获得销售额 ⅕ 的 LexiCoin。</p>
            <Textarea label='Talk to Your Library 默认提示词' placeholder='在文本界面唤起 AI 对话时的初始提示词。'  {...register('prompt')} />
        </Form >
    </>)
}

export function LibraryAddButton() {
    const { register, handleSubmit, formState } = useForm<{
        name: string,
        lang: Lang,
    }>({
        defaultValues: {
            name: '新文库',
            lang: 'en',
        }
    })
    const { isOpen, onOpen, onOpenChange } = useDisclosure()
    return <>
        <FlatCard className='w-full opacity-60 bg-transparent border-none' isPressable onPress={onOpen}>
            <CardBody className='px-6 pt-5 overflow-hidden'>
                <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3 }}
                    whileHover={{ scale: 1.1, rotate: 10 }}
                    className='text-7xl h-20 text-slate-700 dark:text-slate-200 flex items-center justify-center rounded-lg'><PiFolderPlusDuotone /></motion.div>
            </CardBody>
        </FlatCard>
        <Form
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            isLoading={formState.isSubmitting}
            onSubmit={handleSubmit(create)}
            title='创建文库'
        >
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mx-auto'>
                <Input isRequired startContent={<PiPackageDuotone />} label='文库名' {...register('name')} />
                <Select isRequired startContent={<PiTranslateDuotone />} label='语言' {...register('lang')} validate={value => {
                    if (!value) return '请选择语言'
                    return true
                }}>
                    {languageStrategies.map(({ type, name }) => <SelectItem key={type}>{name}</SelectItem>)}
                </Select>
            </div>
        </Form>
    </>
}

export default Library
