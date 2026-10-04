import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'
import { MobileError } from './errors'

function publicAddress(address: string): boolean {
    if (isIP(address) === 4) {
        const [a, b] = address.split('.').map(Number)
        return ![0, 10, 127].includes(a!) && !(a === 169 && b === 254) && !(a === 172 && b! >= 16 && b! <= 31)
            && !(a === 192 && b === 168) && !(a === 100 && b! >= 64 && b! <= 127) && a! < 224
    }
    return isIP(address) === 6 && !/^(::|f[cd]|fe[89ab])/i.test(address)
}
export async function assertPublicArticleURL(input: string, resolve = lookup) {
    const url = new URL(input)
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))
        || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) throw new MobileError('invalid_input')
    const addresses = isIP(host) ? [{ address: host }] : await resolve(host, { all: true })
    if (!addresses.length || addresses.some(value => !publicAddress(value.address))) throw new MobileError('invalid_input')
}
