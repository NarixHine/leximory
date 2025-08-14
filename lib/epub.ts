import { NavItem, Book, EpubCFI, Location } from 'epubjs'

function flatten(chapters: any): NavItem[] {
    return chapters.flatMap((chapter: NavItem) => [
        chapter,
        ...(chapter.subitems ? flatten(chapter.subitems) : [])
    ])
}

export function getCfiFromHref(book: Book, href: string) {
    const [, id] = href.split('#')
    const section = book.spine.get(href)
    const el = (id ? section.document.getElementById(id) : section.document.body) as Element
    return section.cfiFromElement(el)
}

export function getChapter(book: Book, location: Location) {
    const locationHref = location.start.href
    const chapters = flatten(book.navigation.toc)

    const match = chapters
        .filter((chapter: NavItem) => {
            return book.canonical(chapter.href).includes(book.canonical(locationHref))
        }, null)
        .reduce((result: NavItem | null, chapter: NavItem) => {
            const locationAfterChapter = EpubCFI.prototype.compare(location.start.cfi, getCfiFromHref(book, chapter.href)) > 0
            return locationAfterChapter ? chapter : result
        }, null)

    const parent = match?.parent ? chapters.find(chapter => chapter.id === match.parent) : null

    return { match, parent }
}

export function getChapterName(book: Book, location: Location) {
    const { match, parent } = getChapter(book, location)
    
    if (parent && match) {
        return `${parent.label}, ${match.label}`
    } else if (match) {
        return match.label
    } else {
        return null
    }
}
