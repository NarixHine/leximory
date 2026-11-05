import 'server-only'
import { mobileEndpoint } from '../http'
import { verify } from './verify'
import { catalogStore } from '../store'
import { articleAudioStore } from '../article-audio-store'
import { createArticleAudioOperations } from '../article-audio'

const operations = createArticleAudioOperations({ catalog: catalogStore, audio: articleAudioStore })
export const generateArticleAudio = mobileEndpoint(verify, operations.generateArticleAudio, 540000)
