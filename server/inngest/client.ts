import { Lang } from '@/lib/config'
import { EventSchemas, Inngest } from 'inngest'

type NotifyUser = {
    data: {
        title: string
        body: string
        url: string
        subscription: string
    }
}

type ArticleImported = {
    data: {
        article: string
        lang: Lang
        textId: string
        libId: string
        onlyComments: boolean
        userId: string
    }
}

type Events = {
    'app/notify': NotifyUser
    'app/article.imported': ArticleImported
}

export const inngest = new Inngest({
    id: 'leximory',
    schemas: new EventSchemas().fromRecord<Events>(),
})
