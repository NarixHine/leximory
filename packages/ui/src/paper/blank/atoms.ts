import { atom } from 'jotai'
import { StreamExplanationParams } from '@repo/service/paper'

export const highlightsAtom = atom<Record<string, string[]>>({})
export const openAskAtom = atom<boolean>(false)
export const askParamsAtom = atom<StreamExplanationParams | null>(null)
