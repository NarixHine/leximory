import { SectionAnswers, QuizItems } from '@repo/schema/paper'
import { atom } from 'jotai'
import { atomFamily } from 'jotai-family'
import { atomWithStorage, createJSONStorage } from 'jotai/utils'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { nanoid } from 'nanoid'

export const paperIdAtom = atom<string | null>(null)

export const viewModeAtom = atom<'normal' | 'revise'>('normal')

export const DEFAULT_PAPER_ID = 'DEFAULT-PAPER' as const

// Create AsyncStorage adapter for Jotai
const asyncStorage = createJSONStorage<any>(() => AsyncStorage)

/**
 * Family of atoms that store section-based answers for each paper.
 * Structure: { sectionId: { localQuestionNo: optionText } }
 * Uses AsyncStorage for React Native persistence.
 */
export const answersAtomFamily = atomFamily((paperId: string) =>
  atomWithStorage<SectionAnswers>(`answers-v2-${paperId}`, {}, asyncStorage)
)

/**
 * Atom for storing submitted answers in revise mode.
 * Uses the new section-based structure.
 */
export const submittedAnswersAtom = atom<SectionAnswers>({})

/**
 * Derived atom that returns the answers for the current paper.
 */
export const answersAtom = atom((get) => {
  const paperId = get(paperIdAtom) || DEFAULT_PAPER_ID
  return get(answersAtomFamily(paperId))
})

/**
 * Atom for setting an answer in the current paper.
 * @param sectionId - The section ID
 * @param localQuestionNo - The 1-based question number within the section
 * @param option - The actual answer text (not the marker)
 */
export const setAnswerAtom = atom(
  null,
  (get, set, { sectionId, localQuestionNo, option }: { sectionId: string, localQuestionNo: number, option: string | null }) => {
    const paperId = get(paperIdAtom) || DEFAULT_PAPER_ID
    const current = get(answersAtomFamily(paperId))
    set(answersAtomFamily(paperId), {
      ...current,
      [sectionId]: {
        ...(current[sectionId] || {}),
        [localQuestionNo]: option
      }
    })
  }
)

export interface MarkedItem {
  id: string
  text: string
  timestamp: number
}

export const markedItemsAtomFamily = atomFamily((paperId: string) =>
  atomWithStorage<MarkedItem[]>(`marked-items-${paperId}`, [], asyncStorage)
)

export const markedItemsAtom = atom((get) => {
  const paperId = get(paperIdAtom) || DEFAULT_PAPER_ID
  return get(markedItemsAtomFamily(paperId))
})

export const addMarkedItemAtom = atom(
  null,
  (get, set, { text }: { text: string }) => {
    const paperId = get(paperIdAtom) || DEFAULT_PAPER_ID
    const current = get(markedItemsAtomFamily(paperId))
    const newItem: MarkedItem = {
      id: nanoid(),
      text,
      timestamp: Date.now()
    }
    set(markedItemsAtomFamily(paperId), [...current, newItem])
  }
)

export const removeMarkedItemAtom = atom(
  null,
  (get, set, { id }: { id: string }) => {
    const paperId = get(paperIdAtom) || DEFAULT_PAPER_ID
    const current = get(markedItemsAtomFamily(paperId))
    set(markedItemsAtomFamily(paperId), current.filter(item => item.id !== id))
  }
)

export const clearMarkedItemsAtom = atom(
  null,
  (get, set) => {
    const paperId = get(paperIdAtom) || DEFAULT_PAPER_ID
    set(markedItemsAtomFamily(paperId), [])
  }
)
