import { Inngest, eventType, staticSchema } from 'inngest'

type NotifyUser = {
    title: string
    body: string
    url: string
    subscription: string
    uid: string
} | {
    title: string
    body: string
    url: string
    subscription: null
    uid: string
}

type ArticleImported = {
    article: string
    textId: string
    onlyComments: boolean
    userId: string
    generateTitle?: boolean
}

type StoryRequestedWithTextId = {
    comments: string[]
    userId: string
    storyStyle?: string
    textId: string
}

type StoryRequestedWithLibId = {
    comments: string[]
    userId: string
    storyStyle?: string
    libId: string
}

export const notifyEvent = eventType('app/notify', {
    schema: staticSchema<NotifyUser>(),
})

export const articleImported = eventType('app/article.imported', {
    schema: staticSchema<ArticleImported>(),
})

export const storyRequested = eventType('app/story.requested', {
    schema: staticSchema<StoryRequestedWithTextId | StoryRequestedWithLibId>(),
})

export const inngest = new Inngest({
    id: 'leximory',
})
