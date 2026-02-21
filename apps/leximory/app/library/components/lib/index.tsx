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
import { create, remove, save, archive, unarchive, unstar } from './actions'
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
        <div className={('break-inside-avoid rounded-3xl bg-default-50 p-3.5 animate-pulse duration-3000')}>
            <div className='rounded-2xl bg-default-100 px-6 pb-7 pt-5'>
                <div className='w-12 h-4 rounded-xl mb-4 bg-default-200 opacity-30' />
                {new Array(rowCount || 1).fill(0).map((_, i) => (
                    <div key={i} className='w-full h-7 my-2 rounded-xl bg-default-200 opacity-30' />
                ))}
            </div>
            <div className='flex items-center justify-between px-2 pt-2'>
                <div className='w-24 h-6 rounded-xl bg-default-200 opacity-30' />
                <div className='flex gap-1'>
                    <div className='w-8 h-8 rounded-xl bg-default-200 opacity-30' />
                    <div className='w-8 h-8 rounded-xl bg-default-200 opacity-30' />
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

function Library({ id, name, lang, owner, isOwner, access, shadow, price, archived, isStarred, prompt }: {
    id: string,
    name: string,
    access: number,
    isStarred: boolean,
    lang: string,
    owner: string,
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

    // Archived / shadow compact pill variant
    if (compact) {
        return (
            <Card
                isPressable
                as={'div'}
                onPress={() => {
                    router.push(`/library/${id}`)
                }}
                shadow='none'
                className='p-0 bg-transparent'
            >
                <CardBody className='p-0'>
                    <div className='flex items-center flex-nowrap rounded-3xl bg-secondary-50 py-1.5 pr-1.5 pl-5'>
                        <div className='text-base font-formal font-medium text-secondary-500'>{name}</div>
                        <div className='ml-3 flex items-center'>
                            {archived && !shadow && (
                                <Button
                                    color='secondary'
                                    size='sm'
                                    isIconOnly
                                    variant='light'
                                    isLoading={isTogglingArchive}
                                    onPress={() => {
                                        startTogglingArchive(async () => {
                                            await unarchive({ id })
                                        })
                                    }}
                                    aria-label={`取消归档 ${name}`}
                                >
                                    {!isTogglingArchive && <PiBoxArrowUp className='text-sm' />}
                                </Button>
                            )}
                            {isStarred && (
                                <Button
                                    color='secondary'
                                    size='sm'
                                    isIconOnly
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
                                >
                                    {!isUnstarring && <PiStackMinus className='text-sm' />}
                                </Button>
                            )}
                            {isOwner && !shadow && (
                                <>
                                    <div className='mx-0.5 h-4 w-px bg-default-200' />
                                    <Popover placement='bottom'>
                                        <PopoverTrigger>
                                            <Button
                                                color='secondary'
                                                size='sm'
                                                isIconOnly
                                                variant='light'
                                                aria-label={`删除 ${name}`}
                                            >
                                                <PiTrash className='text-sm' />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className='p-0'>
                                            <Button
                                                color='danger'
                                                startContent={<PiWarningOctagonFill size={16} />}
                                                size='sm'
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
                                    <div className='mx-0.5 h-4 w-px bg-default-200' />
                                    <Button
                                        isIconOnly
                                        color='secondary'
                                        variant='light'
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
        )
    }

    // Normal library card — unified design with avatar
    return (<>
        <LibraryCardBase
            id={id}
            name={name}
            lang={lang}
            footer={<>
                {recentAccessItem ? (
                    <Link
                        href={`/library/${id}/${recentAccessItem.id}`}
                        className='group/link flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-default-400'
                    >
                        <LoadingIndicatorWrapper size='sm' color='secondary' classNames={{
                            wrapper: 'size-4',
                            circle1: 'size-4',
                            circle2: 'size-4'
                        }}>
                            <PiClock className='size-4' />
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
                            className='flex h-8 w-8 items-center justify-center rounded-xl'
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
                        className='flex h-8 w-8 items-center justify-center rounded-xl'
                        aria-label={`归档 ${name}`}
                        onPress={() => {
                            startTogglingArchive(async () => {
                                await archive({ id })
                            })
                        }}
                        size='sm'
                        isIconOnly
                        startContent={<PiBoxArrowDown className='size-4' />}
                    />
                </div>
            </>}
        />

        <Form
            actionButton={<Popover>
                <PopoverTrigger>
                    <Button isIconOnly color='primary' variant='flat' startContent={<PiTrash />} />
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
            <p className='text-xs text-center opacity-80 prose prose-sm dark:prose-invert'>你会获得销售额 ⅕ 的 LexiCoin。</p>
            <Textarea label='Talk to Your Library 默认提示词' placeholder='在文本界面唤起 AI 对话时的初始提示词。'  {...register('prompt')} />
        </Form>
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
        <Button
            type='button'
            radius='full'
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
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mx-auto'>
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
