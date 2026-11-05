import Foundation
import Testing
import HTTPTypes
import OpenAPIRuntime
@testable import LeximoryCore

struct ArticleAudioTests {
    @Test func unlistedLanguageIsNotLabeledAsDutch() {
        #expect(learningLanguageName("nl") == "其他")
    }
    @Test func generatedClientRetriesTheSameRevisionAndReturnsTheWholeArticleRecording() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://example.com"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        let document = try ReadingTests().fixture()
        let text = CatalogText(id: "article", libraryId: "folder", title: "Article", topics: [], emoji: nil, createdAt: nil, format: "article")
        let library = CatalogLibrary(id: "folder", name: "Reading", language: "en", owned: true, archived: false, shadow: false)
        await store.save(RemoteDocument(text: text, library: library, document: document, annotationProgress: nil), for: "document/article")
        let transport = AudioTransport(revision: document.revision)
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "test" }, localStore: store)
        let id = try await client.generateArticleAudio(textID: "article", revision: document.revision)
        #expect(id == "article_audio")
        let descriptor = try await client.audio(textID: "article", audioID: id)
        #expect(descriptor.url.absoluteString == "https://example.com/full.mp3")
        #expect(await transport.generations == 2)
        #expect(await client.cachedDocument(textID: "article")?.fullArticleAudioId == id)
        await store.applyTextEdit(text, content: document.source)
        #expect(await client.cachedDocument(textID: "article")?.fullArticleAudioId == id)
    }
    private actor AudioTransport: ClientTransport {
        var generations = 0
        let revision: String
        init(revision: String) { self.revision = revision }
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            if operationID == "generateArticleAudio" {
                generations += 1
                #expect(request.method == .post)
                #expect(request.path == "/texts/article/article-audio")
                let data = try await Data(collecting: #require(body), upTo: 1024)
                let payload = try JSONDecoder().decode([String: String].self, from: data)
                #expect(payload == ["revision": revision])
                if generations == 1 { throw URLError(.networkConnectionLost) }
                return (.init(status: .ok), HTTPBody(#"{"audioId":"article_audio"}"#))
            }
            #expect(operationID == "audio")
            #expect(request.path == "/texts/article/audio/article_audio")
            return (.init(status: .ok), HTTPBody(#"{"url":"https://example.com/full.mp3","expiresAt":"2030-01-01T00:00:00Z"}"#))
        }
    }
}
