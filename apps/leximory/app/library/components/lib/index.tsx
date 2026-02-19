'use client'

import { Button } from '@heroui/button'
import { CardBody } from '@heroui/card'
import { PiFadersDuotone, PiLockSimpleOpenDuotone, PiFolderPlusDuotone, PiTranslateDuotone, PiTrashDuotone, PiHourglassMediumDuotone, PiPackageDuotone, PiBoxArrowDownDuotone, PiBoxArrowUpDuotone, PiWarningOctagonFill, PiClockDuotone, PiStackMinusDuotone, PiSparkle } from 'react-icons/pi'
import { LIB_ACCESS_STATUS, Lang } from '@repo/env/config'
import { getLanguageStrategy, languageStrategies } from '@/lib/languages'
import { atomWithStorage } from 'jotai/utils'
import { useAtomValue } from 'jotai'
import Form from '@/components/form'
import { Input, Textarea } from '@heroui/input'
import { Checkbox } from '@heroui/checkbox'
import { Select, SelectItem } from '@heroui/select'
import { create, remove, save, archive, unarchive, unstar } from './actions'
import { useForm, Controller } from 'react-hook-form'
import { useDisclosure } from '@heroui/react'
import { Popover, PopoverContent, PopoverTrigger } from '@heroui/popover'
import { motion } from 'framer-motion'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { NumberInput } from '@heroui/number-input'
import { ConfirmUnstar } from './confirm-unstar'
import StoneSkeleton from '@/components/ui/stone-skeleton'
import Link from 'next/link'

export function ConfirmUnstarRoot() {
    return <ConfirmUnstar.Root></ConfirmUnstar.Root>
}

export function LibrarySkeleton() {
    return (
        <div className='break-inside-avoid rounded-3xl bg-default-50 p-3.5'>
            <div className='rounded-2xl bg-default-100 px-6 py-7'>
                <StoneSkeleton className='w-12 h-4 rounded-lg mb-3' />
                <StoneSkeleton className='w-full h-7 rounded-lg' />
            </div>
            <div className='flex items-center justify-between px-2 pt-2'>
                <StoneSkeleton className='w-24 h-6 rounded-lg' />
                <div className='flex gap-1'>
                    <StoneSkeleton className='w-8 h-8 rounded-xl' />
                    <StoneSkeleton className='w-8 h-8 rounded-xl' />
                </div>
            </div>
        </div>
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

    if (isDeleted) return null

    // Archived / shadow compact pill variant
    if (compact) {
        return (
            <motion.div
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className='flex items-center rounded-full bg-default-50 py-1.5 pr-1.5 pl-5 transition-colors hover:bg-default-100/50'
            >
                <span className='text-sm font-medium text-default-500'>{name}</span>
                <div className='ml-3 flex items-center'>
                    {archived && !shadow && (
                        <Button
                            size='sm'
                            isIconOnly
                            variant='light'
                            radius='full'
                            isLoading={isTogglingArchive}
                            className='text-default-400 hover:bg-default-200 hover:text-default-600 h-8 w-8 min-w-8'
                            onPress={() => {
                                startTogglingArchive(async () => {
                                    await unarchive({ id })
                                })
                            }}
                            aria-label={`取消归档 ${name}`}
                        >
                            {!isTogglingArchive && <PiBoxArrowUpDuotone className='text-sm' />}
                        </Button>
                    )}
                    {isStarred && (
                        <Button
                            size='sm'
                            isIconOnly
                            variant='light'
                            radius='full'
                            isLoading={isUnstarring}
                            className='text-default-400 hover:bg-default-200 hover:text-default-600 h-8 w-8 min-w-8'
                            onPress={async () => {
                                if (await ConfirmUnstar.call()) {
                                    startUnstarring(async () => {
                                        await unstar({ id })
                                    })
                                }
                            }}
                            aria-label={`移除收藏 ${name}`}
                        >
                            {!isUnstarring && <PiStackMinusDuotone className='text-sm' />}
                        </Button>
                    )}
                    {isOwner && (
                        <>
                            <div className='mx-0.5 h-4 w-px bg-default-200' />
                            <Button
                                size='sm'
                                isIconOnly
                                variant='light'
                                radius='full'
                                className='text-default-400 hover:bg-default-200 h-8 w-8 min-w-8'
                                onPress={() => {
                                    remove({ id })
                                    setIsDeleted(true)
                                }}
                                aria-label={`删除 ${name}`}
                            >
                                <PiTrashDuotone className='text-sm' />
                            </Button>
                        </>
                    )}
                </div>
            </motion.div>
        )
    }

    // Normal library card — neo-minimalist design
    return (<>
        <Link
            href={`/library/${id}`}
            className='block break-inside-avoid rounded-3xl bg-default-50 p-3.5 transition-all duration-300 hover:bg-default-100/50'
        >
            {/* Inner title block */}
            <div className='rounded-2xl bg-default-100 px-6 py-7'>
                <span className='mb-3 inline-block font-mono text-xs tracking-wider text-default-400'>
                    {getLanguageStrategy(lang as Lang).name}
                </span>
                <h2 className='font-formal text-2xl leading-snug tracking-tight text-foreground text-balance'>
                    {name}
                </h2>
            </div>

            {/* Footer area */}
            <div className='flex items-center justify-between px-2 pt-2'>
                {recentAccessItem ? (
                    <span
                        className='group/link flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-default-400 transition-colors hover:bg-default-200 hover:text-default-600'
                    >
                        <PiClockDuotone className='h-3.5 w-3.5' />
                        <span className='max-w-[15ch] truncate'>{recentAccessItem.title}</span>
                    </span>
                ) : (
                    <div />
                )}
                <div className='flex items-center gap-1'>
                    {isOwner && (
                        <button
                            type='button'
                            className='flex h-8 w-8 items-center justify-center rounded-xl text-default-400 transition-colors hover:bg-default-200 hover:text-default-600'
                            aria-label={`${name} 设置`}
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                onOpen()
                            }}
                        >
                            <PiFadersDuotone className='h-4 w-4' />
                        </button>
                    )}
                    <button
                        type='button'
                        className='flex h-8 w-8 items-center justify-center rounded-xl text-default-400 transition-colors hover:bg-default-200 hover:text-default-600'
                        aria-label={`归档 ${name}`}
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            startTogglingArchive(async () => {
                                await archive({ id })
                            })
                        }}
                    >
                        <PiBoxArrowDownDuotone className='h-4 w-4' />
                    </button>
                </div>
            </div>
        </Link>

        <Form
            actionButton={<Popover>
                <PopoverTrigger>
                    <Button isIconOnly color='primary' variant='flat' startContent={<PiTrashDuotone />} />
                </PopoverTrigger>
                <PopoverContent className='p-0'>
                    <Button color='primary' startContent={<PiWarningOctagonFill size={20} />} onPress={() => {
                        remove({ id })
                        setIsDeleted(true)
                        onOpenChange()
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
        <button
            type='button'
            onClick={onOpen}
            className='flex h-10 items-center gap-2 rounded-2xl bg-default-600 dark:bg-default-400 px-5 text-sm font-medium text-white dark:text-default-900 transition-colors hover:bg-default-700 dark:hover:bg-default-300'
        >
            <PiSparkle className='h-4 w-4' />
            <span>新建文库</span>
        </button>
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
