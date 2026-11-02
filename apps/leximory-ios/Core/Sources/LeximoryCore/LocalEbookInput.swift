import Foundation
import CryptoKit

public struct LocalEbookInput: Sendable {
    public let book: LocalEbook
    public let document: RemoteDocument
    public var id: String { document.text.id }

    public init(data: Data, filename: String) throws {
        let format = (filename as NSString).pathExtension.lowercased()
        guard data.count <= 4_718_592,
              format == "pdf" && data.starts(with: Data("%PDF-".utf8))
                || format == "epub" && data.starts(with: [0x50, 0x4b, 0x03, 0x04]) else { throw URLError(.cannotDecodeContentData) }
        let id = "local-" + SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        let library = CatalogLibrary(id: "local", name: "电子书", language: "English", owned: false, archived: false, shadow: false)
        let text = CatalogText(id: id, libraryId: library.id, title: (filename as NSString).deletingPathExtension,
            topics: [], emoji: nil, createdAt: nil, format: "ebook")
        document = RemoteDocument(text: text, library: library, document: nil, annotationProgress: nil)
        let descriptor = EbookDescriptor(text: text, library: library, url: URL(filePath: filename), format: format,
            expiresAt: .distantFuture, location: nil, bookmarks: [])
        book = LocalEbook(descriptor: descriptor, data: data, location: nil)
    }
}
