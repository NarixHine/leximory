import { EventSchemas, Inngest } from 'inngest'
import { PushSubscription } from 'web-push'

type UserSignup = {
    data: {
        subscription: PushSubscription
    }
}
type Events = {
    'app/notify': UserSignup
}

export const inngest = new Inngest({
    id: 'leximory',
    schemas: new EventSchemas().fromRecord<Events>(),
},)
