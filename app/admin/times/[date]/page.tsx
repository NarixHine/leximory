import { notFound } from 'next/navigation'
import { getTimesDataByDate } from '@/server/db/times'
import { requireAdmin } from '@/server/auth/role'
import { momentSH } from '@/lib/moment'
import TimesEditor from './components/times-editor'

interface PageProps {
    params: Promise<{ date: string }>
}

export default async function AdminTimesEditPage({ params }: PageProps) {
    await requireAdmin()
    
    const { date } = await params
    
    // Validate date format
    const dateMoment = momentSH(date)
    if (!dateMoment.isValid() || dateMoment.format('YYYY-MM-DD') !== date) {
        notFound()
    }
    
    let timesData
    
    try {
        timesData = await getTimesDataByDate(date)
    } catch {
        notFound()
    }
    
    return (
        <div className='container mx-auto p-6 max-w-4xl'>
            <div className='mb-6'>
                <h1 className='text-2xl font-bold mb-2'>Edit Times Issue</h1>
                <p className='text-default-600'>
                    Editing issue for {momentSH(date).format('LL')}
                </p>
            </div>
            
            <TimesEditor initialData={timesData} date={date} />
        </div>
    )
}
