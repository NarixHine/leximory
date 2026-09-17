'use client'

import { Input } from '@heroui/input'
import { Select, SelectItem, SelectSection } from '@heroui/select'
import { Button } from '@heroui/button'
import { useForm, Controller } from 'react-hook-form'
import {
    PiPackageDuotone,
    PiLinkDuotone,
    PiAirplaneInFlightDuotone,
    PiAirplaneTakeoffDuotone,
    PiSparkle,
} from 'react-icons/pi'
import { importArticle, prefetchLibrary } from '@/service/import'
import { getLanguageStrategy } from '@/lib/languages'
import { toast } from 'sonner'
import { AnimatePresence, motion, useReducedMotion, Transition } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import type { Lang } from '@repo/env/config'
import isUrl from 'is-url'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useDebounceValue } from 'usehooks-ts'

type LibOption = {
    id: string
    name: string
    lang: Lang
    shadow: boolean
    archived: boolean
}

const TRANSITION: Transition = {
    duration: 0.2,
    ease: [0.3, 0.72, 0, 1],
}

const AUTO_FILL_HIGHLIGHT_MS = 1600

export default function ImportUI({ libraries }: { libraries: LibOption[] }) {
    const { register, handleSubmit, formState, control, watch, setValue, getValues } = useForm<{
        url: string
        lib: string
    }>({
        defaultValues: { url: '', lib: '' },
    })
    const buttonRef = useRef<HTMLButtonElement>(null)
    const autoFilledRef = useRef<string | null>(null)
    const [autoFilled, setAutoFilled] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const prefersReducedMotion = useReducedMotion()

    const urlValue = watch('url')
    const [debouncedUrl] = useDebounceValue(urlValue ?? '', 700)

    const { data: prefetch } = useQuery({
        queryKey: ['import-prefetch', debouncedUrl],
        queryFn: () => prefetchLibrary(debouncedUrl),
        enabled: isUrl(debouncedUrl),
        staleTime: Infinity,
        retry: false,
    })

    useEffect(() => {
        setError(null)
    }, [urlValue])

    useEffect(() => {
        const predicted = prefetch?.lib
        if (!predicted) {
            autoFilledRef.current = null
            setAutoFilled(null)
            return
        }

        const current = getValues('lib')
        const isAutoFilled = current === autoFilledRef.current
        if (current && !isAutoFilled && current !== predicted) return
        if (current === predicted) return

        setValue('lib', predicted)
        autoFilledRef.current = predicted
        setAutoFilled(predicted)

        const timeout = setTimeout(() => setAutoFilled(null), AUTO_FILL_HIGHLIGHT_MS)
        return () => clearTimeout(timeout)
    }, [prefetch?.lib, getValues, setValue])

    const activeLibs = libraries.filter(lib => !lib.shadow && !lib.archived)
    const shadowLibs = libraries.filter(lib => lib.shadow && !lib.archived)
    const archivedLibs = libraries.filter(lib => lib.archived)

    const selectedLang = (lib: string) => {
        const found = libraries.find(l => l.id === lib)
        return found?.lang as Lang | undefined
    }

    const triggerConfetti = () => {
        if (!buttonRef.current) return

        const rect = buttonRef.current.getBoundingClientRect()
        const x = (rect.left + rect.width / 2) / window.innerWidth
        const y = (rect.top + rect.height / 2) / window.innerHeight

        confetti({
            particleCount: 100,
            spread: 70,
            origin: { x, y },
            colors: ['#006FEE', '#17C964', '#F5A524', '#F31260'],
            gravity: 0.8,
            scalar: 1.2,
        })
    }

    const renderLibraryItem = (lib: LibOption) => (
        <SelectItem key={lib.id} textValue={lib.name}>
            <div className='flex flex-row items-baseline gap-3'>
                <span className='truncate'>{lib.name}</span>
                <span className='text-sm text-secondary-400 shrink-0'>
                    {getLanguageStrategy(lib.lang).name}
                </span>
            </div>
        </SelectItem>
    )

    const router = useRouter()

    return (
        <form
            onSubmit={handleSubmit(
                async ({ lib, url }) => {
                    if (!url) {
                        toast.error('请输入链接')
                        throw new Error('URL is required')
                    }
                    if (!isUrl(url)) {
                        toast.error('链接格式不正确')
                        throw new Error('Invalid URL')
                    }
                    if (!lib) {
                        toast.error('请选择文库')
                        throw new Error('Library is required')
                    }

                    if (!selectedLang(lib)) {
                        throw new Error('Invalid library selection')
                    }

                    setError(null)
                    const result = await importArticle({ url, lib })
                    if ('error' in result) {
                        setError(result.error)
                        return
                    }

                    triggerConfetti()
                    router.push(`/library/${lib}/${result.textId}`)
                },
                () => {
                    console.log('Form submission failed', formState.errors)
                },
            )}
            className='mx-auto w-full max-w-125 sm:max-w-150'
        >
            <div className='px-8 py-2'>
                <div className='flex flex-col gap-2'>
                    {/* Row 1: 将链接 [Input] 中的内容 */}
                    <div className='flex flex-wrap items-center gap-x-2.5 gap-y-3 font-semibold'>
                        <span className='text-base text-secondary-300 shrink-0'>
                            <span className='text-secondary-600'>将</span>
                            <span className='hidden sm:inline'>网页</span>
                        </span>
                        <label
                            htmlFor='url'
                            className='hidden sm:flex text-default-600 items-center gap-1'
                        >
                            <PiLinkDuotone className='size-6' /> 链接
                        </label>
                        <Input
                            {...register('url', { required: true })}
                            type='url'
                            validationBehavior='aria'
                            id='url'
                            startContent={
                                <PiLinkDuotone className='size-6 sm:hidden text-default-600' />
                            }
                            placeholder='https://www.theatlantic.com/'
                            variant='underlined'
                            color='primary'
                            size='sm'
                            className='flex-1'
                        />
                        <span className='text-base text-secondary-300 shrink-0'>
                            中的文本，<span className='text-secondary-600'>向</span>
                        </span>
                    </div>

                    {/* Row 2: 向文库 [Select] 导入 [Button] */}
                    <div className='flex flex-wrap items-center gap-x-3 gap-y-3 font-semibold'>
                        <label
                            htmlFor='lib'
                            className='hidden sm:flex text-default-600 items-center gap-1'
                        >
                            <PiPackageDuotone className='size-6' /> 文库
                        </label>
                        <motion.div layout className='relative flex-1' transition={TRANSITION}>
                            <Controller
                                name='lib'
                                control={control}
                                rules={{ required: true }}
                                render={({ field }) => (
                                    <Select
                                        {...field}
                                        id='lib'
                                        selectedKeys={field.value ? [field.value] : []}
                                        onSelectionChange={keys => {
                                            const selected = Array.from(keys)[0] as string
                                            if (selected !== autoFilledRef.current) {
                                                autoFilledRef.current = null
                                            }
                                            field.onChange(selected)
                                        }}
                                        variant='underlined'
                                        color='primary'
                                        size='sm'
                                        startContent={
                                            <PiPackageDuotone className='size-6 sm:hidden text-default-600' />
                                        }
                                        className='w-full'
                                        aria-label='目标文库'
                                        renderValue={items => {
                                            const lib = libraries.find(l => l.id === items[0]?.key)
                                            if (!lib) return null
                                            return (
                                                <motion.span
                                                    key={lib.id}
                                                    initial={
                                                        autoFilled === lib.id &&
                                                        !prefersReducedMotion
                                                            ? { opacity: 0, y: 4, filter: 'blur(4px)' }
                                                            : false
                                                    }
                                                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                                    transition={{
                                                        duration: 0.42,
                                                        ease: [0.16, 1, 0.3, 1],
                                                    }}
                                                    className='flex w-full flex-row items-baseline gap-2'
                                                >
                                                    <span className='truncate font-bold'>
                                                        {lib.name}
                                                    </span>
                                                    <span className='text-sm font-normal text-secondary-400 shrink-0'>
                                                        {getLanguageStrategy(lib.lang).name}
                                                    </span>
                                                </motion.span>
                                            )
                                        }}
                                        classNames={{
                                            popoverContent:
                                                'shadow-none border-1 p-3 border-primary-300 bg-secondary-50 rounded-4xl',
                                        }}
                                    >
                                        {activeLibs.length > 0 ? (
                                            <SelectSection>
                                                {activeLibs.map(renderLibraryItem)}
                                            </SelectSection>
                                        ) : null}
                                        {shadowLibs.length > 0 ? (
                                            <SelectSection title='默认文库'>
                                                {shadowLibs.map(renderLibraryItem)}
                                            </SelectSection>
                                        ) : null}
                                        {archivedLibs.length > 0 ? (
                                            <SelectSection title='归档文库'>
                                                {archivedLibs.map(renderLibraryItem)}
                                            </SelectSection>
                                        ) : null}
                                    </Select>
                                )}
                            />
                            <AnimatePresence>
                                {autoFilled && !prefersReducedMotion ? (
                                    <>
                                        <motion.span
                                            key='bloom'
                                            aria-hidden
                                            initial={{ opacity: 0, scaleX: 0.55, scaleY: 0.5 }}
                                            animate={{
                                                opacity: [0, 0.5, 0],
                                                scaleX: [0.55, 1, 1.08],
                                                scaleY: [0.5, 1, 1.15],
                                            }}
                                            exit={{ opacity: 0 }}
                                            transition={{
                                                duration: 1,
                                                ease: [0.22, 1, 0.36, 1],
                                                times: [0, 0.3, 1],
                                            }}
                                            className='pointer-events-none absolute inset-x-1 bottom-0 h-8 origin-bottom rounded-full bg-gradient-to-t from-secondary-400/40 via-secondary-300/20 to-transparent blur-md'
                                        />
                                        <motion.span
                                            key='sweep'
                                            aria-hidden
                                            initial={{ scaleX: 0, opacity: 0 }}
                                            animate={{ scaleX: [0, 1, 1], opacity: [0, 0.9, 0] }}
                                            exit={{ opacity: 0 }}
                                            transition={{
                                                duration: 0.9,
                                                ease: [0.22, 1, 0.36, 1],
                                                times: [0, 0.45, 1],
                                            }}
                                            className='pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-gradient-to-r from-transparent via-secondary-500 to-transparent'
                                        />
                                        <motion.span
                                            key='sparkle'
                                            aria-hidden
                                            initial={{ opacity: 0, scale: 0.4, y: 2 }}
                                            animate={{
                                                opacity: [0, 1, 0],
                                                scale: [0.4, 1, 0.85],
                                                y: [2, -3, -6],
                                            }}
                                            exit={{ opacity: 0 }}
                                            transition={{
                                                duration: 1,
                                                ease: [0.16, 1, 0.3, 1],
                                                times: [0, 0.25, 1],
                                            }}
                                            className='pointer-events-none absolute -right-0.5 -top-1 text-secondary-500'
                                        >
                                            <PiSparkle className='size-3.5' />
                                        </motion.span>
                                    </>
                                ) : null}
                            </AnimatePresence>
                        </motion.div>
                        <motion.span
                            layout
                            className='text-base text-secondary-300 shrink-0'
                            transition={TRANSITION}
                        >
                            中
                        </motion.span>
                        <motion.div layout transition={TRANSITION}>
                            <Button
                                ref={buttonRef}
                                type='submit'
                                isLoading={formState.isSubmitting || formState.isSubmitSuccessful}
                                radius='full'
                                color='primary'
                                className='font-semibold'
                                endContent={
                                    formState.isSubmitSuccessful ? (
                                        <PiAirplaneTakeoffDuotone className='size-5' />
                                    ) : (
                                        <PiAirplaneInFlightDuotone className='size-5' />
                                    )
                                }
                            >
                                {formState.isSubmitSuccessful ? '跳转中' : '导入'}
                            </Button>
                        </motion.div>
                    </div>

                    {error ? (
                        <p className='text-right text-sm font-medium text-danger-500'>{error}</p>
                    ) : null}
                </div>
            </div>
        </form>
    )
}

export function ImportUISkeleton() {
    return (
        <div className='mx-auto w-full max-w-125 sm:max-w-150'>
            <div className='px-8 pt-4 pb-10'>
                <div className='flex flex-col gap-5'>
                    {/* Row 1 skeleton */}
                    <div className='flex flex-wrap items-center gap-x-3 gap-y-3'>
                        <div className='w-22 h-5 bg-default-200 rounded-full animate-pulse' />
                        <div className='flex-1 h-6 bg-default-100 rounded-full animate-pulse' />
                        <div className='w-16 h-5 bg-default-200 rounded-full animate-pulse' />
                    </div>
                    {/* Row 2 skeleton */}
                    <div className='flex flex-wrap items-center gap-x-3 gap-y-3'>
                        <div className='w-14 h-5 bg-default-200 rounded-full animate-pulse' />
                        <div className='flex-1 h-6 bg-default-100 rounded-full animate-pulse' />
                        <div className='w-20 h-5 bg-primary-200 rounded-full animate-pulse' />
                    </div>
                </div>
            </div>
        </div>
    )
}