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
            <meta property="og:image" content="/og.png"><link rel="icon" href="/touch.png">
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
        defer {
            UserDefaults.standard.removeObject(forKey: "browser.recent-web." + namespace)
            UserDefaults.standard.removeObject(forKey: "browser.web-history." + namespace)
        }
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
        for _ in 0..<50 where workspace.recentWebpages.first?.previewImageURL == nil {
            try await Task.sleep(for: .milliseconds(20))
        }
        #expect(workspace.recentWebpages.first?.previewImageURL == server.origin.appending(path: "og.png"))
        #expect(workspace.recentWebpages.first?.faviconURL == server.origin.appending(path: "touch.png"))
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
        #expect(Set(workspace.webVisits.map { $0.page.url }) == [first, second])
        workspace.visit(.home)
        let match = try #require(workspace.addressMatches(second.absoluteString, limit: 5).first)
        await workspace.openAddressMatch(match)
        try await waitForPage(second)
        if case .web(let page) = workspace.current.resource { #expect(page.url == second) }
        else { Issue.record("Selecting a history suggestion must navigate to its webpage") }
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

    @Test func addressHistoryExpiresPersistsAndClearsPerAccount() async throws {
        let namespace = "address-history." + UUID().uuidString
        let key = "browser.web-history." + namespace
        defer { UserDefaults.standard.removeObject(forKey: key) }
        let mobile = client(WorkspaceTransport())
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let workspace = BrowserWorkspaceModel(client: mobile, namespace: namespace, now: now)
        let url = try #require(URL(string: "https://reading.test/forest"))
        let page = RecentWebpage(url: url, title: "Quiet forest")
        workspace.recordWebVisit(page, at: now.addingTimeInterval(-24 * 60 * 60))
        #expect(workspace.addressMatches("forest", limit: 5, now: now).isEmpty)
        workspace.recordWebVisit(page, at: now.addingTimeInterval(-24 * 60 * 60 + 1))
        #expect(workspace.addressMatches("forest", limit: 5, now: now).map(\.title) == ["Quiet forest"])
        #expect(workspace.addressMatches("forest", limit: 5, now: now.addingTimeInterval(1)).isEmpty)
        workspace.recordWebVisit(page, at: now)
        workspace.recordWebVisit(RecentWebpage(url: url, title: "Forest revisited"), at: now)
        #expect(workspace.webVisits.count == 1)
        let restored = BrowserWorkspaceModel(client: mobile, namespace: namespace, now: now)
        #expect(restored.addressMatches("READING.TEST", limit: 5, now: now).map(\.title) == ["Forest revisited"])
        #expect(restored.addressMatches(url.absoluteString, limit: 5, now: now).count == 1)
        #expect(restored.recentWebpages.isEmpty, "Autocomplete history must not change Home's single recent link")
        let expired = BrowserWorkspaceModel(client: mobile, namespace: namespace, now: now.addingTimeInterval(24 * 60 * 60))
        #expect(expired.webVisits.isEmpty)
        let other = BrowserWorkspaceModel(client: mobile, namespace: namespace + ".other", now: now)
        #expect(other.addressMatches("forest", limit: 5, now: now).isEmpty)
        restored.recordWebVisit(page, at: now)
        restored.clearHistory()
        #expect(restored.addressMatches("forest", limit: 5, now: now).isEmpty)
        #expect(UserDefaults.standard.object(forKey: key) == nil)
        #expect(BrowserWorkspaceModel(client: mobile, namespace: namespace, now: now).webVisits.isEmpty)
    }

    @Test func addressMatchesRankExactnessAcrossAssetsAndWebpagesAndDeduplicateLinks() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://workspace.test"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "mixed-address-search")
        let folder = try JSONDecoder().decode(CatalogLibrary.self, from: Data(#"{"id":"active","name":"Reading","language":"en","owned":true,"archived":false,"shadow":false}"#.utf8))
        let rows = try JSONDecoder().decode([CatalogText].self, from: Data(#"[{"id":"exact","libraryId":"active","title":"River","topics":[],"format":"article"},{"id":"prefix","libraryId":"active","title":"River guide","topics":[],"format":"ebook"},{"id":"contains","libraryId":"active","title":"The river","topics":[],"format":"article"},{"id":"bookmark","libraryId":"active","title":"Café","topics":[],"format":"bookmark","bookmarkURL":"https://cafe.test/read"}]"#.utf8))
        await store.save([folder], for: "libraries")
        await store.save(rows, for: "texts/active")
        let mobile = MobileClient(baseURL: origin, transport: OfflineTransport(), token: { _ in "verified" }, localStore: store)
        let namespace = "mixed-address-search." + UUID().uuidString
        defer { UserDefaults.standard.removeObject(forKey: "browser.web-history." + namespace) }
        let workspace = BrowserWorkspaceModel(client: mobile, namespace: namespace)
        await workspace.refresh(online: false)
        let now = Date()
        let exact = RecentWebpage(url: try #require(URL(string: "https://water.test/read")), title: "RIVER")
        let prefix = RecentWebpage(url: try #require(URL(string: "https://guide.test/read")), title: "River map")
        let contains = RecentWebpage(url: try #require(URL(string: "https://stories.test/read")), title: "Our river story")
        workspace.recordWebVisit(exact, at: now)
        workspace.recordWebVisit(prefix, at: now)
        workspace.recordWebVisit(contains, at: now)
        #expect(workspace.addressMatches(" river ", limit: 20, now: now).map(\.title) == ["River", "RIVER", "River map", "River guide", "The river"])
        #expect(workspace.addressMatches("river", limit: 1, now: now).map(\.id) == ["exact"])
        let cafe = RecentWebpage(url: try #require(URL(string: "https://cafe.test/read")), title: "Café")
        workspace.recordWebVisit(cafe, at: now)
        #expect(workspace.addressMatches("cafe", limit: 5, now: now).map(\.id) == ["bookmark"])
        #expect(workspace.addressMatches("https://cafe.test/read", limit: 5, now: now).map(\.title) == ["Café"])
        let host = RecentWebpage(url: try #require(URL(string: "https://river/long/path")), title: "Another page")
        workspace.recordWebVisit(host, at: now)
        #expect(workspace.addressMatches("river", limit: 5, now: now).map(\.title) == ["River", "Another page", "RIVER", "River map", "River guide"])
    }

    @Test func recentWebpageArtworkRestoresAndClearsWithBrowsingData() async throws {
        let namespace = "recent-artwork." + UUID().uuidString
        let key = "browser.recent-web." + namespace
        defer { UserDefaults.standard.removeObject(forKey: key) }
        let url = try #require(URL(string: "https://reading.test/article"))
        let icon = try #require(URL(string: "https://reading.test/icon.png"))
        let artwork = try #require(URL(string: "https://images.test/cover.jpg"))
        let page = RecentWebpage(url: url, title: "Forest", faviconURL: icon, previewImageURL: artwork)
        UserDefaults.standard.set(try JSONEncoder().encode([page]), forKey: key)
        let workspace = BrowserWorkspaceModel(client: client(WorkspaceTransport()), namespace: namespace)
        #expect(workspace.recentWebpages == [page])
        let image = UIGraphicsImageRenderer(size: CGSize(width: 32, height: 32)).image { context in
            UIColor.green.setFill(); context.fill(CGRect(x: 0, y: 0, width: 32, height: 32))
        }
        var requested: [URL] = []
        await workspace.cacheRecentImages { url in requested.append(url); return image }
        #expect(requested == [icon, artwork])
        await workspace.cacheRecentImages { _ in Issue.record("Artwork already in memory must not reload"); return image }
        #expect(workspace.recentImages.count == 2)
        workspace.clearHistory()
        #expect(workspace.recentImages.isEmpty)
        #expect(workspace.recentWebpages.isEmpty)
        #expect(UserDefaults.standard.object(forKey: key) == nil)
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
        #expect(restored.recentLibraryName(for: details.text) == details.library.name)
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
    @Test(arguments: ["article", "ebook"])
    func annotationCompletionUpdatesBookmarksAndPinsAcrossRelaunch(format: String) async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let namespace = "workspace-test." + UUID().uuidString
        let defaults = try #require(UserDefaults(suiteName: namespace))
        defer {
            try? FileManager.default.removeItem(at: root)
            defaults.removePersistentDomain(forName: namespace)
            for prefix in ["browser.annotations.", "browser.recent.", "browser.recent-web.", "recent-access."] {
                UserDefaults.standard.removeObject(forKey: prefix + namespace)
            }
        }
        let origin = try #require(URL(string: "https://workspace.test"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: namespace)
        let transport = WorkspaceTransport(format: format)
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "verified" }, localStore: store)
        let initial = try await client.documentDetails(textID: "article")
        await store.save([initial.library], for: "libraries")
        await store.upsertText(initial.text)
        let workspace = BrowserWorkspaceModel(client: client, namespace: namespace, pinDefaults: defaults)
        await workspace.refresh(online: false)
        await workspace.imported(initial.text, annotating: true)
        var pin = try #require(workspace.currentPin)
        pin.title = "My reading"
        workspace.savePin(pin)
        workspace.visit(.bookmarks)
        await transport.complete()
        await workspace.poll()
        let updated = try #require(workspace.texts["folder"]?.first)
        #expect(updated.emoji == "🌲")
        #expect(updated.topics == ["Nature", "Travel"])
        #expect(workspace.activities.first?.text == updated)
        #expect(workspace.recentTexts.first == updated)
        #expect(workspace.homePins.first?.destination == .document(updated))
        #expect(workspace.homePins.first?.title == "My reading")
        await workspace.refresh(online: false)
        #expect(workspace.texts["folder"]?.first == updated)
        workspace.go(-1)
        #expect(workspace.currentPin?.destination == .document(updated))
        workspace.deletePin(try #require(workspace.homePins.first))
        workspace.savePin(try #require(workspace.currentPin))
        #expect(workspace.homePins.first?.destination == .document(updated))
        let reopened = BrowserWorkspaceModel(client: client, namespace: namespace, pinDefaults: defaults)
        await reopened.refresh(online: false)
        #expect(reopened.texts["folder"]?.first == updated)
        #expect(reopened.activities.first?.text == updated)
        #expect(reopened.homePins.first?.destination == .document(updated))
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
            let topics = completed ? "[\"Nature\",\"Travel\"]" : "[]"
            let emoji = completed ? "\"🌲\"" : "null"
            let json = """
            {"text":{"id":"article","libraryId":"folder","title":"Along the river","topics":\(topics),"emoji":\(emoji),"createdAt":null,"format":"\(format)"},
             "library":{"id":"folder","name":"Reading","language":"en","owned":true,"archived":false,"shadow":false},"annotationProgress":"\(status)",
             "document":{"version":1,"revision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","source":"Along the river.","blocks":[{"id":"block","kind":"paragraph","sourceRange":{"location":0,"length":16},"displayText":"Along the river.","spans":[]}]}}
            """
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(json))
        }
    }
}

@MainActor struct BookmarkRefreshTests {
    @Test func coldStartLoadsOnlyFolderMetadataAndWarmStartsMakeNoCatalogRequests() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://bookmarks.test"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "bootstrap")
        let transport = CatalogRefreshTransport()
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "verified" }, localStore: store)
        let sync = NativeSync(store: store, client: client)
        await sync.loadCatalogIfNeeded()
        await sync.loadCatalogIfNeeded()
        let passes = BackgroundPasses()
        await sync.run(waitForNextPass: { try await passes.next() })
        await sync.run(waitForNextPass: { throw CancellationError() })
        #expect(await passes.count == 4)
        #expect(await transport.operations == ["libraries"])
        #expect(await client.cachedLibraries()?.count == 3)
        #expect(await client.cachedTexts(libraryID: "active") == nil)
        #expect(!sync.catalogFailed)
        await sync.stop()
    }

    private actor BackgroundPasses {
        var count = 0
        func next() throws {
            count += 1
            if count == 4 { throw CancellationError() }
        }
    }

    @Test func failedFirstLoadStopsRetryingAndAnExplicitPullRecovers() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://bookmarks.test"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "bootstrap-recovery")
        let transport = CatalogRefreshTransport(failures: 3)
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "verified" }, localStore: store)
        let sync = NativeSync(store: store, client: client)
        await sync.loadCatalogIfNeeded()
        #expect(sync.catalogFailed)
        #expect(await transport.catalogReads == 3)
        #expect(await sync.refreshBookmarks(prioritizing: []))
        #expect(!sync.catalogFailed)
        #expect(await transport.catalogReads == 4)
        #expect(await transport.operations.allSatisfy { ["libraries", "texts"].contains($0) })
        await sync.stop()
    }

    @Test func openingCachedFoldersUsesNoRequestsAndExplicitRefreshFetchesCurrentContents() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://bookmarks.test"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "cached-folder")
        let cached = try decodeText("old", library: "active", title: "Cached article")
        await store.reconcileTexts([cached], libraryID: "active")
        let transport = CatalogRefreshTransport()
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "verified" }, localStore: store)
        let library = try JSONDecoder().decode(CatalogLibrary.self, from: Data(CatalogRefreshTransport.libraryJSON.utf8))
        let namespace = UUID().uuidString
        defer { UserDefaults.standard.removeObject(forKey: "browser.recent." + namespace) }
        let workspace = BrowserWorkspaceModel(client: client, namespace: namespace)
        await workspace.loadFolder(library, online: true)
        await workspace.loadFolder(library, online: true)
        #expect(workspace.texts["active"] == [cached])
        #expect(await transport.operations.isEmpty)
        await workspace.loadFolder(library, online: true, refresh: true)
        #expect(workspace.texts["active"]?.map(\.title) == ["Updated article"])
        #expect(await transport.operations == ["texts"])
        await workspace.loadFolder(library, online: true)
        #expect(await transport.operations == ["texts"])
        await store.close()
    }

    @Test func aLocalImportDoesNotPreventFetchingTheRestOfAFolder() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://bookmarks.test"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "partial-folder")
        await store.upsertText(try decodeText("local", library: "active", title: "Just imported"))
        let transport = CatalogRefreshTransport()
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "verified" }, localStore: store)
        let library = try JSONDecoder().decode(CatalogLibrary.self, from: Data(CatalogRefreshTransport.libraryJSON.utf8))
        let namespace = UUID().uuidString
        defer { UserDefaults.standard.removeObject(forKey: "browser.recent." + namespace) }
        let workspace = BrowserWorkspaceModel(client: client, namespace: namespace)
        await workspace.loadFolder(library, online: true)
        #expect(workspace.texts["active"]?.map(\.id) == ["article"])
        #expect(await transport.operations == ["texts"])
        await store.close()
    }

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
                 "bookmarks":[{"id":42,"quote":"A new highlight","chapter":null,"location":"5","createdAt":null,"color":"sage"}]}
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

@MainActor struct ReviewLoadingTests {
    private func model(_ transport: LoadingTransport, store: LocalReadingStore? = nil) -> ReviewModel {
        ReviewModel(client: MobileClient(baseURL: URL(string: "https://review.test")!, transport: transport, token: { _ in "verified" }, localStore: store),
                    selection: ReviewSelection(date: "2026-10-12", language: "en"))
    }

    @Test func repeatedFailuresRecoverWithoutAbandoningTheReview() async {
        let transport = LoadingTransport(mode: .failure)
        let review = model(transport)
        review.drafts["translation-0"] = "My answer"
        await review.observe(pause: { _ in
            if await transport.reads == 4 { await transport.setMode(.complete) }
            if await transport.reads == 5 { throw CancellationError() }
        })
        #expect(await transport.reads == 5)
        #expect(review.snapshot?.translations?.first?.keyword == "hello")
        #expect(review.drafts["translation-0"] == "My answer")
        #expect(review.error == nil)
    }

    @Test func cachedExercisesRemainAvailableDuringRepeatedFailures() async {
        let transport = LoadingTransport(mode: .complete)
        let review = model(transport)
        await review.observe(pause: { _ in throw CancellationError() })
        await transport.setMode(.failure)
        await review.observe(pause: { _ in
            if await transport.reads >= 5 { throw CancellationError() }
        })
        #expect(review.snapshot?.translations?.first?.keyword == "hello")
        #expect(review.error == nil)
    }

    @Test func transientReadFailureRecoversWithoutNotifying() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://review.test"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        let transport = LoadingTransport(mode: .transient)
        let review = model(transport, store: store)
        await review.observe(pause: { _ in
            if await transport.reads >= 2 { throw CancellationError() }
        })
        #expect(review.error == nil)
        #expect(review.snapshot?.translations?.first?.keyword == "hello")
    }

    @Test func vanishedGenerationIsStartedAgainAndBecomesUsable() async {
        let transport = LoadingTransport(mode: .vanished)
        let review = model(transport)
        await review.observe(pause: { _ in
            if await transport.reads >= 3 { throw CancellationError() }
        })
        #expect(await transport.starts == 2)
        #expect(review.snapshot?.translations?.first?.keyword == "hello")
        #expect(review.error == nil)
    }

    @Test func delayedGenerationStillArrivesAfterNinetyPolls() async {
        let transport = LoadingTransport(mode: .stalled)
        let review = model(transport)
        await review.observe(pause: { _ in
            if await transport.reads == 90 { await transport.setMode(.complete) }
            if await transport.reads == 91 { throw CancellationError() }
        })
        #expect(await transport.reads == 91)
        #expect(review.snapshot?.translations?.first?.keyword == "hello")
        #expect(review.error == nil)
    }

    @Test func partialExercisesAreAvailableBeforeGenerationCompletes() async {
        let transport = LoadingTransport(mode: .partial)
        let review = model(transport)
        await review.observe(pause: { _ in throw CancellationError() })
        #expect(review.snapshot?.exists == false)
        #expect(review.snapshot?.translations?.first?.keyword == "hello")
        #expect(review.error == nil)
    }

    private actor LoadingTransport: ClientTransport {
        enum Mode { case failure, transient, complete, vanished, stalled, partial }
        var mode: Mode
        private(set) var reads = 0
        private(set) var starts = 0
        init(mode: Mode) { self.mode = mode }
        func setMode(_ mode: Mode) { self.mode = mode }
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            if request.method == .post {
                starts += 1
                return (HTTPResponse(status: .ok), HTTPBody(#"{"success":true}"#))
            }
            reads += 1
            if mode == .failure || (mode == .transient && reads == 1) { throw URLError(.networkConnectionLost) }
            if mode == .stalled {
                return (HTTPResponse(status: .ok), HTTPBody(#"{"exists":false,"inProgress":true}"#))
            }
            if mode == .vanished && reads < 3 {
                return (HTTPResponse(status: .ok), HTTPBody(#"{"exists":false,"inProgress":false}"#))
            }
            let complete = mode == .partial ? "false" : "true"
            return (HTTPResponse(status: .ok), HTTPBody("""
                {"exists":\(complete),"inProgress":\(mode == .partial),"translations":[{"prompt":"翻译","answer":"Hello","keyword":"hello","status":"idle"}]}
                """))
        }
    }
}


@MainActor struct HomePinWorkspaceSyncTests {
    private let suiteName = "home-pin-test." + UUID().uuidString
    private var pinDefaults: UserDefaults { UserDefaults(suiteName: suiteName)! }
    private let origin = URL(string: "https://pins.test")!
    private func client(_ server: PinTransport, account: String = "reader") -> MobileClient {
        MobileClient(baseURL: origin, transport: server, token: { _ in account })
    }
    private func clean(_ namespaces: [String]) {
        pinDefaults.removePersistentDomain(forName: suiteName)
    }
    private func pin(_ title: String = "Reading") -> BrowserHomePin {
        BrowserHomePin(id: UUID(), title: title, destination: .webpage(URL(string: "https://example.com/article")!))
    }
    @Test func guestPinsMoveImmediatelyOfflineAndNeverLeakToTheNextAccount() async throws {
        let suite = "pin-handoff." + UUID().uuidString
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let server = PinTransport()
        let guest = BrowserWorkspaceModel(client: client(server), namespace: "local-guest", localOnly: true, pinDefaults: defaults)
        let original = pin("Before login"); guest.savePin(original)
        let account = BrowserWorkspaceModel(client: client(server), namespace: "A", pinDefaults: defaults)
        #expect(account.homePins == [original])
        #expect(await server.calls == 0)
        await server.setOffline(true); await account.syncPins()
        let reopened = BrowserWorkspaceModel(client: client(server), namespace: "A", pinDefaults: defaults)
        #expect(reopened.homePins == [original])
        guest.savePin(pin("Late guest callback"))
        let signedOut = BrowserWorkspaceModel(client: client(server), namespace: "local-guest", localOnly: true, pinDefaults: defaults)
        #expect(signedOut.homePins.isEmpty)
        let other = BrowserWorkspaceModel(client: client(server, account: "other"), namespace: "B", pinDefaults: defaults)
        #expect(other.homePins.isEmpty)
        await server.setOffline(false); await reopened.syncPins()
        #expect(await server.rowsForReader.map(\.title) == ["Before login"])
    }
    @Test func guestHandoffUsesCloudNamesAndAppendsOnlyNewDestinations() async throws {
        let suite = "pin-handoff." + UUID().uuidString
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let server = PinTransport()
        let cloud = BrowserWorkspaceModel(client: client(server), namespace: "other-device", pinDefaults: defaults)
        cloud.savePin(pin("Account name")); await cloud.syncPins()
        let guest = BrowserWorkspaceModel(client: client(server), namespace: "local-guest", localOnly: true, pinDefaults: defaults)
        guest.savePin(pin("Guest duplicate"))
        let added = BrowserHomePin(id: UUID(), title: "New guest pin", destination: .webpage(URL(string: "https://new.test/")!))
        guest.savePin(added)
        let account = BrowserWorkspaceModel(client: client(server), namespace: "A", pinDefaults: defaults)
        await account.syncPins()
        #expect(account.homePins.map(\.title) == ["Account name", "New guest pin"])
        #expect(await server.rowCount == 2)
        let reopened = BrowserWorkspaceModel(client: client(server), namespace: "A", pinDefaults: defaults)
        await reopened.syncPins()
        #expect(reopened.homePins.map(\.title) == ["Account name", "New guest pin"])
        #expect(await server.rowCount == 2)
    }
    @Test func savingTheSameDestinationTwiceUpdatesOneShortcut() async throws {
        let namespace = UUID().uuidString; defer { clean([namespace]) }
        let server = PinTransport()
        let workspace = BrowserWorkspaceModel(client: client(server), namespace: namespace, pinDefaults: pinDefaults)
        workspace.savePin(pin("First")); workspace.savePin(pin("Updated"))
        #expect(workspace.homePins.map(\.title) == ["Updated"])
        await workspace.syncPins()
        #expect(await server.rowCount == 1)
    }
    @Test func legacyPinsUploadOnceAndAnotherDeviceReceivesEditsAndDeletions() async throws {
        let namespaces = [UUID().uuidString, UUID().uuidString]
        defer { clean(namespaces) }
        let original = pin()
        pinDefaults.set(try JSONEncoder().encode([original]), forKey: "browser.home-pins." + namespaces[0])
        let server = PinTransport()
        let first = BrowserWorkspaceModel(client: client(server), namespace: namespaces[0], pinDefaults: pinDefaults)
        #expect(first.homePins == [original])
        await first.syncPins()
        let second = BrowserWorkspaceModel(client: client(server), namespace: namespaces[1], pinDefaults: pinDefaults)
        await second.syncPins()
        #expect(second.homePins == [original])
        var renamed = original; renamed.title = "Daily reading"
        second.savePin(renamed)
        await second.syncPins()
        await first.syncPins()
        #expect(first.homePins == [renamed])
        first.deletePin(renamed)
        await first.syncPins()
        await second.syncPins()
        #expect(second.homePins.isEmpty)
        #expect(await server.rowCount == 1)
        #expect(await server.saveCount == 3)
    }
    @Test func offlineEditsSurviveRestartAndALostSaveResponse() async throws {
        let namespace = UUID().uuidString
        defer { clean([namespace]) }
        let server = PinTransport()
        let first = BrowserWorkspaceModel(client: client(server), namespace: namespace, pinDefaults: pinDefaults)
        let original = pin()
        first.savePin(original)
        await server.setOffline(true)
        await first.syncPins()
        #expect(first.homePins == [original])
        #expect(first.error == nil)
        let reopened = BrowserWorkspaceModel(client: client(server), namespace: namespace, pinDefaults: pinDefaults)
        #expect(reopened.homePins == [original])
        await server.setOffline(false)
        await server.loseNextSaveResponse()
        await reopened.syncPins()
        #expect(reopened.homePins == [original])
        #expect(reopened.error == nil)
        #expect(await server.rowCount == 1)
        let acknowledged = try #require(await server.rowsForReader.first)
        await reopened.syncPins()
        #expect(await server.rowsForReader.first?.revision == acknowledged.revision)
        #expect(await server.saveCount == 2)
    }
    @Test func remoteDeletionWinsOverADisconnectedDevicesRename() async throws {
        let namespaces = [UUID().uuidString, UUID().uuidString]
        defer { clean(namespaces) }
        let server = PinTransport()
        let first = BrowserWorkspaceModel(client: client(server), namespace: namespaces[0], pinDefaults: pinDefaults)
        let original = pin()
        first.savePin(original)
        await first.syncPins()
        let second = BrowserWorkspaceModel(client: client(server), namespace: namespaces[1], pinDefaults: pinDefaults)
        await second.syncPins()
        var renamed = original; renamed.title = "Offline edit"
        second.savePin(renamed)
        first.deletePin(original)
        await first.syncPins()
        await second.syncPins()
        #expect(second.homePins.isEmpty)
        #expect(await server.saveCount == 2)
    }
    @Test func accountsAreIsolatedAndGuestsNeverSendPinRequests() async throws {
        let namespaces = [UUID().uuidString, UUID().uuidString, UUID().uuidString]
        defer { clean(namespaces) }
        let server = PinTransport()
        let first = BrowserWorkspaceModel(client: client(server), namespace: namespaces[0], pinDefaults: pinDefaults)
        first.savePin(pin())
        await first.syncPins()
        let other = BrowserWorkspaceModel(client: client(server, account: "other"), namespace: namespaces[1], pinDefaults: pinDefaults)
        await other.syncPins()
        #expect(other.homePins.isEmpty)
        let guest = BrowserWorkspaceModel(client: client(server), namespace: namespaces[2], localOnly: true, pinDefaults: pinDefaults)
        let calls = await server.calls
        guest.savePin(pin("Local shortcut"))
        await guest.syncPins()
        #expect(await server.calls == calls)
        #expect(guest.homePins.count == 1)
    }
    @Test func deletingContentAlsoDeletesItsCloudPin() async throws {
        let namespace = UUID().uuidString
        defer { clean([namespace]) }
        let server = PinTransport()
        let workspace = BrowserWorkspaceModel(client: client(server), namespace: namespace, pinDefaults: pinDefaults)
        let text = try JSONDecoder().decode(CatalogText.self, from: Data(#"{"id":"article","libraryId":"library","title":"Article","topics":[],"emoji":null,"createdAt":null,"format":"article"}"#.utf8))
        let original = BrowserHomePin(id: UUID(), title: text.title, destination: .document(text))
        workspace.savePin(original)
        await workspace.syncPins()
        workspace.contentRemoved(text)
        await workspace.syncPins()
        #expect(workspace.homePins.isEmpty)
        #expect(await server.rowsForReader.first?.deletedAt != nil)
        let reopened = BrowserWorkspaceModel(client: client(server), namespace: namespace, pinDefaults: pinDefaults)
        await reopened.syncPins()
        #expect(reopened.homePins.isEmpty)
    }
    @Test(arguments: [false, true]) func renamingContentUpdatesItsCloudSnapshotAndPreservesCustomPinTitles(customTitle: Bool) async throws {
        let namespace = UUID().uuidString
        defer { clean([namespace]) }
        let server = PinTransport()
        let workspace = BrowserWorkspaceModel(client: client(server), namespace: namespace, pinDefaults: pinDefaults)
        func text(_ title: String) throws -> CatalogText {
            try JSONDecoder().decode(CatalogText.self, from: JSONSerialization.data(withJSONObject: ["id":"article", "libraryId":"library", "title":title, "topics":[], "emoji":NSNull(), "createdAt":NSNull(), "format":"article"]))
        }
        let original = try text("Original title")
        let automatic = BrowserHomePin(id: UUID(), title: original.title, destination: .document(original))
        let custom = BrowserHomePin(id: UUID(), title: "My shortcut", destination: .document(original))
        workspace.savePin(customTitle ? custom : automatic)
        await workspace.syncPins()
        await workspace.contentChanged(try text("Updated title"), reloadReader: false)
        await workspace.syncPins()
        let rows = await server.rowsForReader
        #expect(rows.map(\.title) == [customTitle ? "My shortcut" : "Updated title"])
        for row in rows {
            if case .document(let snapshot) = row.destination { #expect(snapshot.title == "Updated title") }
            else { Issue.record("Document shortcut changed its destination kind") }
        }
    }
    @Test func oneRejectedLegacyPinDoesNotBlockOtherEditsOrDisappearLocally() async {
        let namespace = UUID().uuidString
        defer { clean([namespace]) }
        let server = PinTransport()
        let workspace = BrowserWorkspaceModel(client: client(server), namespace: namespace, pinDefaults: pinDefaults)
        let long = pin(String(repeating: "x", count: 257))
        let valid = BrowserHomePin(id: UUID(), title: "Daily reading", destination: .webpage(URL(string: "https://other.test/")!))
        workspace.savePin(long)
        workspace.savePin(valid)
        await workspace.syncPins()
        #expect(workspace.homePins == [long, valid])
        #expect(await server.rowsForReader.map(\.title) == ["Daily reading"])
        #expect(workspace.error == nil)
    }
    @Test func cancelledCloudResponseCannotRecreatePurgedAccountData() async throws {
        let namespace = UUID().uuidString
        defer { clean([namespace]) }
        let server = PinTransport()
        let workspace = BrowserWorkspaceModel(client: client(server), namespace: namespace, pinDefaults: pinDefaults)
        workspace.savePin(pin())
        await workspace.syncPins()
        await server.pauseNextRead()
        let task = Task { await workspace.syncPins() }
        for _ in 0..<1000 {
            if await server.readIsPaused { break }
            await Task.yield()
        }
        #expect(await server.readIsPaused)
        task.cancel()
        clean([namespace])
        await server.resumeRead()
        await task.value
        #expect(!pinDefaults.dictionaryRepresentation().keys.contains { $0.hasSuffix("." + namespace) })
    }

    private actor PinTransport: ClientTransport {
        private var rows: [String: [String: HomePin]] = [:]
        private var offline = false
        private var loseResponse = false
        private var pauseRead = false
        private var paused: CheckedContinuation<Void, Never>?
        private(set) var calls = 0
        private(set) var saveCount = 0
        var rowCount: Int { rows.values.reduce(0) { $0 + $1.count } }
        var rowsForReader: [HomePin] { Array(rows["reader", default: [:]].values) }
        var readIsPaused: Bool { paused != nil }
        func setOffline(_ value: Bool) { offline = value }
        func loseNextSaveResponse() { loseResponse = true }
        func pauseNextRead() { pauseRead = true }
        func resumeRead() { paused?.resume(); paused = nil }
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            calls += 1
            if offline { throw URLError(.notConnectedToInternet) }
            let account = String((request.headerFields[.authorization] ?? "").dropFirst("Bearer ".count))
            let result: Data
            switch operationID {
            case "homePins":
                let page = CatalogPageForPins(items: Array(rows[account, default: [:]].values))
                result = try JSONEncoder().encode(page)
                if pauseRead { pauseRead = false; await withCheckedContinuation { paused = $0 } }
            case "saveHomePin":
                saveCount += 1
                let data = try await Data(collecting: #require(body), upTo: 32768)
                var object = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
                // The generated SDK moves the ID to the path and omits absent nullable fields.
                #expect(object["id"] == nil)
                let id = try #require(request.path?.split(separator: "/").last).description
                object["id"] = id
                let change = try JSONDecoder().decode(HomePinMutation.self, from: JSONSerialization.data(withJSONObject: object))
                if change.title.utf16.count > 256 {
                    return (HTTPResponse(status: .badRequest, headerFields: [.contentType: "application/json"]), HTTPBody(#"{"error":{"code":"invalid_input","message":"Invalid pin","retryable":false}}"#))
                }
                var saved = change.pin
                saved.updatedAt = Date(timeIntervalSince1970: 1_793_577_600 + Double(saveCount)).formatted(.iso8601)
                if change.deleted { saved.deletedAt = saved.updatedAt }
                if let existing = rows[account]?[id], existing.revision != change.expectedRevision || existing.deletedAt != nil { saved = existing }
                rows[account, default: [:]][id] = saved
                if loseResponse { loseResponse = false; throw URLError(.networkConnectionLost) }
                result = try JSONEncoder().encode(saved)
            default: throw URLError(.unsupportedURL)
            }
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(result))
        }
    }
    private struct CatalogPageForPins: Encodable {
        let items: [HomePin]
        func encode(to encoder: any Encoder) throws {
            var c = encoder.container(keyedBy: Keys.self)
            try c.encode(items, forKey: .items); try c.encodeNil(forKey: .nextCursor)
        }
        enum Keys: String, CodingKey { case items, nextCursor }
    }
}
