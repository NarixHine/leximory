'use client'

import { Button, Card, Slider } from '@heroui/react'
import { useEffect, useRef, useState } from 'react'
import { PiPause, PiPlay, PiSpeakerHigh, PiSpeakerSlash } from 'react-icons/pi'
import { cn } from '@/lib/utils'
import { Spinner } from '@heroui/spinner'

interface AudioPlayerProps {
    src?: string | null | undefined
}

function AudioPlayer({ src }: AudioPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(1)
    const audioRef = useRef<HTMLAudioElement>(null)
    const animationFrameRef = useRef<number | null>(null)

    const togglePlayPause = () => {
        if (!audioRef.current) return
        if (isPlaying) {
            audioRef.current.pause()
        } else {
            audioRef.current.play()
        }
        setIsPlaying(!isPlaying)
    }


    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration)
        }
    }

    const handleSliderChange = (value: number | number[]) => {
        const newTime = (Array.isArray(value) ? value[0] : value) / 100
        if (audioRef.current) {
            audioRef.current.currentTime = newTime
            setCurrentTime(newTime)
        }
    }

    const handleVolumeChange = () => {
        if (!audioRef.current) return
        const newVolume = volume > 0 ? 0 : 1
        audioRef.current.volume = newVolume
        setVolume(newVolume)
    }

    const handleAudioEnded = () => {
        setIsPlaying(false)
    }

    useEffect(() => {
        const animate = () => {
            if (audioRef.current) {
                setCurrentTime(audioRef.current.currentTime)
                animationFrameRef.current = requestAnimationFrame(animate)
            }
        }

        if (isPlaying) {
            animationFrameRef.current = requestAnimationFrame(animate)
        } else {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }
    }, [isPlaying])

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60)
        const seconds = Math.floor(time % 60)
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    return (
        <Card shadow='none' className={cn('w-full bg-transparent p-2 border border-foreground')}>
            {src && <audio
                ref={audioRef}
                src={src}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleAudioEnded}
            />}
            <div className={cn('flex items-center space-x-3')}>
                {src ? <Button
                    isIconOnly
                    aria-label='Play/Pause'
                    variant='light'
                    onPress={togglePlayPause}
                    className={cn('bg-transparent p-0')}
                    startContent={
                        isPlaying ? (
                            <PiPause className='text-lg text-primary-500' />
                        ) : (
                            <PiPlay className='text-lg text-primary-500' />
                        )
                    }
                /> : <Spinner className='ml-2 pb-1.5' variant='dots' color='default' />}
                <div className={cn('flex-grow')}>
                    <Slider
                        aria-label='Audio progress'
                        size='sm'
                        color='primary'
                        value={currentTime * 100}
                        maxValue={duration * 100}
                        onChange={handleSliderChange}
                        className={cn('w-full')}
                        endContent={
                            <span className='ml-2 text-tiny text-foreground-400 pb-0.5'>
                                {formatTime(duration)}
                            </span>
                        }
                    />
                </div>
                <Button
                    isIconOnly
                    aria-label='Volume'
                    variant='light'
                    onPress={handleVolumeChange}
                    className={cn('bg-transparent p-0')}
                    startContent={
                        volume > 0 ? (
                            <PiSpeakerHigh className='text-lg text-foreground-400' />
                        ) : (
                            <PiSpeakerSlash className='text-lg text-foreground-400' />
                        )
                    }
                />
            </div>
        </Card>
    )
}

export default AudioPlayer
