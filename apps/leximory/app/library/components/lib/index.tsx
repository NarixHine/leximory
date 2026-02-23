'use client'

import { Button } from '@heroui/button'
import { Card, CardBody } from '@heroui/card'
import { PiFaders, PiLockSimpleOpen, PiFolderPlus, PiTranslate, PiTrash, PiPackage, PiBoxArrowDown, PiBoxArrowUp, PiWarningOctagonFill, PiClock, PiStackMinus, PiBookBookmark } from 'react-icons/pi'
import { LIB_ACCESS_STATUS, Lang } from '@repo/env/config'
import { languageStrategies } from '@/lib/languages'
import { atomWithStorage } from 'jotai/utils'
import { useAtomValue } from 'jotai'
import Form from '@/components/form'
import { Input, Textarea } from '@heroui/input'
import { Checkbox } from '@heroui/checkbox'
import { Select, SelectItem } from '@heroui/select'
import { create, remove, save, archive, unarchive, unstar } from '@/service/library'
import { useForm, Controller } from 'react-hook-form'
import { useDisclosure } from '@heroui/react'
import { Popover, PopoverContent, PopoverTrigger } from '@heroui/popover'
import { useState, useTransition } from 'react'
import { NumberInput } from '@heroui/number-input'
import { ConfirmUnstar } from './confirm-unstar'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import LoadingIndicatorWrapper from '@/components/ui/loading-indicator-wrapper'
import LibraryCardBase from '@/components/library-card'

export function ConfirmUnstarRoot() {
    return <ConfirmUnstar.Root></ConfirmUnstar.Root>
}

export function LibrarySkeleton({ rowCount }: { rowCount?: number }) {
    return (
        <div className={('break-inside-avoid rounded-4xl bg-default-50 p-3.5 animate-pulse duration-3000')}>
            <div className='bg-default-100 px-6 pt-5 pb-7 rounded-2xl'>
                <div className='bg-default-200 opacity-30 mb-4 rounded-xl w-12 h-4' />
                {new Array(rowCount || 1).fill(0).map((_, i) => (
                    <div key={i} className='bg-default-200 opacity-30 my-2 rounded-xl w-full h-7' />
                ))}
            </div>
            <div className='flex justify-between items-center px-2 pt-2'>
                <div className='bg-default-200 opacity-30 rounded-xl w-24 h-6' />
                <div className='flex gap-1'>
                    <div className='bg-default-200 opacity-30 rounded-xl w-8 h-8' />
                    <div className='bg-default-200 opacity-30 rounded-xl w-8 h-8' />
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

    const router = useRouter()

    if (isDeleted) return null

    const card = compact ? (
        <Card
            isPressable
            as={'div'}
            onPress={() => {
                router.push(`/library/${id}`)
            }}
            shadow='none'
            className='bg-transparent p-0'
        >
            <CardBody className='p-0'>
                <div className='flex flex-nowrap items-center bg-secondary-50 py-1.5 pr-1.5 pl-5 rounded-4xl'>
                    <div className='text-secondary-500 text-base'>{name}</div>
                    <div className='flex items-center ml-3'>
                        {archived && !shadow && (<>
                            <div className='bg-default-200 mx-0.5 w-px h-4' />
                            <Button
                                color='secondary'
                                size='sm'
                                isIconOnly
                                variant='light'
                                radius='full'
                                isLoading={isTogglingArchive}
                                onPress={() => {
                                    startTogglingArchive(async () => {
                                        await unarchive({ id })
                                    })
                                }}
                                aria-label={`取消归档 ${name}`}
                                startContent={!isTogglingArchive && <PiBoxArrowUp className='size-4' />}
                            />
                        </>)}
                        {isStarred && (<>
                            <div className='bg-default-200 mx-0.5 w-px h-4' />
                            <Button
                                color='secondary'
                                size='sm'
                                isIconOnly
                                radius='full'
                                variant='light'
                                isLoading={isUnstarring}
                                onPress={async () => {
                                    if (await ConfirmUnstar.call()) {
                                        startUnstarring(async () => {
                                            await unstar({ id })
                                        })
                                    }
                                }}
                                aria-label={`移除收藏 ${name}`}
                                startContent={!isUnstarring && <PiStackMinus className='text-sm' />}
                            />
                        </>)}
                        {isOwner && !shadow && (
                            <>
                                <div className='bg-default-200 mx-0.5 w-px h-4' />
                                <Button
                                    color='secondary'
                                    size='sm'
                                    isIconOnly
                                    variant='light'
                                    radius='full'
                                    aria-label={`${name} 设置`}
                                    onPress={() => {
                                        onOpen()
                                    }}
                                    startContent={<PiFaders className='size-4' />}
                                />
                                <div className='bg-default-200 mx-0.5 w-px h-4' />
                                <Popover placement='bottom'>
                                    <PopoverTrigger>
                                        <Button
                                            color='secondary'
                                            size='sm'
                                            isIconOnly
                                            variant='light'
                                            radius='full'
                                            aria-label={`删除 ${name}`}
                                            startContent={<PiTrash className='text-sm' />}
                                        />
                                    </PopoverTrigger>
                                    <PopoverContent className='p-0'>
                                        <Button
                                            color='danger'
                                            startContent={<PiWarningOctagonFill size={16} />}
                                            size='sm'
                                            radius='full'
                                            onPress={() => {
                                                remove({ id })
                                                setIsDeleted(true)
                                            }}
                                        >确认删除</Button>
                                    </PopoverContent>
                                </Popover>
                            </>
                        )}
                        {shadow && (
                            <>
                                <div className='bg-default-200 mx-0.5 w-px h-4' />
                                <Button
                                    isIconOnly
                                    color='secondary'
                                    variant='light'
                                    radius='full'
                                    startContent={<PiBookBookmark size={16} />}
                                    size='sm'
                                    as={Link}
                                    href={`/library/${id}/corpus`}
                                />
                            </>
                        )}
                    </div>
                </div>
            </CardBody>
        </Card>
    ) : (
        <LibraryCardBase
            id={id}
            name={name}
            lang={lang}
            footer={<>
                {recentAccessItem ? (
                    <Link
                        href={`/library/${id}/${recentAccessItem.id}`}
                        className='group/link flex items-center gap-1.5 px-2.5 py-1.5 ml-1.25 rounded-xl font-medium text-default-400 text-sm'
                    >
                        <LoadingIndicatorWrapper variant='spinner' color='secondary' classNames={{
                            wrapper: 'size-5',
                            circle1: 'size-5',
                            circle2: 'size-5'
                        }}>
                            <PiClock className='size-5' />
                        </LoadingIndicatorWrapper>
                        <span className='max-w-[15ch] truncate'>{recentAccessItem.title}</span>
                    </Link>
                ) : (
                    <div />
                )}
                <div className='flex items-center gap-1'>
                    {isOwner && (
                        <Button
                            type='button'
                            variant='light'
                            className='flex justify-center items-center rounded-xl w-8 h-8'
                            aria-label={`${name} 设置`}
                            onPress={() => {
                                onOpen()
                            }}
                            isIconOnly
                            size='sm'
                            startContent={<PiFaders className='size-4' />}
                        />
                    )}
                    <Button
                        variant='light'
                        type='button'
                        className='flex justify-center items-center rounded-xl w-8 h-8'
                        aria-label={`归档 ${name}`}
                        onPress={() => {
                            startTogglingArchive(async () => {
                                await archive({ id })
                            })
                        }}
                        size='sm'
                        isIconOnly
                        isLoading={isTogglingArchive}
                        startContent={!isTogglingArchive && <PiBoxArrowDown className='size-4' />}
                    />
                </div>
            </>}
        />
    )

    return <>
        {card}
        <Form
            actionButton={<Popover>
                <PopoverTrigger>
                    <Button radius='full' isIconOnly color='danger' variant='light' startContent={<PiTrash />} />
                </PopoverTrigger>
                <PopoverContent className='p-0'>
                    <Button radius='full' color='danger' startContent={<PiWarningOctagonFill size={20} />} onPress={() => {
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
            <div className='place-items-center gap-4 grid grid-cols-1 sm:grid-cols-2 mx-auto'>
                <Input className='col-span-2' label='文库名' {...register('name')} />
                <Checkbox color='primary' {...register('access')} icon={<PiLockSimpleOpen />}>
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
            <p className='opacity-80 dark:prose-invert text-xs text-center prose prose-sm'>你会获得销售额 ⅕ 的 LexiCoin。</p>
            <Textarea label='Talk to Your Library 默认提示词' placeholder='在文本界面唤起 AI 对话时的初始提示词。'  {...register('prompt')} />
        </Form>
    </>
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
        <Button
            type='button'
            radius='full'
            variant='flat'
            onPress={onOpen}
            startContent={<PiFolderPlus className='size-6' />}
        >
            新建文库
        </Button>
        <Form
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            isLoading={formState.isSubmitting}
            onSubmit={handleSubmit(create)}
            title='创建文库'
        >
            <div className='gap-4 grid grid-cols-1 sm:grid-cols-2 mx-auto'>
                <Input isRequired startContent={<PiPackage />} label='文库名' {...register('name')} />
                <Select isRequired startContent={<PiTranslate />} label='语言' {...register('lang')} validate={value => {
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
