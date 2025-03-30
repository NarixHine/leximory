import EmptySelection from './components/empty-selection'

export default function TextLayout({ children }: { children: React.ReactNode }) {
    return <>
        <div className='fixed bottom-3 left-3 z-50'>
            <EmptySelection />
        </div>
        {children}
    </>
}
    