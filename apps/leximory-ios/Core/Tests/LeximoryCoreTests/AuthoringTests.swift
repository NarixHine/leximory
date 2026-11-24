import Foundation
import Testing
import OpenAPIRuntime
import HTTPTypes
@testable import LeximoryCore

struct AuthoringTests {
    @Test func generatedAuthoringClientPreservesFieldsAndUploadsBytes() async throws {
        let transport = AuthoringTransport()
        let client = MobileClient(baseURL: URL(string: "https://example.com")!, transport: transport, token: { _ in "verified" })
        let preview = try await client.extractArticle(libraryID: "library", url: "https://example.org/article")
        #expect(preview.title == "文章")
        #expect(preview.content == "Along the river.")
        let saved = try await client.savedWord(id: "word")
        #expect(saved.fields.original == "banks")
        #expect(saved.createdAt == "2026-10-04T00:00:00Z")
        #expect(saved.protected == false)
        var fields = saved.fields; fields.definition = "河堤"
        let edited = try await client.editWord(id: "word", fields: fields)
        #expect(edited.fields.definition == "河堤")
        let page = try await client.vocabulary(libraryID: "library")
        #expect(page.items.first?.id == "word")
        let article = try await client.importArticle(libraryID: "library", title: "文章", content: "Along the river.", annotate: false, onlyComments: false, generateTitle: false)
        #expect(article.format == "article")
        let book = try await client.uploadEbook(libraryID: "library", title: "书", filename: "book.pdf", data: Data("%PDF-1.7".utf8))
        #expect(book.format == "ebook")
    }
    @Test func invalidFieldsAndOversizedFilesNeverReachTransport() async throws {
        let transport = AuthoringTransport()
        let client = MobileClient(baseURL: URL(string: "https://example.com")!, transport: transport, token: { _ in "verified" })
        let invalid = VocabularyFields(original: "bank", definition: Definition(lemma: "bank", definition: "bad||value"))
        await #expect(throws: (any Error).self) { try await client.editWord(id: "word", fields: invalid) }
        await #expect(throws: (any Error).self) { try await client.uploadEbook(libraryID: "library", title: "书", filename: "large.pdf", data: Data(count: EbookFileLimit.subscriberBytes + 1)) }
        #expect(await transport.calls == 0)
    }
    @Test func ebookRetryResendsTheSameRequestIdentityAndFile() async throws {
        let transport = AuthoringTransport(failFirstUpload: true)
        let client = MobileClient(baseURL: URL(string: "https://example.com")!, transport: transport, token: { _ in "verified" })
        let book = try await client.uploadEbook(libraryID: "library", title: "书", filename: "book.pdf", data: Data("%PDF-1.7".utf8), requestID: "same-ebook")
        #expect(book.id == "ebook")
        #expect(await transport.uploadIdentities == ["same-ebook", "same-ebook"])
    }
    @Test func stagedEbookFinalizationSendsOnlyTheGrantToTheAppServer() async throws {
        let transport = AuthoringTransport(stagedEbook: true)
        let client = MobileClient(baseURL: URL(string: "https://example.com")!, transport: transport, token: { _ in "verified" })
        let book = try await client.uploadEbook(libraryID: "library", title: "书", filename: "book.pdf",
            data: Data(count: 15_000_000), requestID: "large-book")
        #expect(book.id == "ebook")
        #expect(await transport.calls == 2)
    }
    @Test func articleImportRecoversWithOneRequestIdentity() async throws {
        let transport = RecoveringArticleTransport()
        let client = MobileClient(baseURL: URL(string: "https://import.test")!, transport: transport, token: { _ in "verified" })
        let article = try await client.importArticle(libraryID: "library", title: "Article", content: "Along the river.", annotate: true, onlyComments: false, generateTitle: false)
        #expect(article.id == "article")
        let identities = await transport.identities
        #expect(identities.count == 2)
        #expect(identities.first?.isEmpty == false)
        #expect(Set(identities).count == 1)
    }
    @Test func exhaustedArticleImportCanRetryTheSameIntent() async throws {
        let transport = RecoveringArticleTransport(failures: 3)
        let client = MobileClient(baseURL: URL(string: "https://import.test")!, transport: transport, token: { _ in "verified" })
        await #expect(throws: (any Error).self) {
            try await client.importArticle(libraryID: "library", title: "Article", content: "Along the river.", annotate: false, onlyComments: false, generateTitle: false, requestID: "same-draft")
        }
        let article = try await client.importArticle(libraryID: "library", title: "Article", content: "Along the river.", annotate: false, onlyComments: false, generateTitle: false, requestID: "same-draft")
        #expect(article.id == "article")
        #expect(await transport.identities == ["same-draft", "same-draft", "same-draft", "same-draft"])
    }
    private actor RecoveringArticleTransport: ClientTransport {
        var identities: [String] = []
        let failures: Int
        init(failures: Int = 1) { self.failures = failures }
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            let data = try await Data(collecting: #require(body), upTo: 65536)
            let payload = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
            identities.append(payload["requestId"] as? String ?? "")
            if identities.count <= failures {
                return (HTTPResponse(status: .serviceUnavailable, headerFields: [.contentType: "application/json"]), HTTPBody(#"{"error":{"code":"service_unavailable","message":"temporary","retryable":true}}"#))
            }
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(#"{"id":"article","libraryId":"library","title":"Article","topics":[],"emoji":null,"createdAt":null,"format":"article"}"#))
        }
    }
    private actor AuthoringTransport: ClientTransport {
        var calls = 0
        var uploadIdentities: [String] = []
        let failFirstUpload: Bool
        let stagedEbook: Bool
        init(failFirstUpload: Bool = false, stagedEbook: Bool = false) {
            self.failFirstUpload = failFirstUpload
            self.stagedEbook = stagedEbook
        }
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            calls += 1
            #expect(request.headerFields[.authorization] == "Bearer verified")
            let word = #"{"id":"word","libraryId":"library","createdAt":"2026-10-04T00:00:00Z","protected":false,"fields":{"original":"banks","lemma":"bank","definition":"河岸","etymology":null,"cognates":null}}"#
            let response: String
            switch operationID {
            case "extractArticle": response = #"{"title":"文章","content":"Along the river."}"#
            case "savedWord": response = word
            case "vocabularyList": response = "{\"items\":[\(word)],\"nextCursor\":null}"
            case "editWord":
                let data = try await Data(collecting: #require(body), upTo: 65536)
                let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
                #expect(json["definition"] as? String == "河堤")
                response = word.replacingOccurrences(of: "河岸", with: "河堤")
            case "importArticle":
                #expect(request.path == "/libraries/library/articles")
                response = #"{"id":"article","libraryId":"library","title":"文章","topics":[],"emoji":null,"createdAt":null,"format":"article"}"#
            case "prepareEbookUpload":
                let bytes = try await Data(collecting: #require(body), upTo: 1024)
                let json = try #require(JSONSerialization.jsonObject(with: bytes) as? [String: Any])
                #expect(json["size"] as? Int == 15_000_000)
                #expect(json["requestId"] as? String == "large-book")
                #expect(json["targetId"] as? String == "library")
                response = #"{"id":"fixture-grant","upload":null}"#
            case "uploadEbook":
                let bytes = try await Data(collecting: #require(body), upTo: 1024)
                if stagedEbook {
                    #expect(bytes.isEmpty)
                    #expect(request.path?.contains("uploadId=fixture-grant") == true)
                } else {
                    #expect(bytes == Data("%PDF-1.7".utf8))
                }
                #expect(request.path?.contains("filename=book.pdf") == true)
                #expect(request.headerFields[.contentType] == "application/octet-stream")
                let path = try #require(request.path)
                let query = try #require(URLComponents(string: path)?.queryItems)
                uploadIdentities.append(try #require(query.first { $0.name == "requestId" }?.value))
                if failFirstUpload && uploadIdentities.count == 1 {
                    return (HTTPResponse(status: .serviceUnavailable, headerFields: [.contentType: "application/json"]), HTTPBody(#"{"error":{"code":"service_unavailable","message":"temporary","retryable":true}}"#))
                }
                response = #"{"id":"ebook","libraryId":"library","title":"书","topics":[],"emoji":null,"createdAt":null,"format":"ebook"}"#
            default: throw URLError(.unsupportedURL)
            }
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(response))
        }
    }
}
