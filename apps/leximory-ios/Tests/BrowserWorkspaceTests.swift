import Foundation
import Testing
import LeximoryCore
import OpenAPIRuntime
import HTTPTypes
@testable import Leximory

@MainActor struct BrowserWorkspaceTests {
    @Test func homePinsPersistEditsAndDeletionPerAccount() throws {
        let namespace = "pins-test." + UUID().uuidString
        defer { UserDefaults.standard.removeObject(forKey: "browser.home-pins." + namespace) }
        let mobile = client(WorkspaceTransport())
        let workspace = BrowserWorkspaceModel(client: mobile, namespace: namespace)
        let url = try #require(URL(string: "https://example.com/article"))
        workspace.visit(.web(WebResource(url: url, bookmarkID: "saved-bookmark")))
        var pin = try #require(workspace.currentPin)
        #expect(pin.destination == .webpage(url, bookmarkID: "saved-bookmark"))
        pin.title = "Reading"
        workspace.savePin(pin)
        #expect(workspace.currentPin?.id == pin.id)
        pin.title = "Daily reading"
        workspace.savePin(pin)
        let restored = BrowserWorkspaceModel(client: mobile, namespace: namespace)
        #expect(restored.homePins == [pin])
        #expect(BrowserWorkspaceModel(client: mobile, namespace: namespace + ".other").homePins.isEmpty)
        restored.clearHistory()
        #expect(restored.homePins == [pin])
        restored.deletePin(pin)
        #expect(BrowserWorkspaceModel(client: mobile, namespace: namespace).homePins.isEmpty)
    }

    @Test func automaticallyReconciledReviewFailureDoesNotNotifyOrLoseTheDraft() async throws {
        let client = MobileClient(baseURL: try #require(URL(string: "https://workspace.test")), transport: OfflineTransport(), token: { _ in "verified" })
        let model = ReviewModel(client: client, selection: ReviewSelection(date: "2026-10-13", language: "en"))
        model.drafts["translation-0"] = "My answer"
        await model.submit(index: 0, text: "My answer")
        #expect(model.error == nil)
        #expect(model.drafts["translation-0"] == "My answer")
        #expect(model.awaitingConfirmation)
        #expect(!model.submitting)
    }
    private struct OfflineTransport: ClientTransport {
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            throw URLError(.networkConnectionLost)
        }
    }

    @Test func recentReadingRestoresTitlesBeforeAnyFolderRefresh() async throws {
        let namespace = "workspace-test." + UUID().uuidString
        defer {
            UserDefaults.standard.removeObject(forKey: "browser.recent." + namespace)
            UserDefaults.standard.removeObject(forKey: "recent-access." + namespace)
            UserDefaults.standard.removeObject(forKey: "browser.annotations." + namespace)
        }
        let mobile = client(WorkspaceTransport())
        let workspace = BrowserWorkspaceModel(client: mobile, namespace: namespace)
        let details = try await mobile.documentDetails(textID: "article")
        await workspace.open(details.text)
        let restored = BrowserWorkspaceModel(client: mobile, namespace: namespace)
        #expect(restored.recentTexts == [details.text])
        let otherAccount = BrowserWorkspaceModel(client: mobile, namespace: namespace + ".other")
        #expect(otherAccount.recentTexts.isEmpty)
    }

    @Test func webpageAddressShowsItsDomainImmediatelyAndAfterHistoryNavigation() throws {
        let workspace = BrowserWorkspaceModel(client: client(WorkspaceTransport()), namespace: "workspace-test." + UUID().uuidString)
        workspace.visit(.web(WebResource(url: try #require(URL(string: "https://reading.example.com/a/long/article?ref=home")))))
        #expect(workspace.addressLabel == "reading.example.com")
        workspace.visit(.home)
        #expect(workspace.addressLabel == "Leximory")
        workspace.go(-1)
        #expect(workspace.addressLabel == "reading.example.com")
    }

    @Test func reviewBackDismissesEachTrayBeforeLeavingTheLawn() {
        let workspace = BrowserWorkspaceModel(client: client(WorkspaceTransport()), namespace: "workspace-test." + UUID().uuidString)
        workspace.visit(.review)
        workspace.openReview(ReviewSelection(date: "2026-10-13", language: "en"))
        guard case .reviewSession(let model) = workspace.current.resource else { Issue.record("Expected a review lawn"); return }
        let lawnID = workspace.current.id
        let entries = workspace.history.entries.count
        for exercise in [ReviewExercise.translation(0), .conversation] {
            model.exercise = exercise
            workspace.go(-1)
            #expect(model.exercise == nil)
            #expect(workspace.current.id == lawnID)
            #expect(workspace.history.entries.count == entries)
        }
        workspace.go(-1)
        #expect(workspace.current.title == "每日复习")
    }

    @Test func recentWebpageRestoresOnlyTheLatestValidLinkAndKeepsAccountsSeparate() throws {
        let namespace = "workspace-test." + UUID().uuidString
        let key = "browser.recent-web." + namespace
        defer { UserDefaults.standard.removeObject(forKey: key) }
        let urls = ["https://one.test", "https://one.test", "file:///private/secret", "https://two.test", "https://three.test", "https://four.test"]
        let pages = try urls.map { RecentWebpage(url: try #require(URL(string: $0))) }
        UserDefaults.standard.set(try JSONEncoder().encode(pages), forKey: key)
        let workspace = BrowserWorkspaceModel(client: client(WorkspaceTransport()), namespace: namespace)
        #expect(workspace.recentWebpages.map(\.url.absoluteString) == ["https://one.test"])
        let otherAccount = BrowserWorkspaceModel(client: client(WorkspaceTransport()), namespace: namespace + ".other")
        #expect(otherAccount.recentWebpages.isEmpty)
        workspace.clearHistory()
        #expect(workspace.recentWebpages.isEmpty)
        #expect(UserDefaults.standard.object(forKey: key) == nil)
    }
    @Test func existingSingleWebpageRemainsAvailableAfterUpgrade() throws {
        let namespace = "workspace-test." + UUID().uuidString
        let key = "browser.recent-web." + namespace
        defer { UserDefaults.standard.removeObject(forKey: key) }
        let page = RecentWebpage(url: try #require(URL(string: "https://reading.test/article")), title: "A quiet forest", bookmarkID: "saved-article")
        UserDefaults.standard.set(try JSONSerialization.data(withJSONObject: ["url": page.url.absoluteString, "title": "A quiet forest", "bookmarkID": "saved-article"]), forKey: key)
        let workspace = BrowserWorkspaceModel(client: client(WorkspaceTransport()), namespace: namespace)
        #expect(workspace.recentWebpages == [page])
    }
    @Test func leavingAnArticleKeepsItsAnnotationActivityAndOpeningItAcknowledgesCompletion() async throws {
        let transport = WorkspaceTransport()
        let namespace = "workspace-test." + UUID().uuidString
        defer { UserDefaults.standard.removeObject(forKey: "browser.annotations." + namespace); UserDefaults.standard.removeObject(forKey: "browser.recent." + namespace); UserDefaults.standard.removeObject(forKey: "browser.recent-web." + namespace); UserDefaults.standard.removeObject(forKey: "recent-access." + namespace) }
        let workspace = BrowserWorkspaceModel(client: client(transport), namespace: namespace)
        let details = try await workspace.client.documentDetails(textID: "article")
        await workspace.imported(details.text, annotating: true)
        #expect(workspace.hasPending)
        workspace.visit(.home)
        await transport.complete()
        await workspace.poll()
        #expect(workspace.readyCount == 1)
        #expect(workspace.hasPending == false)
        #expect(workspace.completionID == nil)
        await workspace.open(details.text)
        #expect(workspace.readyCount == 0)
        #expect(workspace.current.textID == "article")
    }
    @Test func completionInTheCurrentArticleTriggersTheRevealWithoutAnUnreadCount() async throws {
        let transport = WorkspaceTransport()
        let namespace = "workspace-test." + UUID().uuidString
        defer { UserDefaults.standard.removeObject(forKey: "browser.annotations." + namespace); UserDefaults.standard.removeObject(forKey: "browser.recent." + namespace); UserDefaults.standard.removeObject(forKey: "browser.recent-web." + namespace); UserDefaults.standard.removeObject(forKey: "recent-access." + namespace) }
        let workspace = BrowserWorkspaceModel(client: client(transport), namespace: namespace)
        let details = try await workspace.client.documentDetails(textID: "article")
        await workspace.imported(details.text, annotating: true)
        await transport.complete()
        await workspace.poll()
        #expect(workspace.completionID == "article")
        #expect(workspace.readyCount == 0)
    }
    @Test func aLateOpenDoesNotReplaceANewerDestination() async throws {
        let transport = WorkspaceTransport()
        let namespace = "workspace-test." + UUID().uuidString
        defer { UserDefaults.standard.removeObject(forKey: "browser.annotations." + namespace); UserDefaults.standard.removeObject(forKey: "browser.recent." + namespace); UserDefaults.standard.removeObject(forKey: "browser.recent-web." + namespace); UserDefaults.standard.removeObject(forKey: "recent-access." + namespace) }
        let workspace = BrowserWorkspaceModel(client: client(transport), namespace: namespace)
        let details = try await workspace.client.documentDetails(textID: "article")
        await transport.delayNextRead()
        let open = Task { await workspace.open(details.text) }
        while await transport.calls < 2 { try await Task.sleep(for: .milliseconds(10)) }
        workspace.visit(.bookmarks)
        await open.value
        #expect(workspace.current.title == "我的书签")
        #expect(workspace.opening == false)
    }
    @Test func clearingHistoryRemovesWebKitHistoryWithoutRemovingAnnotationActivity() async throws {
        let transport = WorkspaceTransport()
        let namespace = "workspace-test." + UUID().uuidString
        defer { UserDefaults.standard.removeObject(forKey: "browser.annotations." + namespace); UserDefaults.standard.removeObject(forKey: "browser.recent." + namespace); UserDefaults.standard.removeObject(forKey: "browser.recent-web." + namespace); UserDefaults.standard.removeObject(forKey: "recent-access." + namespace) }
        let workspace = BrowserWorkspaceModel(client: client(transport), namespace: namespace)
        let details = try await workspace.client.documentDetails(textID: "article")
        await workspace.imported(details.text, annotating: true)
        let browser = workspace.browser
        workspace.clearHistory()
        #expect(workspace.browser !== browser)
        #expect(workspace.history.entries.count == 1)
        #expect(workspace.current.title == "Leximory")
        #expect(workspace.hasPending)
    }
    private func client(_ transport: WorkspaceTransport) -> MobileClient {
        MobileClient(baseURL: URL(string: "https://workspace.test")!, transport: transport, token: { _ in "verified" })
    }
    private actor WorkspaceTransport: ClientTransport {
        var calls = 0
        private var completed = false
        private var delayed = false
        func complete() { completed = true }
        func delayNextRead() { delayed = true }
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            calls += 1
            if delayed { delayed = false; try await Task.sleep(for: .milliseconds(200)) }
            guard operationID == "document" else { throw URLError(.unsupportedURL) }
            let status = completed ? "completed" : "annotating"
            let json = """
            {"text":{"id":"article","libraryId":"folder","title":"Along the river","topics":[],"emoji":null,"createdAt":null,"format":"article"},
             "library":{"id":"folder","name":"Reading","language":"en","owned":true,"archived":false,"shadow":false},"annotationProgress":"\(status)",
             "document":{"version":1,"revision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","source":"Along the river.","blocks":[{"id":"block","kind":"paragraph","sourceRange":{"location":0,"length":16},"displayText":"Along the river.","spans":[]}]}}
            """
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(json))
        }
    }
}
