import Foundation
import OpenAPIRuntime
import OpenAPIURLSession
import HTTPTypes
import os

public struct CatalogLibrary: Codable, Hashable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let language: String
    public let owned: Bool
    public var archived: Bool
    public let shadow: Bool
}
public struct CatalogText: Codable, Hashable, Identifiable, Sendable {
    public let id: String
    public let libraryId: String
    public let title: String
    public let topics: [String]
    public let emoji: String?
    public let createdAt: String?
    public let format: String
    public var bookmarkURL: String? = nil
}
public struct CatalogPage<Item: Codable & Sendable>: Codable, Sendable {
    public let items: [Item]
    public let nextCursor: String?
}
public struct Account: Codable, Sendable {
    public struct Allowance: Codable, Sendable {
        public let used: Double
        public let limit: Double
        public let resetsIn: Int
    }
    public let userId: String
    public let plan: String
    public let definitions: Allowance
}
public struct SavedVocabulary: Decodable, Sendable {
    public let id: String
    public let libraryId: String
}
public struct ShortcutWordResult: Decodable, Sendable {
    public let id: String
    public let libraryId: String
    public let language: String
    public let libraryName: String
}
public struct BrowserTarget: Codable, Sendable {
    public let selectionId: String
    public let language: String
    public let libraryId: String?
    public let libraryName: String
    public let shadow: Bool
    public var displayLanguage: String {
        learningLanguageName(language)
    }
}
public struct BrowserRule: Codable, Identifiable, Sendable {
    public let domain: String
    public let libraryId: String
    public var id: String { domain }
}
public struct VocabularyFields: Codable, Hashable, Sendable {
    public var original: String
    public var lemma: String
    public var definition: String
    public var etymology: String?
    public var cognates: String?
    public init(original: String, definition: Definition) {
        self.original = original; lemma = definition.lemma; self.definition = definition.definition
        etymology = definition.etymology; cognates = definition.cognates
    }
    public var note: Definition { Definition(lemma: lemma, definition: definition, etymology: etymology, cognates: cognates) }
    public var isValid: Bool {
        !original.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !lemma.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !definition.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        && [original, lemma, definition, etymology ?? "", cognates ?? ""].allSatisfy { !$0.contains("||") && !$0.contains("{") && !$0.contains("}") }
        && original.count <= 1024 && lemma.count <= 1024 && [definition, etymology ?? "", cognates ?? ""].allSatisfy { $0.count <= 16000 }
    }
}
public struct SavedWord: Codable, Identifiable, Sendable {
    public let id: String
    public let libraryId: String
    public let fields: VocabularyFields
    public let createdAt: String?
    public let protected: Bool?
    public init(id: String, libraryId: String, fields: VocabularyFields, createdAt: String? = nil, protected: Bool? = nil) {
        self.id = id; self.libraryId = libraryId; self.fields = fields
        self.createdAt = createdAt; self.protected = protected
    }
    public func replacingFields(_ fields: VocabularyFields) -> SavedWord {
        SavedWord(id: id, libraryId: libraryId, fields: fields, createdAt: createdAt, protected: protected)
    }

}
public struct RemoteDocument: Codable, Sendable {
    public let text: CatalogText
    public let library: CatalogLibrary
    public let document: ReadingDocument?
    public let annotationProgress: String?
}
public struct EbookBookmark: Codable, Identifiable, Sendable {
    public let id: Int
    public let quote: String
    public let chapter: String?
    public let location: String?
    public let createdAt: String?
    public init(id: Int, quote: String, chapter: String?, location: String?, createdAt: String? = nil) {
        self.id = id; self.quote = quote; self.chapter = chapter; self.location = location; self.createdAt = createdAt
    }
}
public struct EbookDescriptor: Codable, Sendable {
    public let text: CatalogText
    public let library: CatalogLibrary
    public let url: URL
    public let format: String
    public let expiresAt: Date
    public let location: String?
    public let bookmarks: [EbookBookmark]
}
public struct AudioDescriptor: Codable, Sendable {
    public let url: URL
    public let expiresAt: Date
}
public struct MobileFailure: Error, Codable, Sendable {
    public struct Detail: Codable, Sendable {
        public let code: String
        public let message: String
        public let retryable: Bool
    }
    public let error: Detail
}
private struct APIExpiryDates: DateTranscoder {
    func encode(_ date: Date) throws -> String { Date.ISO8601FormatStyle(includingFractionalSeconds: true).format(date) }
    func decode(_ value: String) throws -> Date {
        if let date = try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(value) { return date }
        return try Date.ISO8601FormatStyle().parse(value)
    }
}
private struct BearerMiddleware: ClientMiddleware {
    let token: @Sendable (String?) async throws -> String
    let unauthorized: @Sendable (String) async -> Void
    var store: LocalReadingStore? = nil
    func intercept(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String,
                   next: @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)) async throws -> (HTTPResponse, HTTPBody?) {
        try await store?.requireOnline()
        // These operations recover transient failures themselves; keep their next attempt available.
        let recoversFailures = ["saveShortcutWord", "vocabulary", "ebookVocabulary", "browserSelection", "browserVocabulary", "createBookmark", "createFolder", "browserRule", "editWord", "savedWord", "definitions", "ebookDefinitions", "browserDefinitions"].contains(operationID)
        var request = request
        let diagnosticID = UUID().uuidString
        request.headerFields[HTTPField.Name("X-Leximory-Request-ID")!] = diagnosticID
        let started = ContinuousClock.now
        let logger = Logger(subsystem: "com.leximory.reader", category: "api")
        let original = try await token(nil)
        request.headerFields[.authorization] = "Bearer \(original)"
        var result: (HTTPResponse, HTTPBody?)
        do {
            result = try await next(request, body, baseURL)
        } catch {
            logger.error("Request failed: operation=\(operationID, privacy: .public) id=\(diagnosticID, privacy: .public) code=\((error as NSError).code)")
            if !recoversFailures && MobileClient.isConnectionFailure(error) { await store?.setOnline(false) }
            throw error
        }
        if result.0.status.code == 401 && request.method == .get {
            request.headerFields[.authorization] = "Bearer \(try await token(original))"
            try Task.checkCancellation()
            result = try await next(request, body, baseURL)
        }
        if result.0.status.code == 401 {
            await unauthorized(request.headerFields[.authorization]?.replacingOccurrences(of: "Bearer ", with: "") ?? original)
        }
        if [403, 404].contains(result.0.status.code), let path = request.path {
            let parts = path.split(separator: "?")[0].split(separator: "/")
            if parts.first == "texts", parts.count > 1 { await store?.removeText(String(parts[1])) }
            if parts.first == "libraries", parts.count > 1 { await store?.removeLibrary(String(parts[1])) }
        }
        logger.info("Response: operation=\(operationID, privacy: .public) id=\(diagnosticID, privacy: .public) status=\(result.0.status.code) duration=\(String(describing: started.duration(to: .now)), privacy: .public)")
        if result.0.status.code >= 400, let responseBody = result.1 {
            let bytes = try await Data(collecting: responseBody, upTo: 65536)
            if let failure = try? JSONDecoder().decode(MobileFailure.self, from: bytes) { throw failure }
            throw URLError(.badServerResponse)
        }
        return result
    }
}
public struct MobileClient: Sendable {
    private let client: Client
    private let transport: any ClientTransport
    private let bearerMiddleware: BearerMiddleware
    public let webURL: URL
    public let localStore: LocalReadingStore?
    public static func cause(of error: any Error) -> any Error {
        if let clientError = error as? ClientError { return cause(of: clientError.underlyingError) }
        return error
    }
    public init(baseURL: URL, token: @escaping @Sendable (String?) async throws -> String, unauthorized: @escaping @Sendable (String) async -> Void = { _ in }, localStore: LocalReadingStore? = nil) {
        self.init(baseURL: baseURL, transport: URLSessionTransport(), token: token, unauthorized: unauthorized, localStore: localStore)
    }
    public init(baseURL: URL, transport: any ClientTransport, token: @escaping @Sendable (String?) async throws -> String, unauthorized: @escaping @Sendable (String) async -> Void = { _ in }, localStore: LocalReadingStore? = nil) {
        webURL = baseURL
        let middleware = BearerMiddleware(token: token, unauthorized: unauthorized, store: localStore)
        let sharedTransport = ReadCoalescingTransport(transport)
        bearerMiddleware = middleware
        self.transport = sharedTransport
        self.localStore = localStore
        client = Client(serverURL: baseURL.appending(path: "api/mobile/v1"), configuration: .init(dateTranscoder: APIExpiryDates()), transport: sharedTransport, middlewares: [middleware])
    }
    private func reviewRequest<Result: Decodable & Sendable>(_ path: String, body: Data? = nil) async throws -> Result {
        let base = webURL.appending(path: "api/mobile/v1")
        var request = HTTPRequest(method: body == nil ? .get : .post, scheme: base.scheme, authority: base.host, path: "/review" + path)
        request.headerFields[.contentType] = "application/json"
        let (response, responseBody) = try await bearerMiddleware.intercept(request, body: body.map { HTTPBody($0) }, baseURL: base, operationID: "review") { request, body, base in
            try await transport.send(request, body: body, baseURL: base, operationID: "review")
        }
        guard let responseBody else { throw URLError(.badServerResponse) }
        let data = try await Data(collecting: responseBody, upTo: 4 * 1024 * 1024)
        guard (200..<300).contains(response.status.code) else {
            if let failure = try? JSONDecoder().decode(MobileFailure.self, from: data) { throw failure }
            throw ReviewHTTPError(status: response.status.code)
        }
        return try JSONDecoder().decode(Result.self, from: data)
    }
    public func reviewTimeline(cursor: String? = nil) async throws -> ReviewTimeline {
        var query = URLComponents()
        if let cursor { query.queryItems = [.init(name: "cursor", value: cursor)] }
        return try await reviewRequest(query.percentEncodedQuery.map { "?" + $0 } ?? "")
    }
    public func reviewSnapshot(_ selection: ReviewSelection) async throws -> ReviewSnapshot {
        var query = URLComponents()
        query.queryItems = [.init(name: "date", value: selection.date), .init(name: "lang", value: selection.language)]
        return try await reviewRequest("/check?" + (query.percentEncodedQuery ?? ""))
    }
    public func startReview(_ selection: ReviewSelection) async throws {
        struct Result: Decodable, Sendable { let success: Bool }
        let _: Result = try await reviewRequest("/start", body: JSONEncoder().encode(ReviewSubmission(date: selection.date, lang: selection.language)))
    }
    public func submitReview(_ selection: ReviewSelection, index: Int?, submission: String) async throws {
        struct Result: Decodable, Sendable { let success: Bool }
        let _: Result = try await reviewRequest(index == nil ? "/conversation" : "/translation", body: JSONEncoder().encode(ReviewSubmission(date: selection.date, lang: selection.language, index: index, submission: submission)))
    }
    private func mapped<Value: Encodable, Result: Decodable>(_ value: Value, to: Result.Type) throws -> Result {
        let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let value = try decoder.singleValueContainer().decode(String.self)
            return try APIExpiryDates().decode(value)
        }
        return try decoder.decode(Result.self, from: encoder.encode(value))
    }
    public func accountSettings() async throws -> AccountSettings {
        let settings = try mapped(try await client.accountSettings().ok.body.json, to: AccountSettings.self)
        await localStore?.save(settings, for: "account-settings")
        return settings
    }
    public func setAccountAccent(_ accent: String) async throws {
        guard let value = Operations.accountAccent.Input.Body.jsonPayload.accentPayload(rawValue: accent) else { throw URLError(.badURL) }
        _ = try await client.accountAccent(body: .json(.init(accent: value))).ok.body.json
    }
    public func claimDailyLexicoin() async throws -> String {
        try await client.accountClaim().ok.body.json.message
    }
    public func accountToken() async throws -> String { try await client.accountToken().ok.body.json.token }
    public func revokeAccountToken() async throws { _ = try await client.accountRevokeToken().ok.body.json }
    public func uploadAccountAvatar(_ data: Data) async throws -> URL {
        let result = try await client.accountAvatar(body: .json(.init(data: data.base64EncodedString(), contentType: .image_sol_jpeg))).ok.body.json
        guard let url = URL(string: result.url) else { throw URLError(.badURL) }; return url
    }
    public func accountCheckout(plan: String) async throws -> URL {
        guard let selected = Operations.accountCheckout.Input.Body.jsonPayload.planPayload(rawValue: plan) else { throw URLError(.badURL) }
        let result = try await client.accountCheckout(body: .json(.init(plan: selected))).ok.body.json
        guard let url = URL(string: result.url), url.scheme == "https" else { throw URLError(.badURL) }; return url
    }
    public func accountBilling() async throws -> URL {
        let result = try await client.accountBilling().ok.body.json
        guard let url = URL(string: result.url), url.scheme == "https" else { throw URLError(.badURL) }; return url
    }
    public func account() async throws -> Account {
        let account = try mapped(try await client.me().ok.body.json, to: Account.self)
        await localStore?.save(account, for: "account")
        return account
    }
    public func libraries(cursor: String? = nil) async throws -> CatalogPage<CatalogLibrary> {
        try mapped(try await client.libraries(query: .init(cursor: cursor)).ok.body.json, to: CatalogPage<CatalogLibrary>.self)
    }
    public func setLibraryArchived(libraryID: String, archived: Bool) async throws {
        _ = try await client.libraryArchive(path: .init(libraryId: libraryID), body: .json(.init(archived: archived))).ok.body.json
        await localStore?.setArchived(libraryID: libraryID, archived: archived)
    }
    public func texts(libraryID: String, cursor: String? = nil) async throws -> CatalogPage<CatalogText> {
        try mapped(try await client.texts(path: .init(libraryId: libraryID), query: .init(cursor: cursor)).ok.body.json, to: CatalogPage<CatalogText>.self)
    }
    public struct ArticlePreview: Codable, Sendable { public let title: String; public let content: String }
    public func extractArticle(libraryID: String, url: String) async throws -> ArticlePreview {
        try mapped(try await client.extractArticle(path: .init(libraryId: libraryID), body: .json(.init(url: url))).ok.body.json, to: ArticlePreview.self)
    }
    public func createBookmark(libraryID: String, url: String, requestID: String = UUID().uuidString, title: String? = nil) async throws -> CatalogText {
        let text = try await MutationRetry.run {
            try mapped(try await client.createBookmark(path: .init(libraryId: libraryID),
                body: .json(.init(url: url, requestId: requestID, title: title))).ok.body.json, to: CatalogText.self)
        }
        await localStore?.upsertText(text)
        return text
    }
    public func browserRules() async throws -> [BrowserRule] {
        struct Rules: Decodable { let items: [BrowserRule] }
        return try mapped(try await client.browserRules().ok.body.json, to: Rules.self).items
    }
    public func setBrowserRule(domain: String, libraryID: String?) async throws {
        _ = try await client.browserRule(body: .json(.init(domain: domain, libraryId: libraryID))).ok.body.json
    }
    public func createFolder(name: String, language: String, requestID: String) async throws -> CatalogLibrary {
        guard let language = Operations.createFolder.Input.Body.jsonPayload.languagePayload(rawValue: language) else { throw URLError(.cannotParseResponse) }
        let library = try await MutationRetry.run {
            try mapped(try await client.createFolder(body: .json(.init(name: name, language: language, requestId: requestID))).ok.body.json, to: CatalogLibrary.self)
        }
        await cacheFolder(library)
        return library
    }
    public func renameFolder(libraryID: String, name: String) async throws -> CatalogLibrary {
        let library = try mapped(try await client.renameFolder(path: .init(libraryId: libraryID), body: .json(.init(name: name))).ok.body.json, to: CatalogLibrary.self)
        await cacheFolder(library)
        return library
    }
    private func cacheFolder(_ library: CatalogLibrary) async {
        var libraries = await localStore?.value([CatalogLibrary].self, for: "libraries") ?? []
        if let index = libraries.firstIndex(where: { $0.id == library.id }) { libraries[index] = library }
        else { libraries.append(library) }
        await localStore?.save(libraries, for: "libraries")
    }
    public func browserSelection(url: String, quote: String, context: String, offset: Int, bookmarkID: String?, libraryID: String?) async throws -> BrowserTarget {
        return try await MutationRetry.run {
            try mapped(try await client.browserSelection(body: .json(.init(quote: quote, context: context, offset: offset,
                url: url, bookmarkId: bookmarkID, libraryId: libraryID))).ok.body.json, to: BrowserTarget.self)
        }
    }
    public func browserDefinitions(selectionID: String) -> AsyncThrowingStream<DefinitionEvent, Error> {
        definitionStream {
            try await client.browserDefinitions(body: .json(.init(selectionId: selectionID))).ok.body.application_x_hyphen_ndjson
        }
    }
    public func saveShortcutWord(_ word: String) async throws -> ShortcutWordResult {
        let requestID = UUID().uuidString
        return try await MutationRetry.run {
            try mapped(try await client.saveShortcutWord(body: .json(.init(word: word, requestId: requestID))).ok.body.json, to: ShortcutWordResult.self)
        }
    }
    public func saveBrowserVocabulary(completionID: String) async throws -> SavedVocabulary {
        let requestID = UUID().uuidString
        return try await MutationRetry.run {
            try mapped(try await client.browserVocabulary(body: .json(.init(completionId: completionID, requestId: requestID))).ok.body.json, to: SavedVocabulary.self)
        }
    }
    public func vocabulary(libraryID: String, cursor: String? = nil) async throws -> CatalogPage<SavedWord> {
        try mapped(try await client.vocabularyList(path: .init(libraryId: libraryID), query: .init(cursor: cursor)).ok.body.json, to: CatalogPage<SavedWord>.self)
    }
    public func savedWord(id: String) async throws -> SavedWord {
        let word = try mapped(try await client.savedWord(path: .init(wordId: id)).ok.body.json, to: SavedWord.self)
        await localStore?.upsertWord(word)
        return word
    }
    public func editWord(id: String, fields: VocabularyFields) async throws -> SavedWord {
        guard fields.isValid else { throw URLError(.cannotParseResponse) }
        let word = try mapped(try await client.editWord(path: .init(wordId: id), body: .json(.init(
            lemma: fields.lemma, definition: fields.definition, etymology: fields.etymology,
            cognates: fields.cognates, original: fields.original))).ok.body.json, to: SavedWord.self)
        await localStore?.upsertWord(word)
        return word
    }
    public func importArticle(libraryID: String, title: String, content: String, annotate: Bool, onlyComments: Bool, generateTitle: Bool) async throws -> CatalogText {
        let text = try mapped(try await client.importArticle(path: .init(libraryId: libraryID), body: .json(.init(
            title: title, content: content, annotate: annotate, onlyComments: onlyComments, generateTitle: generateTitle))).ok.body.json, to: CatalogText.self)
        await localStore?.upsertText(text)
        return text
    }
    public func uploadEbook(libraryID: String, title: String, filename: String, data: Data) async throws -> CatalogText {
        guard !data.isEmpty, data.count <= 4_718_592 else { throw URLError(.dataLengthExceedsMaximum) }
        let text = try mapped(try await client.uploadEbook(path: .init(libraryId: libraryID), query: .init(title: title, filename: filename), body: .binary(HTTPBody(data))).ok.body.json, to: CatalogText.self)
        await localStore?.upsertText(text)
        return text
    }
    public func documentDetails(textID: String) async throws -> RemoteDocument {
        let version = await localStore?.version(for: "document/\(textID)") ?? 0
        let payload = try await client.document(path: .init(textId: textID)).ok.body.json
        let result = try mapped(payload, to: RemoteDocument.self)
        try result.document?.validate()
        await localStore?.save(result, for: "document/\(textID)", ifUnchanged: version)
        return result
    }
    public func document(textID: String) async throws -> ReadingDocument {
        guard let document = try await documentDetails(textID: textID).document else { throw URLError(.unsupportedURL) }
        return document
    }
    public func audio(textID: String, audioID: String) async throws -> AudioDescriptor {
        try mapped(try await client.audio(path: .init(textId: textID, audioId: audioID)).ok.body.json, to: AudioDescriptor.self)
    }
    public func ebook(textID: String) async throws -> EbookDescriptor {
        let version = await localStore?.version(for: "ebook/\(textID)") ?? 0
        let descriptor = try mapped(try await client.ebook(path: .init(textId: textID)).ok.body.json, to: EbookDescriptor.self)
        await localStore?.save(descriptor, for: "ebook/\(textID)", ifUnchanged: version)
        return descriptor
    }
    public func saveEbookPosition(textID: String, location: String) async throws {
        _ = try await client.ebookPosition(path: .init(textId: textID), body: .json(.init(location: location))).ok
        await localStore?.updateEbookLocation(textID: textID, location: location)
    }
    public func saveEbookBookmark(textID: String, quote: String, chapter: String?, location: String?) async throws -> EbookBookmark {
        let bookmark = try mapped(try await client.ebookBookmark(path: .init(textId: textID), body: .json(.init(quote: quote, chapter: chapter, location: location))).ok.body.json, to: EbookBookmark.self)
        // Refresh authoritative private bookmark metadata after a confirmed save.
        _ = try? await ebook(textID: textID)
        return bookmark
    }
    public func removeEbookBookmark(textID: String, bookmarkID: Int) async throws {
        _ = try await client.removeEbookBookmark(path: .init(textId: textID), body: .json(.init(bookmarkId: bookmarkID))).ok
        await localStore?.removeEbookBookmark(textID: textID, bookmarkID: bookmarkID)
    }
    public func ebookDefinitions(textID: String, quote: String, context: String, offset: Int) -> AsyncThrowingStream<DefinitionEvent, Error> {
        definitionStream {
            try await client.ebookDefinitions(path: .init(textId: textID), body: .json(.init(quote: quote, context: context, offset: offset))).ok.body.application_x_hyphen_ndjson
        }
    }
    public func saveEbookVocabulary(textID: String, completionID: String) async throws -> SavedVocabulary {
        let requestID = UUID().uuidString
        return try await MutationRetry.run {
            try mapped(try await client.ebookVocabulary(path: .init(textId: textID), body: .json(.init(completionId: completionID, requestId: requestID))).ok.body.json, to: SavedVocabulary.self)
        }
    }
    public func definitions(selection: ReadingSelection) -> AsyncThrowingStream<DefinitionEvent, Error> {
        definitionStream {
            try await client.definitions(path: .init(textId: selection.textID.rawValue),
                body: .json(.init(revision: selection.revision, blockId: selection.blockID,
                    range: .init(location: selection.range.location, length: selection.range.length)))).ok.body.application_x_hyphen_ndjson
        }
    }
    private func definitionStream(body: @escaping @Sendable () async throws -> HTTPBody) -> AsyncThrowingStream<DefinitionEvent, Error> {
        DefinitionStreaming.events(body: body)
    }
    @discardableResult public func save(selection: ReadingSelection, completionID: String?) async throws -> SavedVocabulary {
        let requestID = UUID().uuidString
        return try await MutationRetry.run {
            let result = try await client.vocabulary(path: .init(textId: selection.textID.rawValue), body: .json(.init(
                occurrence: .init(textId: selection.textID.rawValue, revision: selection.revision, blockId: selection.blockID,
                    range: .init(location: selection.range.location, length: selection.range.length)), completionId: completionID, requestId: requestID))).ok.body.json
            return try mapped(result, to: SavedVocabulary.self)
        }
    }

    public static func isAccessFailure(_ error: any Error) -> Bool {
        guard let failure = cause(of: error) as? MobileFailure else { return false }
        return ["inaccessible", "unauthenticated"].contains(failure.error.code)
    }
    public static func isConnectionFailure(_ error: any Error) -> Bool {
        guard let error = cause(of: error) as? URLError else { return false }
        return [
            .notConnectedToInternet, .networkConnectionLost, .timedOut, .cannotConnectToHost,
            .cannotFindHost, .dnsLookupFailed, .internationalRoamingOff, .dataNotAllowed,
            .cannotLoadFromNetwork, .resourceUnavailable, .secureConnectionFailed,
            .serverCertificateHasBadDate, .serverCertificateUntrusted, .serverCertificateHasUnknownRoot,
            .serverCertificateNotYetValid, .clientCertificateRejected, .clientCertificateRequired,
        ].contains(error.code)
    }
    public func cachedDocument(textID: String) async -> RemoteDocument? {
        guard let details = await localStore?.value(RemoteDocument.self, for: "document/\(textID)"),
              (try? details.document?.validate()) != nil || details.document == nil else { return nil }
        return details
    }
    public func allLibraries() async throws -> [CatalogLibrary] {
        let version = await localStore?.version(for: "libraries")
        let items = try await collectPages { try await libraries(cursor: $0) }
        await localStore?.reconcileLibraries(items, ifUnchanged: version)
        return items
    }
    public func allTexts(libraryID: String) async throws -> [CatalogText] {
        let version = await localStore?.version(for: "texts/\(libraryID)")
        let items = try await collectPages { try await texts(libraryID: libraryID, cursor: $0) }
        await localStore?.reconcileTexts(items, libraryID: libraryID, ifUnchanged: version)
        return items
    }
    public func allVocabulary(libraryID: String) async throws -> [SavedWord] {
        let version = await localStore?.version(for: "words/\(libraryID)") ?? 0
        let items = try await collectPages { try await vocabulary(libraryID: libraryID, cursor: $0) }
        await localStore?.save(items, for: "words/\(libraryID)", ifUnchanged: version)
        return items
    }
    private func collectPages<Item: Codable & Identifiable & Sendable>(_ fetch: (String?) async throws -> CatalogPage<Item>) async throws -> [Item] where Item.ID: Sendable {
        var items: [Item] = [], cursor: String?, seen = Set<String>(), ids = Set<Item.ID>()
        repeat {
            let page = try await fetch(cursor)
            try Task.checkCancellation()
            items.append(contentsOf: page.items.filter { ids.insert($0.id).inserted })
            cursor = page.nextCursor
            if let cursor, !seen.insert(cursor).inserted { throw URLError(.badServerResponse) }
        } while cursor != nil
        return items
    }
    private static func bookSource(_ url: URL) -> String {
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        components?.query = nil; components?.fragment = nil
        return components?.string ?? url.absoluteString
    }
    public func cachedEbook(textID: String) async -> LocalEbook? {
        guard let descriptor = await localStore?.value(EbookDescriptor.self, for: "ebook/\(textID)"),
              let data = await localStore?.data(for: "book/\(textID)"),
              await localStore?.value(String.self, for: "book-source/\(textID)") == Self.bookSource(descriptor.url) else { return nil }
        return LocalEbook(descriptor: descriptor, data: data, location: descriptor.location)
    }
    public func downloadEbook(textID: String) async throws -> LocalEbook {
        let descriptor = try await ebook(textID: textID)
        if let data = await localStore?.data(for: "book/\(textID)"),
           await localStore?.value(String.self, for: "book-source/\(textID)") == Self.bookSource(descriptor.url) {
            return LocalEbook(descriptor: descriptor, data: data, location: descriptor.location)
        }
        let data = try await LocalAssetDownloads.shared.load(descriptor.url, limit: 80 * 1024 * 1024)
        try Task.checkCancellation()
        try await localStore?.saveData(data, for: "book/\(textID)")
        await localStore?.save(Self.bookSource(descriptor.url), for: "book-source/\(textID)")
        return LocalEbook(descriptor: descriptor, data: data, location: descriptor.location)
    }
}

public struct LocalEbook: Sendable {
    public let descriptor: EbookDescriptor
    public let data: Data
    public let location: String?
}

public actor LocalAssetDownloads {
    public static let shared = LocalAssetDownloads()
    private var requests: [URL: Task<Data, Error>] = [:]
    public func load(_ url: URL, limit: Int) async throws -> Data {
        guard url.scheme == "https" || url.scheme == "http" && url.host == "localhost" else { throw URLError(.unsupportedURL) }
        if let task = requests[url] {
            let data = try await task.value
            guard data.count <= limit else { throw URLError(.dataLengthExceedsMaximum) }
            return data
        }
        let task = Task {
            var request = URLRequest(url: url); request.timeoutInterval = 30
            let (file, response) = try await URLSession.shared.download(for: request)
            defer { try? FileManager.default.removeItem(at: file) }
            guard (response as? HTTPURLResponse)?.statusCode == 200,
                  (try file.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? .max) <= limit else { throw URLError(.badServerResponse) }
            return try Data(contentsOf: file)
        }
        requests[url] = task
        defer { requests[url] = nil }
        return try await task.value
    }

}
