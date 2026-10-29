import Foundation
import Testing
import HTTPTypes
import OpenAPIRuntime
@testable import LeximoryCore

struct ReviewTests {
    @Test(arguments: [(0, false, 1), (1, false, 12), (2, false, 24), (3, true, 36), (5, true, 60)])
    func translationsUnlockWritingAtSixtyPercent(completed: Int, unlocked: Bool, percentage: Int) throws {
        let items = (0..<5).map { index in
            ReviewTranslation(prompt: "Translate", answer: "Answer", keyword: "word", submission: nil, status: index < completed ? .complete : .idle, feedback: nil)
        }
        let review = ReviewSnapshot(exists: true, inProgress: false, story: "Story", translations: items, conversation: nil)
        #expect(review.conversationUnlocked == unlocked)
        #expect(review.percentage == percentage)
        #expect(review.requiredTranslations == 3)
    }
    @Test func writingCompletesTheReviewAndEmptyTranslationsStayLocked() {
        let writing = ReviewConversation(prompt: "Write", keywords: [], submission: "Hello", status: .complete, feedback: nil, reply: "Hello")
        let review = ReviewSnapshot(exists: true, inProgress: false, story: "Story", translations: [], conversation: writing)
        #expect(review.percentage == 100)
        #expect(!review.conversationUnlocked)
        #expect(!review.needsRefresh)
    }
    @Test func reviewReadsRefreshExpiredTokensAndSubmissionsUseTheSelectedDay() async throws {
        let transport = ReviewTransport()
        let client = MobileClient(baseURL: URL(string: "https://review.example")!, transport: transport, token: { rejected in rejected == nil ? "expired" : "fresh" })
        let selection = ReviewSelection(date: "2026-10-12", language: "fr")
        let snapshot = try await client.reviewSnapshot(selection)
        #expect(snapshot.exists)
        #expect(await transport.authorizations == ["Bearer expired", "Bearer fresh"])
        try await client.submitReview(selection, index: 2, submission: "Bonjour")
        let input = try #require(await transport.submission)
        #expect(input.date == "2026-10-12")
        #expect(input.lang == "fr")
        #expect(input.index == 2)
        #expect(input.submission == "Bonjour")
        #expect(await transport.paths.last == "/review/translation")
    }
    @Test func failedSubmissionsAreNeverAutomaticallyReplayed() async throws {
        let transport = ReviewTransport(failSubmission: true)
        let client = MobileClient(baseURL: URL(string: "https://review.example")!, transport: transport, token: { _ in "fresh" })
        await #expect(throws: URLError.self) {
            try await client.submitReview(ReviewSelection(date: "2026-10-12", language: "en"), index: nil, submission: "Hello")
        }
        #expect(await transport.paths == ["/review/conversation"])
    }

    @Test func interruptedReviewReadCanReachTheServerOnItsNextPoll() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://review.example"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        let transport = InterruptedReviewTransport()
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "fresh" }, localStore: store)
        let selection = ReviewSelection(date: "2026-10-12", language: "en")
        await #expect(throws: URLError.self) { try await client.reviewSnapshot(selection) }
        let snapshot = try await client.reviewSnapshot(selection)
        #expect(snapshot.exists)
        #expect(await transport.calls == 2)
        #expect(await store.status().online)
    }

    private actor InterruptedReviewTransport: ClientTransport {
        private(set) var calls = 0
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            calls += 1
            if calls == 1 { throw URLError(.networkConnectionLost) }
            return (HTTPResponse(status: .ok), HTTPBody(#"{"exists":true,"inProgress":false,"translations":[]}"#))
        }
    }

    private actor ReviewTransport: ClientTransport {
        struct Input: Decodable { let date: String; let lang: String; let index: Int?; let submission: String? }
        let failSubmission: Bool
        var authorizations: [String] = []
        var paths: [String] = []
        var submission: Input?
        init(failSubmission: Bool = false) { self.failSubmission = failSubmission }
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            authorizations.append(request.headerFields[.authorization] ?? "")
            paths.append(request.path ?? "")
            if request.method == .get && request.headerFields[.authorization] == "Bearer expired" {
                return (HTTPResponse(status: .unauthorized), HTTPBody("{}"))
            }
            if let body {
                submission = try JSONDecoder().decode(Input.self, from: await Data(collecting: body, upTo: 65536))
                if failSubmission { throw URLError(.networkConnectionLost) }
                return (HTTPResponse(status: .ok), HTTPBody(#"{"success":true}"#))
            }
            return (HTTPResponse(status: .ok), HTTPBody(#"{"exists":true,"inProgress":false,"stage":"complete","story":"A story","translations":[],"conversation":null}"#))
        }
    }
}
