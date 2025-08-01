'use client'

import { cn } from '@/lib/utils'
import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { PiBoxArrowUp } from 'react-icons/pi'

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
        setFiles((prevFiles) => [...prevFiles, ...newFiles])
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

    return (
        <div className='w-full' {...getRootProps()}>
            <motion.div
                onClick={handleClick}
                whileHover='animate'
                className='px-10 pb-10 group/file block rounded-lg cursor-pointer w-full relative overflow-hidden'
            >
                <input
                    ref={fileInputRef}
                    id='file-upload-handle'
                    type='file'
                    accept={acceptableTypes?.join(',')}
                    onChange={(e) => handleFileChange(Array.from(e.target.files || []))}
                    className='hidden'
                />
                <div className='flex flex-col items-center justify-center'>
                    <div className='relative w-full mt-10 max-w-xl mx-auto'>
                        {files.length > 0 &&
                            [files[files.length - 1]].map((file, idx) => (
                                <motion.div
                                    key={file.name}
                                    layoutId={idx === 0 ? 'file-upload' : 'file-upload-' + idx}
                                    className={cn(
                                        'relative overflow-hidden z-40 flex flex-col items-start justify-start md:h-24 p-4 pb-2 mt-4 w-full mx-auto rounded-md',
                                        'shadow-sm bg-white dark:bg-default-100',
                                    )}
                                >
                                    <div className='flex justify-between w-full items-center gap-4'>
                                        <motion.p
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            layout
                                            className='text-base text-neutral-700 dark:text-neutral-300 truncate max-w-xs'
                                        >
                                            {file.name}
                                        </motion.p>
                                    </div>

                                    <div className='flex text-sm md:flex-row flex-col items-start md:items-center w-full mt-2 justify-between text-neutral-600 dark:text-neutral-400'>
                                        <motion.p
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            layout
                                            className='px-1 py-0.5 rounded-md bg-default-50 dark:bg-neutral-800 '
                                        >
                                            {file.type}
                                        </motion.p>
                                    </div>
                                </motion.div>
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
                                    'relative group-hover/file:shadow-2xl z-40 bg-white dark:bg-neutral-900 flex items-center justify-center h-32 mt-4 w-full max-w-32 mx-auto rounded-md',
                                    'shadow-[0px_10px_50px_rgba(0,0,0,0.1)]'
                                )}
                            >
                                {isDragActive ? (
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className='text-neutral-600 flex flex-col items-center'
                                    >
                                        Drop it
                                        <PiBoxArrowUp className='text-5xl text-neutral-600 dark:text-neutral-400' />
                                    </motion.p>
                                ) : (
                                    <PiBoxArrowUp className='text-5xl text-neutral-600 dark:text-neutral-300' />
                                )}
                            </motion.div>
                        )}

                        {!files.length && (
                            <motion.div
                                variants={secondaryVariant}
                                className='absolute opacity-0 border border-dashed border-sky-400 inset-0 z-30 bg-transparent flex items-center justify-center h-32 mt-4 w-full max-w-32 mx-auto rounded-md'
                            ></motion.div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
