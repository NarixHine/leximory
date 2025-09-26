import 'server-only'
import { r2 } from '../client/r2'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import env from '@/lib/env'
import { GeneratedAudioFile, GeneratedFile } from 'ai'

export async function uploadTimesAudio(date: string, audio: GeneratedAudioFile) {
    const key = `times/${date}.mp3`
    await r2.send(new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        Body: audio.uint8Array,
        ContentType: audio.mediaType,
    }))
    return `${env.R2_PUBLIC_URL}/${key}`
}

export async function uploadTimesImage(date: string, image: GeneratedFile) {
    const key = `times/${date}.png`
    await r2.send(new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        Body: image.uint8Array,
        ContentType: image.mediaType,
    }))
    return `${env.R2_PUBLIC_URL}/${key}`
}
