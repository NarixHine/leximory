import { NextResponse } from 'next/server'
import * as csv from 'fast-csv'
import { aggrWordHistogram } from '@/server/db/word'
import { listLibs } from '@/server/db/lib'
import { formatChartData } from '@/components/stats'
import moment from 'moment'

export async function GET(_: Request, { params }: { params: Promise<{ uid: string }> }) {
  const uid = (await params).uid
  const libs = await listLibs({ owner: uid })
  const buckets = await aggrWordHistogram({ libs, size: 7 })

  const csvData = formatChartData(new Map(buckets.map((bucket) => [moment(new Date(bucket.$key)).format('MMM Do'), bucket.$count])), 7)
  const csvStream = csv.format({ headers: ['date', 'count'] })
  csvData.forEach((row) => csvStream.write(row))
  csvStream.end()
  const csvString = await new Promise<string>((resolve) => {
    const chunks: string[] = []
    csvStream.on('data', (chunk) => chunks.push(chunk))
    csvStream.on('end', () => resolve(chunks.join('')))
  })

  return new NextResponse(csvString, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="stats.csv"'
    }
  })
}
