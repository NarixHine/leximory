import 'server-only'
import { createKilpi, Grant, Deny } from '@kilpi/core'
import { getUser } from '@repo/user'
import type { Tables } from '@repo/supabase/types'
import { ReactServerPlugin } from '@kilpi/react-server'
import { unauthorized } from 'next/navigation'

type Paper = Tables<'papers'>
type PaperWithPasscode = Paper & { providedPasscode?: string }

type Library = Tables<'libraries'>

function hasValidPasscode(paper: PaperWithPasscode): boolean {
  return !!paper.passcode && paper.providedPasscode === paper.passcode
}

export const Kilpi = createKilpi({
  plugins: [ReactServerPlugin()],

  async getSubject() {
    const user = await getUser()
    return user
  },

  policies: {
    authed(subject) {
      if (!subject) return Deny({ message: 'Not authenticated' })
      return Grant(subject)
    },

    papers: {
      read(subject, paper: PaperWithPasscode) {
        if (paper.public) return Grant(subject)

        if (subject && subject.userId === paper.creator) return Grant(subject)

        if (hasValidPasscode(paper)) return Grant(subject)

        return Deny({ message: 'Not authorized to read this paper' })
      },

      create(subject) {
        if (!subject) return Deny({ message: 'Must be signed in' })
        return Grant(subject)
      },

      update(subject, paper: Paper) {
        if (!subject) return Deny({ message: 'Not authenticated' })
        if (subject.userId === paper.creator) return Grant(subject)
        return Deny({ message: 'Not the paper creator' })
      },

      delete(subject, paper: Paper) {
        if (!subject) return Deny({ message: 'Not authenticated' })
        if (subject.userId === paper.creator) return Grant(subject)
        return Deny({ message: 'Not the paper creator' })
      },

      toggleVisibility(subject, paper: Paper) {
        if (!subject) return Deny({ message: 'Not authenticated' })
        if (subject.userId === paper.creator) return Grant(subject)
        return Deny({ message: 'Not the paper creator' })
      },

      askAI(subject) {
        if (!subject)
          return Deny({ message: 'Not authenticated' })
        return Grant(subject)
      },

      submit(subject, paper: PaperWithPasscode) {
        if (!subject) return Deny({ message: 'Not authenticated' })
        if (paper.public) return Grant(subject)
        if (subject.userId === paper.creator) return Grant(subject)
        if (hasValidPasscode(paper)) return Grant(subject)
        return Deny({ message: 'Not authorized to submit this paper' })
      },

      readSubmissions(subject, paper: PaperWithPasscode) {
        if (!subject) return Deny({ message: 'Not authenticated' })
        if (paper.public) return Grant(subject)
        if (subject.userId === paper.creator) return Grant(subject)
        if (hasValidPasscode(paper)) return Grant(subject)
        return Deny({ message: 'Not authorized to read submissions of this paper' })
      },
    },

    libraries: {
      async write(subject, lib: Library) {
        if (!subject) return Deny({ message: 'Not authenticated' })
        const isOwner = lib.owner === subject.userId
        if (isOwner) {
          return Grant(subject)
        }
        return Deny({ message: 'Not authorized to write to this library' })
      },
    },
  },

  onUnauthorizedAssert() {
    unauthorized()
  }
})
