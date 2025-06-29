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
        textId: string
        onlyComments: boolean
        userId: string
    }
}

interface StoryRequested {
    data: {
        comments: string[]
        userId: string
        storyStyle?: string
    } & ({
        textId: string
    } | {
        libId: string
    })
}

type Events = {
    'app/notify': NotifyUser
    'app/article.imported': ArticleImported
    'app/story.requested': StoryRequested
    'times/regeneration.requested': {}
}

export const inngest = new Inngest({
    id: 'leximory',
    schemas: new EventSchemas().fromRecord<Events>(),
})
