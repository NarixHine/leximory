import 'server-only'
import { r2 } from '../client/r2'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import env from '@/lib/env'
import { GeneratedFile } from 'ai'

export async function uploadTimesAudio(date: string, audio: Blob) {
    const key = `times/${date}.mp3`
    await r2.send(new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        Body: Buffer.from(await audio.arrayBuffer()),
        ContentType: audio.type,
    }))
    return `${env.R2_PUBLIC_URL}/${key}`
}

export async function uploadTimesImage(date: string, image: GeneratedFile) {
    const key = `times/${date}.png`
    await r2.send(new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        Body: image.uint8Array,
        ContentType: image.mimeType,
    }))
    return `${env.R2_PUBLIC_URL}/${key}`
}
