'use client'

import { Button } from "@heroui/button"
import { Card, CardBody, CardFooter } from "@heroui/card"
import { Chip } from "@heroui/chip"
import { Spacer } from "@heroui/spacer"
import { PiBookBookmarkDuotone, PiClockCounterClockwiseDuotone, PiUsersDuotone, PiUserDuotone, PiFadersDuotone, PiLockSimpleOpenDuotone, PiFolderPlusDuotone, PiTranslateDuotone, PiTrashDuotone, PiHourglassMediumDuotone, PiPackageDuotone, PiArchiveDuotone, PiArchiveFill, PiStackMinusDuotone } from 'react-icons/pi'
import { langMap, libAccessStatusMap, Lang } from '@/lib/config'
import Link from 'next/link'
import { contentFontFamily } from '@/lib/fonts'
import { atomWithStorage } from 'jotai/utils'
import { useAtomValue } from 'jotai'
import { Skeleton } from "@heroui/skeleton"
import Form from '../../../../components/form'
import { Input } from "@heroui/input"
import { Checkbox } from "@heroui/checkbox"
import { Select, SelectItem } from "@heroui/select"
import { create, remove, save, archive, unarchive, unstar } from './actions'
import { useForm } from 'react-hook-form'
import { useDisclosure } from "@heroui/react"
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { NumberInput } from '@heroui/number-input'
import { ConfirmUnstar } from './confirm-unstar'
import Topics from '../../[lib]/[text]/components/topics'

export function ConfirmUnstarRoot() {
    return <ConfirmUnstar.Root></ConfirmUnstar.Root>
}

export function LibrarySkeleton() {
    return (
        <Card className='w-full opacity-60' shadow='sm'>
            <CardBody className='px-6 pt-5'>
                <Skeleton className='w-48 h-10 rounded-lg' />
                <Spacer y={8} />
                <div className='flex space-x-2'>
                    <Skeleton className='w-16 h-6 rounded-lg' />
                    <Skeleton className='w-16 h-6 rounded-lg' />
                </div>
            </CardBody>
            <CardFooter className='px-4 pb-4 flex gap-4'>
                <Skeleton className='w-24 h-9 rounded-lg' />
                <div className='flex flex-col gap-1'>
                    <Skeleton className='w-16 h-3 rounded-lg' />
                    <Skeleton className='w-12 h-5 rounded-lg' />
                </div>
            </CardFooter>
        </Card>
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

function Library({ id, name, lexicon, lang, isOwner, access, orgId, orgs, shadow, price, archived, isStarred }: {
    id: string,
    name: string,
    access: number,
    isStarred: boolean,
    lexicon?: {
        count: number,
    },
    lang: string,
    isOwner: boolean,
    orgId: string | null | undefined,
    shadow: boolean,
    orgs: { label: string, name: string }[],
    price: number,
    archived: boolean,
}) {
    const compact = shadow || archived

    const router = useRouter()
    const topics = ([] as string[])
        .concat(access === libAccessStatusMap.public ? ['共享'] : [])
    const recentAccess = useAtomValue(recentAccessAtom)
    const recentAccessItem = recentAccess[id]
    const [isDeleted, setIsDeleted] = useState(false)

    const { register, handleSubmit, formState } = useForm<{
        id: string,
        name: string,
        access: boolean,
        org: string,
        price: number,
    }>({
        defaultValues: {
            id,
            name,
            access: access === libAccessStatusMap.public,
            org: orgId ?? 'none',
            price,
        }
    })

    const { isOpen, onOpen, onOpenChange } = useDisclosure()

    const [isTogglingArchive, startTogglingArchive] = useTransition()
    const [isUnstarring, startUnstarring] = useTransition()

    return (<motion.div
        className={cn('relative', compact ? 'px-2 py-2' : 'w-full')}
        animate={{ opacity: isDeleted ? 0 : 1, scale: isDeleted ? 0 : 1 }}
        transition={{ duration: 1 }}
    >
        {!compact && isOwner && <Button isIconOnly color='warning' variant='light' startContent={<PiFadersDuotone />} className='absolute top-2 right-2 z-10' onPress={onOpen}></Button>}
        <Card fullWidth shadow='sm' as={'div'} isPressable onPress={() => {
            router.push(`/library/${id}`)
        }}>
            {compact
                ? <CardBody className='px-5 py-4 flex flex-row items-center gap-3'>
                    <div className='text-2xl' style={{
                        fontFamily: contentFontFamily
                    }}>{name}</div>
                    {
                        shadow
                            ? <Button
                                as={Link}
                                href={`/library/${id}/corpus`}
                                size='sm'
                                startContent={<PiBookBookmarkDuotone />}
                                color='primary'
                                variant='flat'
                                isIconOnly
                            />
                            : <Button
                                size={'sm'}
                                as={'span'}
                                isLoading={isTogglingArchive}
                                startContent={!isTogglingArchive && <PiArchiveFill />}
                                color='warning'
                                variant='flat'
                                isIconOnly
                                onPress={() => {
                                    startTogglingArchive(async () => {
                                        await unarchive({ id })
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
                                startContent={!isUnstarring && <PiStackMinusDuotone />}
                                color='danger'
                                isIconOnly
                                variant='flat'
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
                : <CardBody className='px-6 pt-6 flex flex-col justify-start'>
                    <a className='text-4xl' style={{
                        fontFamily: contentFontFamily
                    }}>{name}</a>
                    <Topics topics={topics.concat([langMap[lang as Lang]])}></Topics>
                </CardBody>}
            {!compact && <CardFooter className='px-4 pb-4 flex gap-4'>
                <Button size={'md'} as={Link} href={`/library/${id}/corpus`} startContent={<PiBookBookmarkDuotone />} variant='flat'>语料本</Button>
                {lexicon && <div className='flex flex-col items-center'>
                    <p className={cn('text-xs opacity-80')}>词汇量</p>
                    <Chip color='primary' variant='dot' className='border-none -mt-1'>{lexicon.count}</Chip>
                </div>}
                <div className='flex-1'></div>
                {recentAccessItem && <Button className='-mr-2' size={'md'} color={'secondary'} startContent={<PiClockCounterClockwiseDuotone />} variant='light' prefetch as={Link} href={`/library/${id}/${recentAccessItem.id}`}>
                    <span className='inline-block text-ellipsis overflow-hidden whitespace-nowrap max-w-[20vw]'>{recentAccessItem.title}</span>
                </Button>}
                <Button
                    as={'span'}
                    isLoading={isTogglingArchive}
                    startContent={!isTogglingArchive && <PiArchiveDuotone />}
                    variant='flat'
                    color='warning'
                    isIconOnly
                    onPress={() => {
                        startTogglingArchive(async () => {
                            await archive({ id })
                        })
                    }}
                ></Button>
            </CardFooter>}
        </Card>

        <Form
            actionButton={<Button isIconOnly color='danger' variant='flat' startContent={<PiTrashDuotone />} onPress={() => {
                const timer = setTimeout(() => {
                    remove({ id })
                    setIsDeleted(true)
                    toast.success('删除成功')
                }, 5000)
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
            }}></Button>}
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            isLoading={formState.isSubmitting}
            onSubmit={handleSubmit(save)}
            title='编辑文库'
        >
            <input type='hidden' {...register('id')} />
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mx-auto place-items-center'>
                <Input label='文库名' {...register('name')} />
                <Select label='文库所属小组' {...register('org')} >
                    <SelectItem startContent={<PiUserDuotone />} key='none'>无</SelectItem>
                    {orgs.map(org => <SelectItem startContent={<PiUsersDuotone />} key={org.name}>{org.label}</SelectItem>) as any}
                </Select>
                <Checkbox color='secondary' {...register('access')} icon={<PiLockSimpleOpenDuotone />}>
                    设为公开并上架集市
                </Checkbox>
                <NumberInput size='sm' placeholder='0~100' minValue={0} maxValue={100} variant='underlined' label='上架价格' {...register('price')} onChange={(e) => {
                    register('price').onChange({ target: { value: e } })
                }} />
            </div>
            <p className='text-xs opacity-80 prose prose-sm dark:prose-invert'>你会获得销售额 ⅕ 的 LexiCoin。</p>
        </Form>
    </motion.div>)
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
        <Card className='w-full opacity-60 bg-transparent' isPressable shadow='sm' onPress={onOpen}>
            <CardBody className='px-6 pt-5 overflow-hidden'>
                <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3 }}
                    whileHover={{ scale: 1.1, rotate: 10 }}
                    className='text-7xl h-20 text-slate-700 dark:text-slate-200 flex items-center justify-center rounded-lg'><PiFolderPlusDuotone /></motion.div>
            </CardBody>
        </Card>
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
                    {Object.entries(langMap).map(([key, value]) => <SelectItem key={key}>{value}</SelectItem>)}
                </Select>
            </div>
        </Form>
    </>
}

export default Library
