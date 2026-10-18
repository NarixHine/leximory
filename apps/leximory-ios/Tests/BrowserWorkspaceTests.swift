import Foundation
import UIKit
import Testing
import LeximoryCore
import OpenAPIRuntime
import HTTPTypes
import Network
@testable import Leximory

private final class ScrollHistoryServer: Sendable {
    let listener: NWListener
    let origin: URL
    init() async throws {
        let listener = try NWListener(using: .tcp, on: .any)
        self.listener = listener
        let html = """
            <html><head><meta name="viewport" content="width=device-width,initial-scale=1">
            <script>history.scrollRestoration = 'manual';</script></head>
            <body style="height:6000px">A long reading page</body></html>
            """
        let response = Data(("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: \(html.utf8.count)\r\nConnection: close\r\n\r\n" + html).utf8)
        listener.newConnectionHandler = { connection in
            connection.start(queue: .global())
            connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { _, _, _, _ in
                connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
            }
        }
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
            listener.stateUpdateHandler = { state in
                switch state {
                case .ready: listener.stateUpdateHandler = nil; continuation.resume()
                case .failed(let error): listener.stateUpdateHandler = nil; continuation.resume(throwing: error)
                default: break
                }
            }
            listener.start(queue: .global())
        }
        let port = try #require(listener.port)
        origin = try #require(URL(string: "http://127.0.0.1:\(port.rawValue)"))
    }
}

@MainActor struct BrowserWorkspaceTests {
    @Test func webpageHistoryRestoresEachPagesScrollPosition() async throws {
        let namespace = "workspace-test." + UUID().uuidString
        defer { UserDefaults.standard.removeObject(forKey: "browser.recent-web." + namespace) }
        let workspace = BrowserWorkspaceModel(client: client(WorkspaceTransport()), namespace: namespace)
        let web = workspace.browser.web
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = UIWindow(windowScene: scene)
        window.frame = CGRect(x: 0, y: 0, width: 390, height: 844)
        let controller = UIViewController()
        window.rootViewController = controller
        controller.view.addSubview(web)
        web.frame = window.bounds
        window.makeKeyAndVisible()
        defer { web.stopLoading(); window.isHidden = true }
        let server = try await ScrollHistoryServer()
        defer { server.listener.cancel() }
        let first = server.origin.appending(path: "first")
        let second = server.origin.appending(path: "second")
        func waitForPage(_ url: URL) async throws {
            for _ in 0..<500 {
                if web.backForwardList.currentItem?.url == url, !web.isLoading {
                    try await Task.sleep(for: .milliseconds(150))
                    return
                }
                try await Task.sleep(for: .milliseconds(20))
            }
            Issue.record("Navigation timed out: expected \(url), actual \(String(describing: web.url)), workspace \(workspace.current.title)")
            throw URLError(.timedOut)
        }
        workspace.openURL(first)
        try await waitForPage(first)
        web.scrollView.setContentOffset(CGPoint(x: 0, y: 420), animated: false)
        workspace.browser.load(second)
        try await waitForPage(second)
        if case .web(let saved) = workspace.history.entries[1].resource {
            #expect(abs(saved.offset - 420) < 2, "The departing page must be captured before navigation resets its scroll view")
        }
        web.scrollView.setContentOffset(CGPoint(x: 0, y: 980), animated: false)
        workspace.go(-1)
        try await waitForPage(first)
        #expect(abs(web.scrollView.contentOffset.y - 420) < 2)
        workspace.go(1)
        try await waitForPage(second)
        #expect(abs(web.scrollView.contentOffset.y - 980) < 2)
        web.goBack()
        try await waitForPage(first)
        #expect(abs(web.scrollView.contentOffset.y - 420) < 2)
        web.goForward()
        try await waitForPage(second)
        #expect(abs(web.scrollView.contentOffset.y - 980) < 2)
        workspace.visit(.home)
        workspace.go(-1)
        #expect(abs(web.scrollView.contentOffset.y - 980) < 2)
    }

    @Test func addressSearchUsesActiveFoldersCapsMatchesAndKeepsCacheOnRefreshFailure() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://workspace.test"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "address-search")
        func folder(_ id: String, archived: Bool = false, shadow: Bool = false) throws -> CatalogLibrary {
            let data = try JSONSerialization.data(withJSONObject: ["id": id, "name": id, "language": "en", "owned": true, "archived": archived, "shadow": shadow])
            return try JSONDecoder().decode(CatalogLibrary.self, from: data)
        }
        func text(_ id: String, folder: String, title: String, format: String) throws -> CatalogText {
            let data = try JSONSerialization.data(withJSONObject: ["id": id, "libraryId": folder, "title": title, "topics": [], "format": format])
            return try JSONDecoder().decode(CatalogText.self, from: data)
        }
        let active = try folder("active")
        let archived = try folder("archive", archived: true)
        let shadow = try folder("shadow", shadow: true)
        await store.save([archived, shadow, active], for: "libraries")
        var rows = try [text("article", folder: "active", title: "Café river", format: "article"),
                        text("ebook", folder: "active", title: "River journey", format: "ebook"),
                        text("bookmark", folder: "active", title: "River website", format: "bookmark")]
        rows += try (4...7).map { try text("article-\($0)", folder: "active", title: $0 == 4 ? "River" : "River \($0)", format: "article") }
        await store.save(rows, for: "texts/active")
        await store.save([try text("archived", folder: "archive", title: "River archive", format: "article")], for: "texts/archive")
        await store.save([try text("shadow", folder: "shadow", title: "River shadow", format: "article")], for: "texts/shadow")
        let mobile = MobileClient(baseURL: origin, transport: OfflineTransport(), token: { _ in "verified" }, localStore: store)
        let namespace = "address-search." + UUID().uuidString
        defer { UserDefaults.standard.removeObject(forKey: "browser.recent." + namespace) }
        let workspace = BrowserWorkspaceModel(client: mobile, namespace: namespace)
        await workspace.refresh(online: false)
        #expect(workspace.addressMatches("  RIVER  ", limit: 5).map(\.id) == ["article-4", "article-5", "article-6", "article-7", "ebook"])
        #expect(workspace.addressMatches("river", limit: 0).isEmpty)
        #expect(workspace.addressMatches("river", limit: 1).map(\.id) == ["article-4"])
        #expect(workspace.addressMatches("river", limit: 20).map(\.id) == ["article-4", "article-5", "article-6", "article-7", "ebook"])
        #expect(workspace.addressMatches("cafe", limit: 5).map(\.id) == ["article"])
        #expect(workspace.addressMatches(" \n ", limit: 5).isEmpty)
        #expect(workspace.addressMatches("missing", limit: 5).isEmpty)
        await workspace.prepareAddressSearch(online: true)
        #expect(workspace.error == nil)
        #expect(workspace.addressMatches("journey", limit: 5).map(\.id) == ["ebook"])
        workspace.upsertFolder(try folder("active", archived: true))
        #expect(workspace.addressMatches("river", limit: 5).isEmpty)
    }

    @Test func pinnedIconsRestoreImmediatelyAndSurviveRenamingWithoutAnotherLoad() async throws {
        let namespace = "icons-test." + UUID().uuidString
        defer { UserDefaults.standard.removeObject(forKey: "browser.home-pins." + namespace) }
        let mobile = client(WorkspaceTransport())
        let workspace = BrowserWorkspaceModel(client: mobile, namespace: namespace)
        let page = try #require(URL(string: "https://icons.test/article"))
        let icon = try #require(URL(string: "https://icons.test/favicon.ico"))
        let pin = BrowserHomePin(id: UUID(), title: "Reading", destination: .webpage(page))
        workspace.savePin(pin)
        let image = UIGraphicsImageRenderer(size: CGSize(width: 200, height: 100)).image { context in
            UIColor.green.setFill(); context.fill(CGRect(x: 0, y: 0, width: 200, height: 100))
        }
        var requests = 0
        await workspace.cachePinIcons { url in requests += 1; #expect(url == icon); return image }
        #expect(requests == 1)
        let cached = try #require(workspace.pinImages[icon])
        #expect(cached.size == CGSize(width: 96, height: 96))
        let bytes = try #require(workspace.homePins.first?.faviconData)
        #expect(bytes.count < 65536)
        var staleEditorPin = pin
        staleEditorPin.title = "Daily reading"
        workspace.savePin(staleEditorPin)
        #expect(workspace.homePins.first?.faviconData == bytes)
        let restored = BrowserWorkspaceModel(client: mobile, namespace: namespace)
        #expect(restored.pinImages[icon] != nil)
        #expect(restored.homePins.first?.faviconData == bytes)
        await restored.cachePinIcons { _ in requests += 1; throw URLError(.notConnectedToInternet) }
        #expect(requests == 1)
        #expect(restored.pinImages[icon] != nil)
        let other = BrowserWorkspaceModel(client: mobile, namespace: namespace + ".other")
        #expect(other.pinImages.isEmpty)
    }

    @Test func pinIconResponseCannotRestoreADeletedPin() async throws {
        let namespace = "icons-test." + UUID().uuidString
        defer { UserDefaults.standard.removeObject(forKey: "browser.home-pins." + namespace) }
        let workspace = BrowserWorkspaceModel(client: client(WorkspaceTransport()), namespace: namespace)
        let page = try #require(URL(string: "https://icons.test/article"))
        let pin = BrowserHomePin(id: UUID(), title: "Reading", destination: .webpage(page))
        workspace.savePin(pin)
        var pending: CheckedContinuation<UIImage, Never>?
        let request = Task {
            await workspace.cachePinIcons { _ in await withCheckedContinuation { pending = $0 } }
        }
        for _ in 0..<100 where pending == nil { await Task.yield() }
        let continuation = try #require(pending)
        workspace.deletePin(pin)
        continuation.resume(returning: UIGraphicsImageRenderer(size: CGSize(width: 32, height: 32)).image { _ in })
        await request.value
        #expect(workspace.homePins.isEmpty)
        #expect(workspace.pinImages.isEmpty)
        #expect(BrowserWorkspaceModel(client: client(WorkspaceTransport()), namespace: namespace).homePins.isEmpty)
    }

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

    @Test(arguments: ["article", "ebook"])
    func reopeningHiddenReadingRestoresItToHomeAcrossLaunches(format: String) async throws {
        let namespace = "workspace-test." + UUID().uuidString
        defer {
            for prefix in ["browser.hidden-home-recents.", "browser.recent.", "recent-access.", "browser.annotations."] {
                UserDefaults.standard.removeObject(forKey: prefix + namespace)
            }
        }
        let mobile = client(WorkspaceTransport(format: format))
        let workspace = BrowserWorkspaceModel(client: mobile, namespace: namespace)
        let text = try await mobile.documentDetails(textID: "article").text
        await workspace.open(text)
        workspace.visit(.home)
        workspace.hideRecentText(text)
        #expect(workspace.hiddenHomeRecents.textIDs.contains(text.id))
        #expect(workspace.recentTexts == [text])

        let restored = BrowserWorkspaceModel(client: mobile, namespace: namespace)
        #expect(restored.hiddenHomeRecents.textIDs.contains(text.id))
        #expect(BrowserWorkspaceModel(client: mobile, namespace: namespace + ".other").hiddenHomeRecents.textIDs.isEmpty)
        restored.visit(.bookmarks)
        await restored.open(text)
        restored.visit(.home)
        #expect(restored.hiddenHomeRecents.textIDs.isEmpty)
        #expect(restored.recentTexts == [text])
        #expect(BrowserWorkspaceModel(client: mobile, namespace: namespace).hiddenHomeRecents.textIDs.isEmpty)

        restored.hideRecentText(text)
        restored.go(-1)
        #expect(restored.current.textID == text.id)
        #expect(restored.hiddenHomeRecents.textIDs.isEmpty)
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
    @Test func textRemovalClearsHistoryPinsRecentReadingAndLateAnnotationResponses() async throws {
        let transport = WorkspaceTransport()
        let namespace = "management-test." + UUID().uuidString
        defer {
            for key in ["browser.annotations.", "browser.recent.", "browser.home-pins.", "recent-access."] {
                UserDefaults.standard.removeObject(forKey: key + namespace)
            }
        }
        let workspace = BrowserWorkspaceModel(client: client(transport), namespace: namespace)
        let text = try await workspace.client.documentDetails(textID: "article").text
        await workspace.imported(text, annotating: true)
        workspace.savePin(try #require(workspace.currentPin))
        workspace.visit(.home)
        await workspace.open(text)
        await transport.delayNextRead()
        let calls = await transport.calls
        let poll = Task { await workspace.poll() }
        while await transport.calls == calls { await Task.yield() }
        workspace.contentRemoved(text)
        await poll.value
        #expect(workspace.history.entries.allSatisfy { $0.textID != text.id })
        #expect(workspace.documents[text.id] == nil)
        #expect(workspace.recentTexts.isEmpty)
        #expect(workspace.activities.isEmpty)
        #expect(workspace.homePins.isEmpty)
        #expect(workspace.recentlyOpened[text.libraryId] == nil)
        let reopened = BrowserWorkspaceModel(client: client(transport), namespace: namespace)
        #expect(reopened.recentTexts.isEmpty)
        #expect(reopened.activities.isEmpty)
        #expect(reopened.homePins.isEmpty)
    }
    private func client(_ transport: WorkspaceTransport) -> MobileClient {
        MobileClient(baseURL: URL(string: "https://workspace.test")!, transport: transport, token: { _ in "verified" })
    }
    private actor WorkspaceTransport: ClientTransport {
        var calls = 0
        private let format: String
        private var completed = false
        private var delayed = false
        init(format: String = "article") { self.format = format }
        func complete() { completed = true }
        func delayNextRead() { delayed = true }
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            calls += 1
            if delayed { delayed = false; try await Task.sleep(for: .milliseconds(200)) }
            guard operationID == "document" else { throw URLError(.unsupportedURL) }
            let status = completed ? "completed" : "annotating"
            let json = """
            {"text":{"id":"article","libraryId":"folder","title":"Along the river","topics":[],"emoji":null,"createdAt":null,"format":"\(format)"},
             "library":{"id":"folder","name":"Reading","language":"en","owned":true,"archived":false,"shadow":false},"annotationProgress":"\(status)",
             "document":{"version":1,"revision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","source":"Along the river.","blocks":[{"id":"block","kind":"paragraph","sourceRange":{"location":0,"length":16},"displayText":"Along the river.","spans":[]}]}}
            """
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(json))
        }
    }
}

@MainActor struct BookmarkRefreshTests {
    @Test func pullRecoversAndRefreshesCollapsedFoldersWithoutDownloadingOrFetchingVocabulary() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://bookmarks.test"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "refresh")
        let archived = try decodeText("archived-item", library: "archived", title: "Keep archived content")
        await store.save([archived], for: "texts/archived")
        await store.save([try decodeText("deleted", library: "active", title: "Deleted elsewhere")], for: "texts/active")
        let transport = CatalogRefreshTransport(failures: 1)
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "verified" }, localStore: store)
        let sync = NativeSync(store: store, client: client)
        await store.setOnline(false)
        let complete = await sync.refreshBookmarks(prioritizing: ["active"])
        #expect(complete)
        let active = try #require(await store.value([CatalogText].self, for: "texts/active"))
        let collapsed = try #require(await store.value([CatalogText].self, for: "texts/collapsed"))
        #expect(active.map(\.title) == ["Updated article"])
        #expect(collapsed.map(\.id) == ["ebook", "link"])
        #expect(await store.value([CatalogText].self, for: "texts/archived") == [archived])
        #expect(await transport.catalogReads == 2)
        #expect(await transport.operations.allSatisfy { ["libraries", "texts"].contains($0) })
        await sync.stop()
    }

    @Test func exhaustedRefreshKeepsTheCachedCatalogAndDoesNotSetAModalError() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://bookmarks.test"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "failure")
        let library = try JSONDecoder().decode(CatalogLibrary.self, from: Data(CatalogRefreshTransport.libraryJSON.utf8))
        let text = try decodeText("cached", library: "active", title: "Still readable")
        await store.save([library], for: "libraries")
        await store.save([text], for: "texts/active")
        let transport = CatalogRefreshTransport(failures: 10)
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "verified" }, localStore: store)
        let sync = NativeSync(store: store, client: client)
        let complete = await sync.refreshBookmarks(prioritizing: [])
        let namespace = "refresh-test." + UUID().uuidString
        defer {
            for prefix in ["browser.recent.", "browser.home-pins.", "recent-access."] { UserDefaults.standard.removeObject(forKey: prefix + namespace) }
        }
        let workspace = BrowserWorkspaceModel(client: client, namespace: namespace)
        await workspace.refresh(online: false)
        #expect(!complete)
        #expect(workspace.libraries.map(\.id) == ["active"])
        #expect(workspace.texts["active"]?.map(\.title) == ["Still readable"])
        #expect(workspace.error == nil)
        #expect(await transport.catalogReads == 3)
        await sync.stop()
    }

    @Test func confirmedEditWinsOverAnOlderFolderResponseInBothMemoryAndDisk() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://bookmarks.test"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "race")
        let transport = CatalogRefreshTransport(delayActive: true)
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "verified" }, localStore: store)
        let library = try JSONDecoder().decode(CatalogLibrary.self, from: Data(CatalogRefreshTransport.libraryJSON.utf8))
        let namespace = "refresh-test." + UUID().uuidString
        defer {
            for prefix in ["browser.recent.", "browser.home-pins.", "recent-access."] { UserDefaults.standard.removeObject(forKey: prefix + namespace) }
        }
        let workspace = BrowserWorkspaceModel(client: client, namespace: namespace)
        let read = Task { await workspace.loadFolder(library, online: true) }
        await transport.waitForActiveRead()
        let edited = try decodeText("article", library: "active", title: "My confirmed edit")
        await store.upsertText(edited)
        await workspace.contentChanged(edited, reloadReader: false)
        await transport.resumeActiveRead()
        await read.value
        #expect(workspace.texts["active"]?.map(\.title) == ["My confirmed edit"])
        #expect(await store.value([CatalogText].self, for: "texts/active")?.map(\.title) == ["My confirmed edit"])
    }

    @Test func collectionReadReturnsTheConfirmedSnapshotWhenAnOlderResponseArrives() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://bookmarks.test"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "collection-race")
        let transport = CatalogRefreshTransport(delayActive: true)
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "verified" }, localStore: store)
        let read = Task { try await client.allTexts(libraryID: "active") }
        await transport.waitForActiveRead()
        await store.upsertText(try decodeText("article", library: "active", title: "Confirmed while fetching"))
        await transport.resumeActiveRead()
        let result = try await read.value
        #expect(result.map(\.title) == ["Confirmed while fetching"])
    }

    @Test func ebookRevalidationUpdatesMetadataWithoutDownloadingAnUnchangedFile() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://bookmarks.test"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "ebook")
        try await store.saveBook(Data("original file".utf8), source: "https://bookmarks.test/book.pdf?v=1", textID: "ebook", ifUnchanged: 0)
        let client = MobileClient(baseURL: origin, transport: CatalogRefreshTransport(), token: { _ in "verified" }, localStore: store)
        let book = try await client.downloadEbook(textID: "ebook")
        #expect(book.data == Data("original file".utf8))
        #expect(book.descriptor.bookmarks.map(\.quote) == ["A new highlight"])
        #expect(book.location == "5")
        #expect(await client.cachedEbook(textID: "ebook")?.descriptor.bookmarks.map(\.id) == [42])
    }

    private func decodeText(_ id: String, library: String, title: String) throws -> CatalogText {
        let data = try JSONSerialization.data(withJSONObject: ["id": id, "libraryId": library, "title": title, "topics": [], "format": "article"])
        return try JSONDecoder().decode(CatalogText.self, from: data)
    }

    private actor CatalogRefreshTransport: ClientTransport {
        static let libraryJSON = #"{"id":"active","name":"Reading","language":"en","owned":true,"archived":false,"shadow":false}"#
        var catalogReads = 0
        var operations: [String] = []
        private var failures: Int
        private var delayActive: Bool
        private var activeStarted = false
        private var started: CheckedContinuation<Void, Never>?
        private var resume: CheckedContinuation<Void, Never>?
        init(failures: Int = 0, delayActive: Bool = false) { self.failures = failures; self.delayActive = delayActive }
        func waitForActiveRead() async {
            if activeStarted { return }
            await withCheckedContinuation { started = $0 }
        }
        func resumeActiveRead() { resume?.resume(); resume = nil }
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            operations.append(operationID)
            let json: String
            switch operationID {
            case "libraries":
                catalogReads += 1
                if failures > 0 { failures -= 1; throw URLError(.networkConnectionLost) }
                json = """
                {"items":[\(Self.libraryJSON),
                 {"id":"collapsed","name":"Collapsed","language":"en","owned":true,"archived":false,"shadow":false},
                 {"id":"archived","name":"Archive","language":"en","owned":true,"archived":true,"shadow":false}],"nextCursor":null}
                """
            case "ebook":
                json = """
                {"text":{"id":"ebook","libraryId":"active","title":"A book","topics":[],"emoji":null,"createdAt":null,"format":"ebook"},
                 "library":\(Self.libraryJSON),"url":"https://bookmarks.test/book.pdf?token=renewed&v=1","format":"pdf",
                 "expiresAt":"2099-01-01T00:00:00Z","location":"5",
                 "bookmarks":[{"id":42,"quote":"A new highlight","chapter":null,"location":"5","createdAt":null}]}
                """
            case "texts":
                if request.path?.contains("/active/") == true {
                    if delayActive {
                        delayActive = false
                        await withCheckedContinuation { continuation in
                            resume = continuation; activeStarted = true; started?.resume(); started = nil
                        }
                    }
                    json = #"{"items":[{"id":"article","libraryId":"active","title":"Updated article","topics":[],"format":"article"}],"nextCursor":null}"#
                } else if request.path?.contains("/collapsed/") == true {
                    if request.path?.contains("cursor=") == true {
                        json = #"{"items":[{"id":"link","libraryId":"collapsed","title":"A website","topics":[],"format":"bookmark","bookmarkURL":"https://example.com"}],"nextCursor":null}"#
                    } else {
                        json = #"{"items":[{"id":"ebook","libraryId":"collapsed","title":"A book","topics":[],"format":"ebook"}],"nextCursor":"next"}"#
                    }
                } else { throw URLError(.unsupportedURL) }
            default: throw URLError(.unsupportedURL)
            }
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(json))
        }
    }
}
