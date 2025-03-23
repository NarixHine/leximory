import PreferenceToggle from './toggle'
import { getPreference } from '../../actions'

export default async function Preference() {
    const accent = await getPreference()
    return <PreferenceToggle accent={accent} />
}
