import { aggrWordHistogram } from '@/server/db/word'
import { listLibs } from '@/server/db/lib'
import { formatChartData } from '@/components/stats'

export async function GET(_: Request, { params }: { params: Promise<{ uid: string }> }) {
  const uid = (await params).uid
  const libs = await listLibs({ owner: uid })
  const buckets = await aggrWordHistogram({ libs, size: 7 })
  const data = formatChartData(new Map(buckets.map((bucket) => [bucket.date, bucket.count])), 7)

  const csvRows = ['date,count']
  data.forEach(({ '记忆单词数': count, date }) => {
    csvRows.push(`${date},${count}`)
  })
  const csvContent = csvRows.join('\n')
  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="graph-data.csv"'
    }
  })
}
