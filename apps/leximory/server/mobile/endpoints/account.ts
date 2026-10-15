import 'server-only'
import { mobileEndpoint } from '../http'
import { verify } from './verify'
import { createAccountOperations } from '../account'
import { accountStore } from '../account-store'

const operations = createAccountOperations(accountStore)

export const accountSettings = mobileEndpoint(verify, operations.accountSettings, 20000)
export const accountAccent = mobileEndpoint(verify, operations.accountAccent, 20000)
export const accountClaim = mobileEndpoint(verify, operations.accountClaim, 20000)
export const accountToken = mobileEndpoint(verify, operations.accountToken, 20000)
export const accountRevokeToken = mobileEndpoint(verify, operations.accountRevokeToken, 20000)
export const accountAvatar = mobileEndpoint(verify, operations.accountAvatar, 20000)
export const accountCheckout = mobileEndpoint(verify, operations.accountCheckout, 20000)
export const accountBilling = mobileEndpoint(verify, operations.accountBilling, 20000)
