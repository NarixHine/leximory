import Foundation
import OpenAPIRuntime
import OpenAPIURLSession
import HTTPTypes

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
}
public struct RemoteDocument: Decodable, Sendable {
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
    func intercept(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String,
                   next: @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)) async throws -> (HTTPResponse, HTTPBody?) {
        var request = request
        let original = try await token(nil)
        request.headerFields[.authorization] = "Bearer \(original)"
        var result = try await next(request, body, baseURL)
        if result.0.status.code == 401 && request.method == .get {
            request.headerFields[.authorization] = "Bearer \(try await token(original))"
            try Task.checkCancellation()
            result = try await next(request, body, baseURL)
        }
        if result.0.status.code == 401 {
            await unauthorized(request.headerFields[.authorization]?.replacingOccurrences(of: "Bearer ", with: "") ?? original)
        }
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
    public let webURL: URL
    public static func cause(of error: any Error) -> any Error {
        if let clientError = error as? ClientError { return cause(of: clientError.underlyingError) }
        return error
    }
    public init(baseURL: URL, token: @escaping @Sendable (String?) async throws -> String, unauthorized: @escaping @Sendable (String) async -> Void = { _ in }) {
        webURL = baseURL
        client = Client(serverURL: baseURL.appending(path: "api/mobile/v1"), configuration: .init(dateTranscoder: APIExpiryDates()), transport: URLSessionTransport(), middlewares: [BearerMiddleware(token: token, unauthorized: unauthorized)])
    }
    public init(baseURL: URL, transport: any ClientTransport, token: @escaping @Sendable (String?) async throws -> String, unauthorized: @escaping @Sendable (String) async -> Void = { _ in }) {
        webURL = baseURL
        client = Client(serverURL: baseURL.appending(path: "api/mobile/v1"), configuration: .init(dateTranscoder: APIExpiryDates()), transport: transport, middlewares: [BearerMiddleware(token: token, unauthorized: unauthorized)])
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
    public func account() async throws -> Account {
        try mapped(try await client.me().ok.body.json, to: Account.self)
    }
    public func libraries(cursor: String? = nil) async throws -> CatalogPage<CatalogLibrary> {
        try mapped(try await client.libraries(query: .init(cursor: cursor)).ok.body.json, to: CatalogPage<CatalogLibrary>.self)
    }
    public func setLibraryArchived(libraryID: String, archived: Bool) async throws {
        _ = try await client.libraryArchive(path: .init(libraryId: libraryID), body: .json(.init(archived: archived))).ok.body.json
    }
    public func texts(libraryID: String, cursor: String? = nil) async throws -> CatalogPage<CatalogText> {
        try mapped(try await client.texts(path: .init(libraryId: libraryID), query: .init(cursor: cursor)).ok.body.json, to: CatalogPage<CatalogText>.self)
    }
    public struct ArticlePreview: Codable, Sendable { public let title: String; public let content: String }
    public func extractArticle(libraryID: String, url: String) async throws -> ArticlePreview {
        try mapped(try await client.extractArticle(path: .init(libraryId: libraryID), body: .json(.init(url: url))).ok.body.json, to: ArticlePreview.self)
    }
    public func vocabulary(libraryID: String, cursor: String? = nil) async throws -> CatalogPage<SavedWord> {
        try mapped(try await client.vocabularyList(path: .init(libraryId: libraryID), query: .init(cursor: cursor)).ok.body.json, to: CatalogPage<SavedWord>.self)
    }
    public func savedWord(id: String) async throws -> SavedWord {
        try mapped(try await client.savedWord(path: .init(wordId: id)).ok.body.json, to: SavedWord.self)
    }
    public func editWord(id: String, fields: VocabularyFields) async throws -> SavedWord {
        guard fields.isValid else { throw URLError(.cannotParseResponse) }
        return try mapped(try await client.editWord(path: .init(wordId: id), body: .json(.init(
            lemma: fields.lemma, definition: fields.definition, etymology: fields.etymology,
            cognates: fields.cognates, original: fields.original))).ok.body.json, to: SavedWord.self)
    }
    public func importArticle(libraryID: String, title: String, content: String, annotate: Bool, onlyComments: Bool, generateTitle: Bool) async throws -> CatalogText {
        try mapped(try await client.importArticle(path: .init(libraryId: libraryID), body: .json(.init(
            title: title, content: content, annotate: annotate, onlyComments: onlyComments, generateTitle: generateTitle))).ok.body.json, to: CatalogText.self)
    }
    public func uploadEbook(libraryID: String, title: String, filename: String, data: Data) async throws -> CatalogText {
        guard !data.isEmpty, data.count <= 4_718_592 else { throw URLError(.dataLengthExceedsMaximum) }
        return try mapped(try await client.uploadEbook(path: .init(libraryId: libraryID), query: .init(title: title, filename: filename), body: .binary(HTTPBody(data))).ok.body.json, to: CatalogText.self)
    }
    public func documentDetails(textID: String) async throws -> RemoteDocument {
        let payload = try await client.document(path: .init(textId: textID)).ok.body.json
        let result = try mapped(payload, to: RemoteDocument.self)
        try result.document?.validate()
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
        try mapped(try await client.ebook(path: .init(textId: textID)).ok.body.json, to: EbookDescriptor.self)
    }
    public func saveEbookPosition(textID: String, location: String) async throws {
        _ = try await client.ebookPosition(path: .init(textId: textID), body: .json(.init(location: location))).ok
    }
    public func saveEbookBookmark(textID: String, quote: String, chapter: String?, location: String?) async throws -> EbookBookmark {
        try mapped(try await client.ebookBookmark(path: .init(textId: textID), body: .json(.init(quote: quote, chapter: chapter, location: location))).ok.body.json, to: EbookBookmark.self)
    }
    public func ebookDefinitions(textID: String, quote: String, context: String, offset: Int) -> AsyncThrowingStream<DefinitionEvent, Error> {
        definitionStream {
            try await client.ebookDefinitions(path: .init(textId: textID), body: .json(.init(quote: quote, context: context, offset: offset))).ok.body.application_x_hyphen_ndjson
        }
    }
    public func saveEbookVocabulary(textID: String, completionID: String) async throws -> SavedVocabulary {
        try mapped(try await client.ebookVocabulary(path: .init(textId: textID), body: .json(.init(completionId: completionID))).ok.body.json, to: SavedVocabulary.self)
    }
    public func definitions(selection: ReadingSelection) -> AsyncThrowingStream<DefinitionEvent, Error> {
        definitionStream {
            try await client.definitions(path: .init(textId: selection.textID.rawValue),
                body: .json(.init(revision: selection.revision, blockId: selection.blockID,
                    range: .init(location: selection.range.location, length: selection.range.length)))).ok.body.application_x_hyphen_ndjson
        }
    }
    private func definitionStream(body: @escaping @Sendable () async throws -> HTTPBody) -> AsyncThrowingStream<DefinitionEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let body = try await body()
                    var decoder = DefinitionFrames()
                    for try await chunk in body {
                        try Task.checkCancellation()
                        for event in try decoder.append(Data(chunk)) { continuation.yield(event) }
                    }
                    try decoder.finish()
                    continuation.finish()
                } catch { continuation.finish(throwing: error) }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
    @discardableResult public func save(selection: ReadingSelection, completionID: String?) async throws -> SavedVocabulary {
        let result = try await client.vocabulary(path: .init(textId: selection.textID.rawValue), body: .json(.init(
            occurrence: .init(textId: selection.textID.rawValue, revision: selection.revision, blockId: selection.blockID,
                range: .init(location: selection.range.location, length: selection.range.length)), completionId: completionID))).ok.body.json
        return try mapped(result, to: SavedVocabulary.self)
    }

}
