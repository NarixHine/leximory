export type EbookExtension = 'pdf' | 'epub'
export interface EbookFiles {
    read(extension: EbookExtension): Promise<Blob | null>
    write(extension: EbookExtension, file: Blob): Promise<void>
    remove(extension: EbookExtension): Promise<void>
}

// Storage and Postgres do not share a transaction. Retain the original bytes until
// publication finishes so an upload, cleanup or metadata failure can be rolled back.
export async function changeEbookFile(
    files: EbookFiles,
    replacement: { extension: EbookExtension; file: Blob } | null,
    commit: () => Promise<void>,
) {
    const previous = { pdf: await files.read('pdf'), epub: await files.read('epub') }
    try {
        if (replacement) {
            await files.write(replacement.extension, replacement.file)
            await files.remove(replacement.extension === 'pdf' ? 'epub' : 'pdf')
        } else {
            await files.remove('pdf')
            await files.remove('epub')
        }
        await commit()
    } catch (error) {
        // Attempt both restorations even if the storage provider is recovering.
        await Promise.allSettled(
            (['pdf', 'epub'] satisfies EbookExtension[]).map(async (extension) => {
                const original = previous[extension]
                if (original) await files.write(extension, original)
                else await files.remove(extension)
            }),
        )
        throw error
    }
}
