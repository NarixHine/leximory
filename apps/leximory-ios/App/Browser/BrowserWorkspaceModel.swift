import SwiftUI
import WebKit
import LeximoryCore

struct WebResource {
    let url: URL
    var bookmarkID: String?
    var item: WKBackForwardListItem?
    var offset: CGFloat = 0
}

struct RecentWebpage: Codable, Equatable {
    let url: URL
    let title: String
    var bookmarkID: String? = nil
}

enum BrowserResource {
    case home, bookmarks, account, vocabulary, review
    case web(WebResource)
    case document(RemoteDocument)
}

struct BrowserEntry: Identifiable {
    let id = UUID()
    var resource: BrowserResource
    @MainActor var title: String {
        switch resource {
        case .home: "Leximory"
        case .bookmarks: "我的书签"
        case .account: "账号"
        case .vocabulary: "已存词汇"
        case .review: "每日复习"
        case .web(let page): page.item?.title ?? page.url.host ?? "网页"
        case .document(let document): document.text.title
        }
    }
    var symbol: String {
        switch resource {
        case .home: "house"
        case .bookmarks: "bookmark"
        case .account: "person.crop.circle"
        case .vocabulary: "character.book.closed"
        case .review: "leaf"
        case .web: "globe"
        case .document(let document): document.text.format == "ebook" ? "book.closed" : "doc.text"
        }
    }
    var textID: String? { if case .document(let document) = resource { document.text.id } else { nil } }
    var isWeb: Bool { if case .web = resource { true } else { false } }
}

enum AnnotationActivityState: String, Codable { case pending, ready, failed }
struct AnnotationActivity: Identifiable, Codable {
    let text: CatalogText
    var state: AnnotationActivityState
    var seen = false
    var id: String { text.id }
}

@MainActor @Observable final class BrowserWorkspaceModel {
    let client: MobileClient
    private(set) var browser = TextBrowserModel()
    private(set) var recentWebpage: RecentWebpage?
    private(set) var history = ResourceHistory(home: BrowserEntry(resource: .home))
    private(set) var libraries: [CatalogLibrary] = []
    private(set) var texts: [String: [CatalogText]] = [:]
    private(set) var activities: [AnnotationActivity] = []
    private(set) var documents: [String: RemoteDocument] = [:]
    private(set) var recentlyOpened: [String: FixtureArticle] = [:]
    var expandedFolders: Set<String> = []
    var error: String?
    var loading = true
    var opening = false
    var completionID: String?
    var revision = 0
    var ebookReader: EbookReaderState?
    var ebookTextID: String?
    @ObservationIgnored private var restoringWeb = false
    @ObservationIgnored private var openRequest = UUID()
    @ObservationIgnored private let namespace: String
    @ObservationIgnored private var pollAttempts: [String: Int] = [:]
    @ObservationIgnored private var catalogRequest = UUID()
    @ObservationIgnored private var catalogMutation = 0
    @ObservationIgnored private var folderRequests: [String: UUID] = [:]
    var current: BrowserEntry { history.current }
    var currentTitle: String {
        if let id = current.textID { return documents[id]?.text.title ?? current.title }
        if case .web(let page) = current.resource, page.item != nil, browser.url == page.url, !browser.title.isEmpty { return browser.title }
        return current.title
    }
    var readyCount: Int { activities.filter { $0.state == .ready && !$0.seen }.count }
    var hasPending: Bool { activities.contains { $0.state == .pending } }
    var writableFolders: [CatalogLibrary] { libraries.filter { $0.owned && !$0.shadow } }
    var recentText: CatalogText? {
        recentTexts.first
    }
    var recentTexts: [CatalogText] {
        let all = Array(texts.values.joined())
        let latest = UserDefaults.standard.string(forKey: "browser.recent." + namespace)
        let ids = [latest].compactMap { $0 } + libraries.compactMap { recentlyOpened[$0.id]?.id.rawValue }
        var seen = Set<String>()
        return ids.compactMap { id in
            guard seen.insert(id).inserted else { return nil }
            return all.first { $0.id == id }
        }
    }
    init(client: MobileClient, namespace: String) {
        self.client = client; self.namespace = namespace
        if let data = UserDefaults.standard.data(forKey: "browser.recent-web." + namespace),
           let page = try? JSONDecoder().decode(RecentWebpage.self, from: data),
           TextBrowserModel.address(page.url.absoluteString) != nil { recentWebpage = page }
        if let data = UserDefaults.standard.data(forKey: "recent-access." + namespace),
           let saved = try? JSONDecoder().decode([String: FixtureArticle].self, from: data) { recentlyOpened = saved }
        if let data = UserDefaults.standard.data(forKey: "browser.annotations." + namespace),
           let saved = try? JSONDecoder().decode([AnnotationActivity].self, from: data) { activities = saved }
        connectBrowser()
    }
    private func connectBrowser() {
        browser.committed = { [weak self] item in self?.committed(item) }
        browser.historyGesture = { [weak self] url in self?.handleWebGesture(url) ?? false }
        browser.navigationBegan = { [weak self] in
            guard let self, !restoringWeb else { return }
            rememberWebPosition()
        }
    }
    func visit(_ resource: BrowserResource, rememberingWebPosition: Bool = true) {
        openRequest = UUID(); opening = false
        if rememberingWebPosition { rememberWebPosition() }
        history.visit(BrowserEntry(resource: resource))
        rememberCurrentWebpage()
        error = nil
    }
    func go(_ distance: Int, rememberingWebPosition: Bool = true) {
        if rememberingWebPosition { rememberWebPosition() }
        guard history.go(distance) else { return }
        openRequest = UUID(); opening = false; error = nil
        if case .web(let page) = current.resource {
            restoringWeb = true
            if let item = page.item, browser.web.backForwardList.currentItem !== item {
                if browser.web.go(to: item) == nil { browser.load(page.url, offset: page.offset) }
            }
            else if browser.url != page.url { browser.load(page.url, offset: page.offset) }
            else { restoringWeb = false; browser.web.scrollView.setContentOffset(CGPoint(x: 0, y: page.offset), animated: false) }
        }
        rememberCurrentWebpage()
        acknowledgeCurrent()
    }
    func openURL(_ url: URL, bookmarkID: String? = nil) {
        visit(.web(WebResource(url: url, bookmarkID: bookmarkID)))
        restoringWeb = true
        browser.load(url)
    }
    private func committed(_ item: WKBackForwardListItem) {
        guard current.isWeb else { return }
        if restoringWeb {
            restoringWeb = false
            if case .web(var page) = current.resource {
                page = WebResource(url: item.url, bookmarkID: page.bookmarkID, item: item, offset: page.offset)
                var entry = current; entry.resource = .web(page); history.replaceCurrent(entry)
                rememberCurrentWebpage()
            }
            return
        }
        if case .web(let page) = current.resource, page.item === item { return }
        if let index = history.entries.firstIndex(where: { entry in
            if case .web(let page) = entry.resource { return page.item === item }; return false
        }) { go(index - history.index, rememberingWebPosition: false); return }
        visit(.web(WebResource(url: item.url, item: item)), rememberingWebPosition: false)
    }
    func rememberCurrentWebpage() {
        guard case .web(let page) = current.resource, let item = page.item else { return }
        let title = browser.url == page.url && !browser.title.isEmpty ? browser.title : item.title ?? page.url.host ?? "网页"
        let recent = RecentWebpage(url: page.url, title: title, bookmarkID: page.bookmarkID)
        guard recent != recentWebpage else { return }
        recentWebpage = recent
        if let data = try? JSONEncoder().encode(recent) { UserDefaults.standard.set(data, forKey: "browser.recent-web." + namespace) }
    }
    private func handleWebGesture(_ url: URL) -> Bool {
        guard !restoringWeb else { return false }
        let distance = browser.web.backForwardList.backItem?.url == url ? -1 : 1
        let index = history.index + distance
        guard history.entries.indices.contains(index) else { return true }
        if case .web(let page) = history.entries[index].resource, page.url == url { return false }
        go(distance)
        return true
    }
    private func rememberWebPosition() {
        guard case .web(var page) = current.resource else { return }
        page.offset = browser.web.scrollView.contentOffset.y
        var entry = current; entry.resource = .web(page); history.replaceCurrent(entry)
    }
    func open(_ text: CatalogText) async {
        let request = UUID(); openRequest = request; opening = true; error = nil
        defer { if openRequest == request { opening = false } }
        do {
            let details: RemoteDocument
            if let cached = await client.cachedDocument(textID: text.id) { details = cached }
            else { details = try await client.documentDetails(textID: text.id) }
            guard openRequest == request, !Task.isCancelled else { return }
            documents[text.id] = details
            if details.text.format == "bookmark", let url = details.text.bookmarkURL.flatMap(TextBrowserModel.address) {
                openURL(url, bookmarkID: text.id)
            } else { visit(.document(details)) }
            UserDefaults.standard.set(text.id, forKey: "browser.recent." + namespace)
            recentlyOpened[details.library.id] = details.text.preview
            if let data = try? JSONEncoder().encode(recentlyOpened) { UserDefaults.standard.set(data, forKey: "recent-access." + namespace) }
            track(details)
            acknowledge(text.id)
        } catch {
            guard openRequest == request, !Task.isCancelled else { return }
            self.error = "暂时无法打开，请稍后重试。"
        }
    }
    func imported(_ text: CatalogText, annotating: Bool) async {
        folderRequests[text.libraryId] = UUID()
        texts[text.libraryId, default: []].removeAll { $0.id == text.id }
        texts[text.libraryId, default: []].insert(text, at: 0)
        if annotating {
            activities.removeAll { $0.id == text.id }
            activities.insert(AnnotationActivity(text: text, state: .pending), at: 0)
            persistActivities()
        }
        await open(text)
        revision += 1
    }
    func refresh(online: Bool) async {
        let request = UUID(); catalogRequest = request
        let mutation = catalogMutation
        if let cached = await client.localStore?.value([CatalogLibrary].self, for: "libraries"), catalogRequest == request, catalogMutation == mutation, !Task.isCancelled { libraries = cached; loading = false }
        guard catalogRequest == request, catalogMutation == mutation, !Task.isCancelled else { return }
        if online {
            do {
                let result = try await client.allLibraries()
                guard catalogRequest == request, catalogMutation == mutation, !Task.isCancelled else { return }
                libraries = result
            }
            catch { if !Task.isCancelled, libraries.isEmpty { self.error = "暂时无法打开文件夹，请稍后重试。" } }
        }
        for library in libraries {
            guard catalogRequest == request, !Task.isCancelled else { return }
            if let cached = await client.localStore?.value([CatalogText].self, for: "texts/\(library.id)") { texts[library.id] = cached }
            for text in texts[library.id] ?? [] where text.format == "article" {
                if let details = await client.cachedDocument(textID: text.id) { documents[text.id] = details; track(details) }
            }
        }
        loading = false
    }
    func loadFolder(_ library: CatalogLibrary, online: Bool) async {
        let request = UUID(); folderRequests[library.id] = request
        if let cached = await client.localStore?.value([CatalogText].self, for: "texts/\(library.id)"), folderRequests[library.id] == request, !Task.isCancelled { texts[library.id] = cached }
        guard online, folderRequests[library.id] == request, !Task.isCancelled else { return }
        do {
            let result = try await client.allTexts(libraryID: library.id)
            guard folderRequests[library.id] == request, !Task.isCancelled else { return }
            texts[library.id] = result
        }
        catch {
            guard folderRequests[library.id] == request, !Task.isCancelled else { return }
            if MobileClient.isAccessFailure(error) { texts[library.id] = [] }
            self.error = "文件夹暂时无法打开，请重试。"
        }
    }
    func setArchived(_ library: CatalogLibrary) async {
        do {
            try await client.setLibraryArchived(libraryID: library.id, archived: !library.archived)
            catalogMutation += 1
            if let index = libraries.firstIndex(where: { $0.id == library.id }) { libraries[index].archived.toggle() }
        } catch { self.error = "文件夹未能更新，请重试。" }
    }
    func upsertFolder(_ library: CatalogLibrary) {
        catalogMutation += 1
        if let index = libraries.firstIndex(where: { $0.id == library.id }) { libraries[index] = library }
        else { libraries.append(library) }
    }
    func poll() async {
        for activity in activities where activity.state == .pending {
            guard !Task.isCancelled else { return }
            do {
                let details = try await client.documentDetails(textID: activity.id)
                documents[activity.id] = details
                track(details)
                pollAttempts[activity.id, default: 0] += 1
                if pollAttempts[activity.id, default: 0] >= 150, let index = activities.firstIndex(where: { $0.id == activity.id && $0.state == .pending }) {
                    activities[index].state = .failed
                }
                revision += 1
            } catch {
                guard !Task.isCancelled else { return }
                if let index = activities.firstIndex(where: { $0.id == activity.id }) { activities[index].state = .failed }
            }
        }
        persistActivities()
    }
    private func track(_ details: RemoteDocument) {
        let pending = ["annotating", "saving"].contains(details.annotationProgress ?? "")
        if let index = activities.firstIndex(where: { $0.id == details.text.id }) {
            if pending { activities[index].state = .pending }
            else if details.annotationProgress == "completed" || details.document.map({ ReaderLayout(document: $0).annotations(textID: TextID(rawValue: details.text.id), revision: $0.revision).isEmpty == false }) == true {
                if activities[index].state != .ready {
                    activities[index].state = .ready
                    if current.textID == details.text.id { completionID = details.text.id; activities[index].seen = true }
                }
            }
        } else if pending { activities.insert(AnnotationActivity(text: details.text, state: .pending), at: 0) }
        persistActivities()
    }
    func retry(_ id: String) {
        if let index = activities.firstIndex(where: { $0.id == id }) { activities[index].state = .pending; pollAttempts[id] = 0; persistActivities() }
    }
    private func acknowledgeCurrent() { if let id = current.textID { acknowledge(id) } }
    private func acknowledge(_ id: String) {
        if let index = activities.firstIndex(where: { $0.id == id && $0.state == .ready }) { activities[index].seen = true; persistActivities() }
    }
    private func persistActivities() {
        if let data = try? JSONEncoder().encode(activities) { UserDefaults.standard.set(data, forKey: "browser.annotations." + namespace) }
    }
    func clearHistory() {
        browser.web.stopLoading()
        browser.web.lookup = nil
        browser = TextBrowserModel()
        connectBrowser()
        history.reset(to: BrowserEntry(resource: .home))
        recentWebpage = nil
        UserDefaults.standard.removeObject(forKey: "browser.recent-web." + namespace)
        restoringWeb = false
    }
}

extension EnvironmentValues {
    @Entry var browserWorkspace: BrowserWorkspaceModel? = nil
    @Entry var browserChromeHeight: CGFloat = 0
    @Entry var browserResourceActive = true
}
