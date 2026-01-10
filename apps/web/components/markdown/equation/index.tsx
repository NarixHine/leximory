import TeX from '@matejmazur/react-katex'
import 'katex/dist/katex.min.css'

export default function Equation({
    text
}: {
    text: string
}) {
    return (
        <TeX as='div' className='mb-5 last:mb-0'>{String.raw`${text}`}</TeX>
    )
}
