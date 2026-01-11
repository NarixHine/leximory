import { atom, useSetAtom } from 'jotai'
import { useId, useEffect } from 'react'

const reviseRegistryAtom = atom<Map<string, () => void>>(new Map())

export const reviseAllAtom = atom(
    null,
    (get) => {
        const registry = get(reviseRegistryAtom)
        registry.forEach((fn) => fn())
    }
)

export const registerReviseAtom = atom(
    null,
    (get, set, { id, fn, type }: { id: string; fn?: () => void; type: 'register' | 'unregister' }) => {
        const current = new Map(get(reviseRegistryAtom))
        if (type === 'register' && fn) {
            current.set(id, fn)
        } else {
            current.delete(id)
        }
        set(reviseRegistryAtom, current)
    }
)

export const useRegisterRevise = (fn: () => void) => {
    const id = useId()
    const dispatch = useSetAtom(registerReviseAtom)

    useEffect(() => {
        dispatch({ id, fn, type: 'register' })
        return () => dispatch({ id, type: 'unregister' })
    }, [id, fn, dispatch])
}
