import Center from '@/components/ui/center'
import { Spinner } from '@heroui/spinner'

export default function LoadingView() {
    return <Center>
        <Spinner
            variant='simple'
            color='primary'
            size='lg'
            label='加载文本中……'
        />
    </Center>
}
