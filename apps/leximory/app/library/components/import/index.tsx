'use client'

import { Input } from '@heroui/input'
import { Select, SelectItem, SelectSection } from '@heroui/select'
import { Button } from '@heroui/button'
import { useForm, Controller } from 'react-hook-form'
import { PiPackageDuotone, PiLinkDuotone, PiAirplaneInFlightDuotone } from 'react-icons/pi'
import { scrapeArticle } from '@/server/ai/scrape'
import { addAndGenerateText } from '@/service/text'
import { getLanguageStrategy } from '@/lib/languages'
import { toast } from 'sonner'
import type { Lang } from '@repo/env/config'

type LibOption = {
    id: string
    name: string
    lang: Lang
    shadow: boolean
    archived: boolean
}

export default function ImportUI({ libraries }: { libraries: LibOption[] }) {
    const { register, handleSubmit, formState, control } = useForm<{ url: string, lib: string }>({
        defaultValues: { url: '', lib: '' }
    })

    // Group libraries: active, shadow, archived
    const activeLibs = libraries.filter(lib => !lib.shadow && !lib.archived)
    const shadowLibs = libraries.filter(lib => lib.shadow && !lib.archived)
    const archivedLibs = libraries.filter(lib => lib.archived)

    const selectedLang = (lib: string) => {
        const found = libraries.find((l) => l.id === lib)
        return found?.lang as Lang | undefined
    }

    const renderLibraryItem = (lib: LibOption) => (
        <SelectItem key={lib.id} textValue={lib.name}>
            <div className='flex flex-row items-baseline gap-2'>
                <span className='truncate'>
                    {lib.name}
                </span>
                <span className='text-sm text-secondary-400 shrink-0'>
                    {getLanguageStrategy(lib.lang).name}
                </span>
            </div>
        </SelectItem>
    )

    return (
        <form
            onSubmit={handleSubmit(async (data) => {
                if (!data.url || !data.lib) return
                const lang = selectedLang(data.lib)
                if (!lang) {
                    toast.error('请选择目标文库')
                    return
                }
                try {
                    const { title, content } = await scrapeArticle(data.url)
                    if (content.length > getLanguageStrategy(lang).maxArticleLength) {
                        toast.error('识别内容过长，请手动录入')
                        return
                    }
                    addAndGenerateText({ title, content, lib: data.lib })
                } catch {
                    toast.error('文章解析失败，请检查链接')
                }
            })}
            className='mx-auto w-full max-w-125 sm:max-w-150'
        >
            <div className='px-8 pt-2 pb-10'>
                <div className='flex flex-col gap-2'>
                    {/* Row 1: 将链接 [Input] 中的内容 */}
                    <div className='flex flex-wrap items-center gap-x-2.5 gap-y-3 font-semibold'>
                        <span className='text-base text-secondary-300 shrink-0'><span className='text-secondary-600'>将</span><span className='hidden sm:inline'>网页</span></span>
                        <label htmlFor='url' className='hidden sm:flex text-default-600 items-center gap-1'>
                            <PiLinkDuotone className='size-6' /> 链接
                        </label>
                        <Input
                            {...register('url', { required: true })}
                            id='url'
                            startContent={<PiLinkDuotone className='size-6 sm:hidden text-default-600' />}
                            placeholder='https://www.nytimes.com/'
                            variant='underlined'
                            color='primary'
                            size='sm'
                            className='flex-1'
                        />
                        <span className='text-base text-secondary-300 shrink-0'>中的文本，<span className='text-secondary-600'>向</span></span>
                    </div>

                    {/* Row 2: 向文库 [Select] 导入 [Button] */}
                    <div className='flex flex-wrap items-center gap-x-3 gap-y-3 font-semibold'>
                        <label htmlFor='lib' className='hidden sm:flex text-default-600 items-center gap-1'>
                            <PiPackageDuotone className='size-6' /> 文库
                        </label>
                        <Controller
                            name='lib'
                            control={control}
                            rules={{ required: true }}
                            render={({ field }) => (
                                <Select
                                    {...field}
                                    id='lib'
                                    selectedKeys={field.value ? [field.value] : []}
                                    onSelectionChange={(keys) => {
                                        const selected = Array.from(keys)[0] as string
                                        field.onChange(selected)
                                    }}
                                    variant='underlined'
                                    color='primary'
                                    size='sm'
                                    startContent={<PiPackageDuotone className='size-6 sm:hidden text-default-600' />}
                                    className='flex-1'
                                    aria-label='目标文库'
                                    classNames={{
                                        popoverContent: 'shadow-none border-1 p-3 border-primary-300 bg-secondary-50 rounded-3xl',
                                    }}
                                >
                                    {activeLibs.length > 0 ? (
                                        <SelectSection title='文库'>
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
                        <span className='text-base text-secondary-300 shrink-0'>中</span>
                        <Button
                            type='submit'
                            isLoading={formState.isSubmitting}
                            radius='full'
                            color='primary'
                            aria-label='导入'
                            endContent={<PiAirplaneInFlightDuotone className='size-5' />}
                        >
                            导入
                        </Button>
                    </div>
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
