'use client'

import { cn } from '@/lib/utils'
import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { PiBoxArrowUp } from 'react-icons/pi'
import FlatCard from './flat-card'

const mainVariant = {
    initial: {
        x: 0,
        y: 0,
    },
    animate: {
        x: 20,
        y: -20,
        opacity: 0.9,
    },
}

const secondaryVariant = {
    initial: {
        opacity: 0,
    },
    animate: {
        opacity: 1,
    },
}

export const FileUpload = ({
    onChange,
    acceptableTypes,
}: {
    onChange?: (files: File[]) => void
    acceptableTypes?: string[]
}) => {
    const [files, setFiles] = useState<File[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (newFiles: File[]) => {
        setFiles(prevFiles => [...prevFiles, ...newFiles])
        if (onChange) onChange(newFiles)
    }

    const handleClick = () => {
        fileInputRef.current?.click()
    }

    const { getRootProps, isDragActive } = useDropzone({
        multiple: false,
        noClick: true,
        onDrop: handleFileChange,
        maxFiles: 1,
    })

    const MotionCard = motion.create(FlatCard)

    return (
        <div className='w-full' {...getRootProps()}>
            <motion.div
                onClick={handleClick}
                whileHover='animate'
                className='group/file relative block w-full cursor-pointer overflow-hidden rounded-4xl px-10 pb-10'
            >
                <input
                    ref={fileInputRef}
                    id='file-upload-handle'
                    type='file'
                    accept={acceptableTypes?.join(',')}
                    onChange={e => handleFileChange(Array.from(e.target.files || []))}
                    className='hidden'
                />
                <div className='flex flex-col items-center justify-center'>
                    <div className='relative w-full mt-10 max-w-xl mx-auto'>
                        {files.length > 0 &&
                            [files[files.length - 1]].map((file, idx) => (
                                <div
                                    key={file.name}
                                    className='mx-auto mt-4 overflow-hidden rounded-2xl border border-default-200'
                                >
                                    <MotionCard
                                        layoutId={idx === 0 ? 'file-upload' : 'file-upload-' + idx}
                                        className='relative z-40 flex flex-col items-start justify-start overflow-hidden rounded-2xl border-none p-4 shadow-none'
                                    >
                                        <div className='flex w-full items-center justify-between gap-4'>
                                            <motion.p
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                layout
                                                className='text-foreground text-base text-wrap'
                                            >
                                                {file.name}
                                            </motion.p>
                                        </div>

                                        <div className='mt-1 flex w-full flex-col items-start justify-between text-sm text-default-500 md:flex-row md:items-center'>
                                            <motion.p
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                layout
                                                className='rounded-md bg-default-100 px-1 font-mono'
                                            >
                                                {file.type}
                                            </motion.p>
                                        </div>
                                    </MotionCard>
                                </div>
                            ))}
                        {!files.length && (
                            <motion.div
                                layoutId='file-upload'
                                variants={mainVariant}
                                transition={{
                                    type: 'spring',
                                    stiffness: 300,
                                    damping: 20,
                                }}
                                className={cn(
                                    'relative z-40 mx-auto mt-4 flex h-32 w-full max-w-32 items-center justify-center rounded-2xl border border-default-200 bg-default-50',
                                )}
                            >
                                {isDragActive ? (
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className='flex flex-col items-center text-default-500'
                                    >
                                        Drop it
                                        <PiBoxArrowUp className='text-default-500 text-5xl' />
                                    </motion.p>
                                ) : (
                                    <PiBoxArrowUp className='text-default-500 text-5xl' />
                                )}
                            </motion.div>
                        )}

                        {!files.length && (
                            <motion.div
                                variants={secondaryVariant}
                                className='absolute inset-0 z-30 mx-auto mt-4 flex h-32 w-full max-w-32 items-center justify-center rounded-2xl border border-dashed border-default-300 bg-transparent opacity-0'
                            ></motion.div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
