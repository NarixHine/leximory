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
        await #expect(throws: (any Error).self) { try await client.uploadEbook(libraryID: "library", title: "书", filename: "large.pdf", data: Data(count: 4_718_593)) }
        #expect(await transport.calls == 0)
    }
    private actor AuthoringTransport: ClientTransport {
        var calls = 0
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
            case "uploadEbook":
                let bytes = try await Data(collecting: #require(body), upTo: 1024)
                #expect(bytes == Data("%PDF-1.7".utf8))
                #expect(request.path?.contains("filename=book.pdf") == true)
                #expect(request.headerFields[.contentType] == "application/octet-stream")
                response = #"{"id":"ebook","libraryId":"library","title":"书","topics":[],"emoji":null,"createdAt":null,"format":"ebook"}"#
            default: throw URLError(.unsupportedURL)
            }
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(response))
        }
    }
}
