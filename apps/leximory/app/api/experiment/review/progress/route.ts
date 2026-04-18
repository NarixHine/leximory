import { NextRequest } from 'next/server'
import { getUserOrThrow } from '@repo/user'
import { redis } from '@repo/kv/redis'

export async function GET(req: NextRequest) {
    const { userId } = await getUserOrThrow()
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const lang = searchParams.get('lang')

    if (!date || !lang) {
        return new Response('Missing date or lang', { status: 400 })
    }

    const progressKey = `review:${userId}:${date}:${lang}`

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder()

            controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'))

            const interval = setInterval(async () => {
                try {
                    const data = await redis.get(progressKey)

                    if (data) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

                        if ((data as any).stage === 'complete') {
                            clearInterval(interval)
                            controller.close()
                        }
                    }
                } catch (error) {
                    console.error('Error fetching progress:', error)
                }
            }, 500)

            req.signal.addEventListener('abort', () => {
                clearInterval(interval)
                controller.close()
            })
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    })
}
