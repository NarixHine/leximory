'use client'

import { useState, useTransition } from 'react'
import { Button } from '@heroui/button'
import { Input, Textarea } from '@heroui/input'
import { Card, CardBody, CardHeader } from '@heroui/card'
import { Tabs, Tab } from '@heroui/tabs'
import { Alert } from '@heroui/alert'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/modal'
import { useDisclosure } from '@heroui/react'
import { TimesData } from '@/components/times/types'
import { updateTimesIssue, deleteTimesIssue } from '../actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { PiTrashDuotone, PiFloppyDiskDuotone } from 'react-icons/pi'
import Image from 'next/image'
import Markdown from '@/components/markdown'

interface TimesEditorProps {
    initialData: TimesData
    date: string
}

export default function TimesEditor({ initialData, date }: TimesEditorProps) {
    const [formData, setFormData] = useState({
        cover: initialData.cover,
        news: initialData.news,
        novel: initialData.novel,
        audio: initialData.audio || '',
        quiz: initialData.quiz ? JSON.stringify(initialData.quiz, null, 2) : ''
    })
    
    const [isUpdating, startUpdating] = useTransition()
    const [isDeleting, startDeleting] = useTransition()
    const [activeTab, setActiveTab] = useState('editor')
    const { isOpen, onOpen, onClose } = useDisclosure()
    const router = useRouter()

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }))
    }

    const handleSave = () => {
        // Client-side validation
        if (!formData.cover.trim()) {
            toast.error('Cover image URL is required')
            return
        }
        
        if (!formData.novel.trim()) {
            toast.error('Novel content is required')
            return
        }
        
        if (!formData.news.trim()) {
            toast.error('News content is required')
            return
        }
        
        // Validate cover image URL format
        try {
            new URL(formData.cover)
        } catch {
            toast.error('Please enter a valid cover image URL')
            return
        }
        
        // Validate audio URL format if provided
        if (formData.audio.trim()) {
            try {
                new URL(formData.audio)
            } catch {
                toast.error('Please enter a valid audio URL')
                return
            }
        }
        
        // Validate quiz JSON format if provided
        if (formData.quiz.trim()) {
            try {
                JSON.parse(formData.quiz)
            } catch {
                toast.error('Quiz data must be valid JSON format')
                return
            }
        }
        
        startUpdating(async () => {
            const result = await updateTimesIssue(date, {
                ...formData,
            })
            
            if (result.success) {
                toast.success(result.message)
            } else {
                toast.error(result.error)
            }
        })
    }

    const handleDelete = () => {
        startDeleting(async () => {
            const result = await deleteTimesIssue(date)
            
            if (result.success) {
                toast.success(result.message)
                router.push('/admin')
            } else {
                toast.error(result.error)
            }
        })
        onClose()
    }

    return (
        <div className='space-y-6'>
            <div className='flex justify-between items-center'>
                <div className='flex gap-2'>
                    <Button
                        color='primary'
                        onPress={handleSave}
                        isLoading={isUpdating}
                        startContent={<PiFloppyDiskDuotone />}
                    >
                        Save Changes
                    </Button>
                    <Button
                        color='danger'
                        variant='light'
                        onPress={onOpen}
                        isLoading={isDeleting}
                        startContent={<PiTrashDuotone />}
                    >
                        Delete Issue
                    </Button>
                </div>
            </div>

            <Tabs 
                selectedKey={activeTab}
                onSelectionChange={(key) => setActiveTab(key as string)}
                className='w-full'
            >
                <Tab key='editor' title='Editor'>
                    <div className='space-y-6'>
                        <Card className='p-2'>
                            <CardHeader className='pb-4'>
                                <h3 className='text-lg font-semibold'>Cover Image</h3>
                            </CardHeader>
                            <CardBody className='space-y-4 pt-0'>
                                <Input
                                    label='Cover Image URL'
                                    value={formData.cover}
                                    onChange={(e) => handleInputChange('cover', e.target.value)}
                                    placeholder='https://example.com/image.jpg'
                                />
                                {formData.cover && (
                                    <div className='relative w-full aspect-video rounded-lg overflow-hidden'>
                                        <Image
                                            src={formData.cover}
                                            alt='Cover preview'
                                            fill
                                            className='object-cover'
                                        />
                                    </div>
                                )}
                            </CardBody>
                        </Card>

                        <Card className='p-2'>
                            <CardHeader className='pb-4'>
                                <h3 className='text-lg font-semibold'>Daily Novel</h3>
                            </CardHeader>
                            <CardBody className='pt-0'>
                                <Textarea
                                    label='Novel Content'
                                    value={formData.novel}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('novel', e.target.value)}
                                    placeholder='Write the daily novel content here...'
                                    minRows={8}
                                    maxRows={20}
                                />
                            </CardBody>
                        </Card>

                        <Card className='p-2'>
                            <CardHeader className='pb-4'>
                                <h3 className='text-lg font-semibold'>Daily News</h3>
                            </CardHeader>
                            <CardBody className='pt-0'>
                                <Textarea
                                    label='News Content'
                                    value={formData.news}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('news', e.target.value)}
                                    placeholder='Write the daily news content here...'
                                    minRows={8}
                                    maxRows={20}
                                />
                            </CardBody>
                        </Card>

                        <Card className='p-2'>
                            <CardHeader className='pb-4'>
                                <h3 className='text-lg font-semibold'>Audio</h3>
                            </CardHeader>
                            <CardBody className='pt-0'>
                                <Input
                                    label='Audio URL (optional)'
                                    value={formData.audio}
                                    onChange={(e) => handleInputChange('audio', e.target.value)}
                                    placeholder='https://example.com/audio.mp3'
                                />
                                {formData.audio && (
                                    <audio controls className='w-full mt-2'>
                                        <source src={formData.audio} type='audio/mpeg' />
                                        Your browser does not support the audio element.
                                    </audio>
                                )}
                            </CardBody>
                        </Card>

                        <Card className='p-2'>
                            <CardHeader className='pb-4'>
                                <h3 className='text-lg font-semibold'>Quiz Data</h3>
                            </CardHeader>
                            <CardBody className='pt-0'>
                                <Textarea
                                    label='Quiz JSON (optional)'
                                    value={formData.quiz}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('quiz', e.target.value)}
                                    placeholder='Enter quiz data in JSON format...'
                                    minRows={4}
                                    maxRows={10}
                                />
                                <p className='text-sm text-default-500 mt-2'>
                                    Enter quiz data in JSON format. Leave empty if no quiz.
                                </p>
                            </CardBody>
                        </Card>
                    </div>
                </Tab>

                <Tab key='preview' title='Preview'>
                    <div className='space-y-6'>
                        <Card className='p-2'>
                            <CardHeader className='pb-4'>
                                <h3 className='text-lg font-semibold'>Cover Preview</h3>
                            </CardHeader>
                            <CardBody className='pt-0'>
                                {formData.cover && (
                                    <div className='relative w-full aspect-video rounded-lg overflow-hidden'>
                                        <Image
                                            src={formData.cover}
                                            alt='Cover preview'
                                            fill
                                            className='object-cover'
                                        />
                                    </div>
                                )}
                            </CardBody>
                        </Card>

                        <Card className='p-2'>
                            <CardHeader className='pb-4'>
                                <h3 className='text-lg font-semibold'>Novel Preview</h3>
                            </CardHeader>
                            <CardBody className='pt-0'>
                                <div className='prose dark:prose-invert max-w-none'>
                                    <Markdown md={formData.novel} />
                                </div>
                            </CardBody>
                        </Card>

                        <Card className='p-2'>
                            <CardHeader className='pb-4'>
                                <h3 className='text-lg font-semibold'>News Preview</h3>
                            </CardHeader>
                            <CardBody className='pt-0'>
                                <div className='prose dark:prose-invert max-w-none'>
                                    <Markdown md={formData.news} />
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                </Tab>
            </Tabs>

            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalContent>
                    <ModalHeader>
                        <h3 className='text-lg font-semibold'>Delete Times Issue</h3>
                    </ModalHeader>
                    <ModalBody>
                        <Alert 
                            color='danger' 
                            title='Are you sure you want to delete this issue?'
                            description='This action cannot be undone. The Times issue will be permanently deleted.'
                        />
                    </ModalBody>
                    <ModalFooter>
                        <Button variant='light' onPress={onClose}>
                            Cancel
                        </Button>
                        <Button 
                            color='danger' 
                            onPress={handleDelete}
                            isLoading={isDeleting}
                        >
                            Delete
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    )
}
