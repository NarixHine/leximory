'use client'

import { Button, Card, CardBody, CardFooter, Chip, Divider, Spacer } from '@nextui-org/react'
import { PiBookBookmarkDuotone } from 'react-icons/pi'
import Options from './options'
import { langMap, colorMap, supportedLangs, libAccessStatusMap, accessOptions, Lang } from '@/lib/config'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { postFontFamily } from '@/lib/fonts'
import { atomWithStorage } from 'jotai/utils'
import { useAtomValue } from 'jotai'

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

function Library({ id, name, lexicon, lang, save, del, isOwner, access, orgId, orgs, shortcut }: {
    id: string,
    name: string,
    access: number,
    lexicon: {
        count: number,
    },
    lang: string,
    save: (form: FormData) => void,
    del?: () => Promise<void>,
    isOwner: boolean,
    orgId: string | null | undefined,
    shortcut: boolean,
    orgs: { label: string, name: string }[]
}) {
    const router = useRouter()
    const topics = ([] as string[])
        .concat(access === libAccessStatusMap.public ? ['共享'] : [])
        .concat(shortcut ? ['快捷保存'] : [])

    const recentAccess = useAtomValue(recentAccessAtom)
    const recentAccessItem = recentAccess[id]

    return (<div className='w-full relative'>
        <Card fullWidth shadow='sm' isPressable onPress={() => {
            router.push(`/library/${id}`)
        }}>
            <CardBody className='p-6'>
                <a className='text-4xl' style={{
                    fontFamily: postFontFamily
                }}>{name}</a>
                <Spacer y={5}></Spacer>
                <div className='flex space-x-2'>
                    {[langMap[lang as Lang]].concat(topics).map(tag => <Chip key={tag} variant='flat' color={colorMap[tag]}>{tag}</Chip>)}
                </div>
            </CardBody>
            <Divider></Divider>
            <CardFooter className='p-4 flex gap-4'>
                <Button onClick={(e) => { e.stopPropagation() }} as={Link} href={`/library/${id}/corpus`} startContent={<PiBookBookmarkDuotone />} color='primary' variant='flat'>语料本</Button>
                <div className='flex flex-col items-start'>
                    <p className='text-xs opacity-80'>积累词汇</p>
                    <Chip color='warning' variant='dot' className='border-none'>{lexicon.count}</Chip>
                </div>
                {recentAccessItem && <div className='flex flex-col items-start'>
                    <p className='text-xs opacity-80'>最近访问</p>
                    <Chip color='secondary' variant='dot' as={Link} href={`/library/${id}/${recentAccessItem.id}`} className='border-none cursor-pointer' onClick={(e) => { e.stopPropagation() }}><span className='inline-block text-ellipsis overflow-hidden whitespace-nowrap max-w-[20vw] align-middle'>{recentAccessItem.title}</span></Chip>
                </div>}
            </CardFooter>
        </Card>
        {isOwner && <Options
            del={del}
            action={save}
            shareUrl={access === libAccessStatusMap.public ? `/library/${id}` : undefined}
            inputs={[{
                name: 'name',
                label: '文库名',
                value: name
            }]}
            selects={[{
                name: 'access',
                label: '权限',
                value: Object.keys(libAccessStatusMap).find(key => libAccessStatusMap[key as keyof typeof libAccessStatusMap] === access),
                options: accessOptions
            }, {
                name: 'lang',
                label: '语言',
                value: lang,
                options: supportedLangs.map(lang => ({
                    name: lang,
                    label: langMap[lang]
                })),
                disabled: true
            }, {
                name: 'org',
                label: '文库所属小组',
                value: typeof orgId !== 'string' ? 'none' : orgId,
                options: orgs.concat({
                    label: '无',
                    name: 'none'
                }),
                isAdvanced: true
            }, {
                name: 'shortcut',
                label: 'iOS Shortcuts',
                value: shortcut ? 'true' : 'false',
                options: [{
                    name: 'true',
                    label: '显示于快捷保存选项'
                }, {
                    name: 'false',
                    label: '不显示'
                }],
                isAdvanced: true
            }]}></Options>}
    </div>)
}

export default Library
