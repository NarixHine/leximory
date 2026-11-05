import 'server-only'

export const mobileNanoAI = {
    model: 'deepseek/deepseek-v4.1-flash-1017',
    reasoning: 'low',
    providerOptions: {},
} as const

export const mobileMiniAI = {
    ...mobileNanoAI,
    reasoning: 'medium',
} as const
