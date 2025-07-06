import { requireAdmin } from '@/server/auth/role'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        await requireAdmin()
        return NextResponse.json({ authorized: true })
    } catch {
        return NextResponse.json({ authorized: false }, { status: 401 })
    }
}
