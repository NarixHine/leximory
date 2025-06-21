import { redirect } from 'next/navigation'

export default async function redirectToLibrary() {
    redirect('/library')
}
