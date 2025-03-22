import { CreemSDK } from "@/lib/creem-sdk"

export const creem = new CreemSDK({
    apiKey: process.env.CREEM_API_KEY as string,
}) 
