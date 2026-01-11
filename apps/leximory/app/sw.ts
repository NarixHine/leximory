import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist } from 'serwist'

declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
    }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: defaultCache,
})

self.addEventListener('push', async (event) => {
    const { data } = event
    if (data) {
        const json = await data.json()
        const { title, body, icon } = json
        const { url } = json.data

        const notificationOptions = {
            body,
            icon,
            data: {
                url,
            },
        }

        event.waitUntil(self.registration.showNotification(title, notificationOptions))
    }
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const { url } = event.notification.data

    event.waitUntil(
        self.clients.matchAll({ type: "window" }).then((clientsArr) => {
            // If a Window tab matching the targeted URL already exists, focus that;
            const hadWindowToFocus = clientsArr.some((windowClient) =>
                windowClient.url === url
                    ? (windowClient.focus(), true)
                    : false,
            )

            // Otherwise, open a new tab to the applicable URL and focus it.
            if (!hadWindowToFocus)
                self.clients
                    .openWindow(url)
        }),
    )
})

serwist.addEventListeners()
