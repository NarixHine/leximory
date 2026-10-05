import Foundation
import CryptoKit

/// One backend/account partition. Closing a partition prevents late requests from recreating it.
public actor LocalReadingStore {
    public struct Status: Sendable {
        public let online: Bool
        public let bytes: Int
        public let savedBooks: Int
        public let lastSync: Date?
        public let storageFailure: Bool
        public let downloadedTextIDs: Set<String>
    }
    private struct Entry: Codable {
        let digest: String
        let bytes: Int
        var accessed: Date
        var readable: Bool?
    }
    private struct Manifest: Codable {
        var version = 1
        var entries: [String: Entry] = [:]
        var lastSync: Date?
    }
    private let directory: URL
    private let budget: Int
    private var manifest: Manifest
    private var closed = false
    private var online = true
    private var storageFailure = false
    private var versions: [String: Int] = [:]
    private var listeners: [UUID: AsyncStream<Status>.Continuation] = [:]
    public init(root: URL, origin: URL, accountID: String, budget: Int = 512 * 1024 * 1024) throws {
        self.budget = budget
        directory = root.appending(path: Self.digest(Data((origin.absoluteString + "\n" + accountID).utf8)), directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var excluded = directory
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try excluded.setResourceValues(values)
        #if os(iOS)
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: directory.path)
        #endif
        let loaded = (try? Data(contentsOf: directory.appending(path: "manifest.json"))).flatMap { try? JSONDecoder().decode(Manifest.self, from: $0) }
        manifest = loaded?.version == 1 ? loaded! : Manifest()
        // Unreferenced files can remain after an interrupted atomic manifest commit.
        let referenced = Set(manifest.entries.keys.map { Self.digest(Data($0.utf8)) }).union(["manifest.json"])
        for file in (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? [] where !referenced.contains(file.lastPathComponent) {
            try? FileManager.default.removeItem(at: file)
        }
    }
    public static func applicationRoot() throws -> URL {
        try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appending(path: "Leximory/Offline", directoryHint: .isDirectory)
    }
    private static func digest(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    private func file(_ key: String) -> URL { directory.appending(path: Self.digest(Data(key.utf8))) }
    private func persist() throws {
        try JSONEncoder().encode(manifest).write(to: directory.appending(path: "manifest.json"), options: .atomic)
    }
    public func status() -> Status {
        let books = manifest.entries.keys.filter {
                   guard $0.hasPrefix("book/") else { return false }
                   let id = String($0.dropFirst(5))
                   return manifest.entries["ebook/\(id)"] != nil && manifest.entries["book-source/\(id)"] != nil
               }
        let articles = manifest.entries.filter { $0.key.hasPrefix("document/") && $0.value.readable == true }.map { String($0.key.dropFirst(9)) }
        return Status(online: online && !closed, bytes: manifest.entries.values.reduce(0) { $0 + $1.bytes },
                      savedBooks: books.count, lastSync: manifest.lastSync, storageFailure: storageFailure,
                      downloadedTextIDs: Set(articles).union(books.map { String($0.dropFirst(5)) }))
    }
    public func updates() -> AsyncStream<Status> {
        let id = UUID()
        return AsyncStream { continuation in
            listeners[id] = continuation
            continuation.yield(status())
            continuation.onTermination = { [weak self] _ in Task { await self?.removeListener(id) } }
        }
    }
    private func removeListener(_ id: UUID) { listeners[id] = nil }
    private func notify() { for listener in listeners.values { listener.yield(status()) } }
    public func setOnline(_ value: Bool) { if !closed { online = value; notify() } }
    public func requireOnline() throws {
        guard !closed else { throw CancellationError() }
        guard online else { throw URLError(.notConnectedToInternet) }
    }
    public func data(for key: String) -> Data? {
        guard !closed, var entry = manifest.entries[key] else { return nil }
        guard let data = try? Data(contentsOf: file(key)), data.count == entry.bytes, Self.digest(data) == entry.digest else {
            remove(key); return nil
        }
        entry.accessed = Date(); manifest.entries[key] = entry
        return data
    }
    public func value<T: Decodable & Sendable>(_ type: T.Type, for key: String) -> T? {
        guard let data = data(for: key) else { return nil }
        let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .millisecondsSince1970
        guard let value = try? decoder.decode(type, from: data) else { remove(key); return nil }
        return value
    }
    public func save<T: Encodable & Sendable>(_ value: T, for key: String) {
        let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .millisecondsSince1970; encoder.outputFormatting = [.sortedKeys]
        let readable = (value as? RemoteDocument)?.document != nil
        do { try saveData(encoder.encode(value), for: key, readable: readable) } catch { storageFailure = true; notify() }
    }
    public func version(for key: String) -> Int { versions[key, default: 0] }
    public func save<T: Encodable & Sendable>(_ value: T, for key: String, ifUnchanged version: Int) {
        guard versions[key, default: 0] == version else { return }
        save(value, for: key)
    }
    public func saveData(_ data: Data, for key: String, readable: Bool = false) throws {
        guard !closed else { throw CancellationError() }
        guard data.count <= budget else { throw URLError(.dataLengthExceedsMaximum) }
        guard key == "account" || data.count + (manifest.entries["account"]?.bytes ?? 0) <= budget else {
            throw URLError(.dataLengthExceedsMaximum)
        }
        let digest = Self.digest(data)
        if manifest.entries[key]?.digest == digest, self.data(for: key) != nil {
            if manifest.entries[key]?.readable != readable { manifest.entries[key]?.readable = readable; try persist(); notify() }
            return
        }
        try data.write(to: file(key), options: .atomic)
        versions[key, default: 0] += 1
        manifest.entries[key] = Entry(digest: digest, bytes: data.count, accessed: Date(), readable: readable)
        while manifest.entries.values.reduce(0, { $0 + $1.bytes }) > budget,
              let oldest = manifest.entries.filter({ $0.key != key && $0.key != "account" }).min(by: {
                  let left = Self.isCatalog($0.key), right = Self.isCatalog($1.key)
                  return left == right ? $0.value.accessed < $1.value.accessed : !left
              })?.key {
            remove(oldest)
        }
        try persist(); storageFailure = false; notify()
    }
    private static func isCatalog(_ key: String) -> Bool {
        key == "libraries" || key.hasPrefix("texts/") || key.hasPrefix("words/")
    }
    public func remove(_ key: String) {
        guard !closed else { return }
        manifest.entries.removeValue(forKey: key)
        versions[key, default: 0] += 1
        try? FileManager.default.removeItem(at: file(key)); try? persist(); notify()
    }
    public func removeText(_ id: String) {
        for key in ["document/\(id)", "ebook/\(id)", "book/\(id)", "book-source/\(id)"] { remove(key) }
    }
    public func removeLibrary(_ id: String) {
        if let texts = value([CatalogText].self, for: "texts/\(id)") { for text in texts { removeText(text.id) } }
        remove("texts/\(id)"); remove("words/\(id)")
    }
    public func reconcileLibraries(_ libraries: [CatalogLibrary], ifUnchanged version: Int? = nil) {
        if let version, versions["libraries", default: 0] != version { return }
        let ids = Set(libraries.map(\.id))
        for key in Array(manifest.entries.keys) where key.hasPrefix("texts/") || key.hasPrefix("words/") {
            let id = String(key.split(separator: "/").last ?? "")
            if !ids.contains(id) { removeLibrary(id) }
        }
        // Include directly opened documents whose library was revoked.
        for key in Array(manifest.entries.keys) where key.hasPrefix("document/") {
            if let document = value(RemoteDocument.self, for: key), !ids.contains(document.library.id) { removeText(document.text.id) }
        }
        for key in Array(manifest.entries.keys) where key.hasPrefix("ebook/") {
            if let book = value(EbookDescriptor.self, for: key), !ids.contains(book.library.id) { removeText(book.text.id) }
        }
        save(libraries, for: "libraries")
    }
    public func reconcileTexts(_ texts: [CatalogText], libraryID: String, ifUnchanged version: Int? = nil) {
        if let version, versions["texts/\(libraryID)", default: 0] != version { return }
        let ids = Set(texts.map(\.id))
        if let previous = value([CatalogText].self, for: "texts/\(libraryID)") {
            for text in previous where !ids.contains(text.id) { removeText(text.id) }
        }
        save(texts, for: "texts/\(libraryID)")
    }
    public func setArchived(libraryID: String, archived: Bool) {
        guard var libraries = value([CatalogLibrary].self, for: "libraries"),
              let index = libraries.firstIndex(where: { $0.id == libraryID }) else { return }
        libraries[index].archived = archived
        save(libraries, for: "libraries")
    }
    public func upsertText(_ text: CatalogText) {
        var texts = value([CatalogText].self, for: "texts/\(text.libraryId)") ?? []
        texts.removeAll { $0.id == text.id }; texts.insert(text, at: 0)
        save(texts, for: "texts/\(text.libraryId)")
    }
    public func upsertWord(_ word: SavedWord) {
        var words = value([SavedWord].self, for: "words/\(word.libraryId)") ?? []
        if let index = words.firstIndex(where: { $0.id == word.id }) { words[index] = word }
        else { words.insert(word, at: 0) }
        save(words, for: "words/\(word.libraryId)")
    }
    public func completeSync() { guard !closed else { return }; manifest.lastSync = Date(); try? persist(); notify() }
    public func updateEbookLocation(textID: String, location: String) {
        guard let book = value(EbookDescriptor.self, for: "ebook/\(textID)") else { return }
        save(EbookDescriptor(text: book.text, library: book.library, url: book.url, format: book.format,
                             expiresAt: book.expiresAt, location: location, bookmarks: book.bookmarks), for: "ebook/\(textID)")
    }
    public func close() {
        closed = true; online = false; manifest = Manifest()
        try? FileManager.default.removeItem(at: directory)
        notify(); for listener in listeners.values { listener.finish() }; listeners.removeAll()
    }
}
