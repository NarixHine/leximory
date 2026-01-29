import 'server-only'
import { createKilpi, Grant, Deny } from '@kilpi/core'
import { getUser } from '@repo/user'
import type { Tables } from '@repo/supabase/types'
import { ReactServerPlugin } from '@kilpi/react-server'
import incrCommentaryQuota from '@repo/user/quota'

type Paper = Tables<'papers'>

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
      read(subject, paper: Paper) {
        if (paper.public) return Grant(subject)

        if (!subject) return Deny({ message: 'Not authenticated' })
        if (subject.userId === paper.creator) return Grant(subject)

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

      async askAI(subject) {
        if (!subject)
          return Deny({ message: 'Not authenticated' })
        if (await incrCommentaryQuota(1, subject.userId)) {
          return Deny({ message: 'Quota exceeded' })
        } else {
          return Grant(subject)
        }
      }
    }
  },

  onUnauthorizedAssert(decision) {
    throw new Error(`Unauthorized: ${decision.message}`)
  }
})
