import { nanoid } from '@/lib/utils'
import { PiFileAudio } from 'react-icons/pi'
import { PluginProps } from 'react-markdown-editor-lite'

const Reader = (props: PluginProps) => {
    const handleClick = () => {
        const select = props.editor.getSelection().text
        props.editor.insertText(`:::${nanoid()}\n${select}\n:::`, true)
    }

    return (
        <span
            className='button flex justify-center items-center'
            title='Audio'
            onClick={handleClick}
        >
            <PiFileAudio />
        </span>
    )
}

Reader.defaultConfig = {}
Reader.align = 'left'
Reader.pluginName = 'audio'

export default Reader
