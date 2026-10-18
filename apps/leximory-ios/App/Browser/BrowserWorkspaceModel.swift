import SwiftUI
import WebKit
import LeximoryCore

struct WebResource {
    let url: URL
    var bookmarkID: String?
    var item: WKBackForwardListItem?
    var offset: CGFloat = 0
}

private struct RecentReading: Codable {
    var ids: [String] = []
    var texts: [CatalogText] = []
}

struct HiddenHomeRecents: Codable {
    var textIDs: Set<String> = []
    var webpageURLs: Set<URL> = []
}

struct RecentWebpage: Codable, Equatable, Identifiable {
    let url: URL
    var title: String? = nil
    var bookmarkID: String? = nil
    var id: URL { url }
    var displayTitle: String { Self.normalizedTitle(title) ?? "网页" }
    static func normalizedTitle(_ title: String?) -> String? {
        guard let title = title?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty else { return nil }
        return title
    }
}

struct BrowserHomePin: Codable, Equatable, Identifiable {
    enum Destination: Codable, Equatable {
        case webpage(URL, bookmarkID: String? = nil)
        case document(CatalogText)
    }
    let id: UUID
    var title: String
    var destination: Destination
    var faviconURL: URL? = nil
    var faviconData: Data? = nil
    var iconURL: URL? {
        guard case .webpage(let url, _) = destination else { return nil }
        if let faviconURL { return faviconURL }
        var origin = URLComponents(url: url, resolvingAgainstBaseURL: false)
        origin?.path = "/favicon.ico"
        origin?.query = nil
        origin?.fragment = nil
        return origin?.url
    }
    var symbol: String {
        switch destination {
        case .webpage: "globe"
        case .document(let text): text.format == "ebook" ? "book.closed" : "doc.text"
        }
    }
}

enum BrowserResource {
    case home, bookmarks, account, vocabulary, review
    case reviewSession(ReviewModel)
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
        case .reviewSession(let model): "\(learningLanguageName(model.selection.language)) 每日复习"
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
        case .review, .reviewSession: "leaf"
        case .web: "globe"
        case .document(let document): document.text.format == "ebook" ? "book.closed" : "doc.text"
        }
    }
    var textID: String? { if case .document(let document) = resource { document.text.id } else { nil } }
    var isReviewLawn: Bool { if case .reviewSession = resource { true } else { false } }
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
    static let maximumAddressMatches = 5
    let client: MobileClient
    private(set) var browser = TextBrowserModel()
    private(set) var homePins: [BrowserHomePin] = []
    private(set) var pinImages: [URL: UIImage] = [:]
    private(set) var hiddenHomeRecents = HiddenHomeRecents()
    private(set) var recentWebpages: [RecentWebpage] = []
    private var recentReading = RecentReading()
    private(set) var history = ResourceHistory(home: BrowserEntry(resource: .home))
    private(set) var libraries: [CatalogLibrary] = []
    private(set) var texts: [String: [CatalogText]] = [:]
    var folderFailures: Set<String> = []
    private(set) var activities: [AnnotationActivity] = []
    private(set) var documents: [String: RemoteDocument] = [:]
    private(set) var recentlyOpened: [String: FixtureArticle] = [:]
    private(set) var reviewProgress: [String: ReviewDay.Progress] = [:]
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
    var addressLabel: String {
        if let id = current.textID { return documents[id]?.text.title ?? current.title }
        if case .web(let page) = current.resource {
            let liveURL = page.item != nil && page.item === browser.web.backForwardList.currentItem ? browser.url : nil
            return (liveURL ?? page.url).host ?? "网页"
        }
        return current.title
    }
    var readyCount: Int { activities.filter { $0.state == .ready && !$0.seen }.count }
    var hasPending: Bool { activities.contains { $0.state == .pending } }
    var writableFolders: [CatalogLibrary] { libraries.filter { $0.owned && !$0.shadow } }
    var addressSearchFolders: [CatalogLibrary] { libraries.filter { !$0.archived && !$0.shadow } }
    func addressMatches(_ query: String, limit: Int) -> [CatalogText] {
        let query = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty, limit > 0 else { return [] }
        let options: String.CompareOptions = [.caseInsensitive, .diacriticInsensitive, .widthInsensitive]
        let needle = query.folding(options: options, locale: .current)
        var matches: [(text: CatalogText, rank: Int, offset: Int, length: Int, order: Int)] = []
        var seen = Set<String>()
        for folder in addressSearchFolders {
            for text in texts[folder.id] ?? [] where text.libraryId == folder.id {
                let title = text.title.trimmingCharacters(in: .whitespacesAndNewlines).folding(options: options, locale: .current)
                guard let range = title.range(of: needle), seen.insert(text.id).inserted else { continue }
                let offset = title.distance(from: title.startIndex, to: range.lowerBound)
                let rank = title == needle ? 0 : offset == 0 ? 1 : 2
                matches.append((text, rank, offset, title.count, matches.count))
            }
        }
        return matches.sorted {
            ($0.rank, $0.offset, $0.length, $0.order) < ($1.rank, $1.offset, $1.length, $1.order)
        }.prefix(min(limit, Self.maximumAddressMatches)).map(\.text)
    }
    func prepareAddressSearch(online: Bool) async {
        for folder in addressSearchFolders {
            guard !Task.isCancelled else { return }
            await loadFolder(folder, online: online, reportsFailure: false)
        }
    }
    var recentTexts: [CatalogText] {
        let all = Array(texts.values.joined())
        let ids = recentReading.ids + libraries.compactMap { recentlyOpened[$0.id]?.id.rawValue }
        var seen = Set<String>()
        return ids.compactMap { id in
            guard seen.insert(id).inserted else { return nil }
            return all.first { $0.id == id } ?? recentReading.texts.first { $0.id == id }
        }
    }
    init(client: MobileClient, namespace: String) {
        self.client = client; self.namespace = namespace
        if let data = UserDefaults.standard.data(forKey: "browser.hidden-home-recents." + namespace),
           let hidden = try? JSONDecoder().decode(HiddenHomeRecents.self, from: data) { hiddenHomeRecents = hidden }
        let readingKey = "browser.recent." + namespace
        if let data = UserDefaults.standard.data(forKey: readingKey),
           let saved = try? JSONDecoder().decode(RecentReading.self, from: data) {
            var seen = Set<String>()
            recentReading.ids = Array(saved.ids.filter { seen.insert($0).inserted }.prefix(5))
            recentReading.texts = saved.texts.filter { seen.contains($0.id) }
        } else {
            recentReading.ids = UserDefaults.standard.stringArray(forKey: readingKey)
                ?? UserDefaults.standard.string(forKey: readingKey).map { [$0] } ?? []
        }
        if let data = UserDefaults.standard.data(forKey: "browser.recent-web." + namespace) {
            let pages = (try? JSONDecoder().decode([RecentWebpage].self, from: data))
                ?? (try? JSONDecoder().decode(RecentWebpage.self, from: data)).map { [$0] } ?? []
            var seen = Set<URL>()
            recentWebpages = Array(pages.filter { TextBrowserModel.address($0.url.absoluteString) != nil && seen.insert($0.url).inserted }.prefix(1))
        }
        if let data = UserDefaults.standard.data(forKey: "recent-access." + namespace),
           let saved = try? JSONDecoder().decode([String: FixtureArticle].self, from: data) { recentlyOpened = saved }
        if let data = UserDefaults.standard.data(forKey: "browser.annotations." + namespace),
           let saved = try? JSONDecoder().decode([AnnotationActivity].self, from: data) { activities = saved }
        if let data = UserDefaults.standard.data(forKey: "browser.home-pins." + namespace),
           let pins = try? JSONDecoder().decode([BrowserHomePin].self, from: data) {
            homePins = pins
            for pin in pins {
                if let url = pin.iconURL, let data = pin.faviconData, let image = UIImage(data: data) { pinImages[url] = image }
            }
        }
        connectBrowser()
    }
    var currentPin: BrowserHomePin? {
        let destination: BrowserHomePin.Destination
        let title: String
        switch current.resource {
        case .web(let page):
            let url = page.url
            destination = .webpage(url, bookmarkID: page.bookmarkID)
            title = (browser.url == url ? RecentWebpage.normalizedTitle(browser.title) : nil) ?? url.host ?? "网页"
        case .document(let document):
            destination = .document(document.text)
            title = document.text.title
        default: return nil
        }
        return homePins.first { pin in
            switch (pin.destination, destination) {
            case (.webpage(let a, _), .webpage(let b, _)): a == b
            case (.document(let a), .document(let b)): a.id == b.id
            default: false
            }
        } ?? BrowserHomePin(id: UUID(), title: title, destination: destination)
    }
    func savePin(_ pin: BrowserHomePin) {
        guard !pin.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        var pin = pin
        if let index = homePins.firstIndex(where: { $0.id == pin.id }) {
            let existing = homePins[index]
            if existing.destination == pin.destination, pin.faviconURL == nil { pin.faviconURL = existing.faviconURL }
            pin.faviconData = existing.iconURL == pin.iconURL ? existing.faviconData ?? pin.faviconData : nil
            homePins[index] = pin
        } else { homePins.append(pin) }
        persistPins()
        if case .webpage(let url, _) = pin.destination, browser.url == url {
            let browser = browser
            let navigation = browser.navigationID
            Task { [weak self] in
                let value = try? await browser.web.callAsyncJavaScript("""
                    const icon = document.querySelector('link[rel~="apple-touch-icon"]')
                        || document.querySelector('link[rel~="icon"]');
                    return icon ? icon.href : null;
                    """, arguments: [:], in: nil, contentWorld: .defaultClient)
                guard let self, browser.navigationID == navigation,
                      let address = value as? String, let iconURL = TextBrowserModel.address(address),
                      let index = self.homePins.firstIndex(where: { $0.id == pin.id && $0.destination == pin.destination }) else { return }
                if self.homePins[index].iconURL != iconURL { self.homePins[index].faviconData = nil }
                self.homePins[index].faviconURL = iconURL
                self.persistPins()
            }
        }
    }
    func cachePinIcons(load: ((URL) async throws -> UIImage)? = nil) async {
        for pin in homePins {
            guard !Task.isCancelled else { return }
            guard let url = pin.iconURL, pinImages[url] == nil else { continue }
            do {
                let image: UIImage
                if let load { image = try await load(url) }
                else { image = try await ReaderImage.load(url, store: client.localStore) }
                guard !Task.isCancelled,
                      let index = homePins.firstIndex(where: { $0.id == pin.id && $0.iconURL == url }) else { continue }
                let format = UIGraphicsImageRendererFormat(); format.scale = 1
                let size = CGSize(width: 96, height: 96)
                let thumbnail = UIGraphicsImageRenderer(size: size, format: format).image { _ in
                    let scale = min(size.width / max(1, image.size.width), size.height / max(1, image.size.height))
                    let width = image.size.width * scale, height = image.size.height * scale
                    image.draw(in: CGRect(x: (size.width - width) / 2, y: (size.height - height) / 2, width: width, height: height))
                }
                guard let data = thumbnail.pngData() else { continue }
                pinImages[url] = thumbnail
                homePins[index].faviconData = data
                persistPins()
            } catch {
                // Keep the resource icon. Icon failures never interrupt browsing.
            }
        }
    }
    func hideRecentText(_ text: CatalogText) {
        hiddenHomeRecents.textIDs.insert(text.id)
        persistHiddenHomeRecents()
    }
    func hideRecentWebpage(_ page: RecentWebpage) {
        hiddenHomeRecents.webpageURLs.insert(page.url)
        persistHiddenHomeRecents()
    }
    private func persistHiddenHomeRecents() {
        if let data = try? JSONEncoder().encode(hiddenHomeRecents) {
            UserDefaults.standard.set(data, forKey: "browser.hidden-home-recents." + namespace)
        }
    }
    private func restoreHomeRecent(textID: String? = nil, webpageURL: URL? = nil) {
        let removedText = textID.flatMap { hiddenHomeRecents.textIDs.remove($0) }
        let removedWebpage = webpageURL.flatMap { hiddenHomeRecents.webpageURLs.remove($0) }
        if removedText != nil || removedWebpage != nil { persistHiddenHomeRecents() }
    }
    func deletePin(_ pin: BrowserHomePin) {
        homePins.removeAll { $0.id == pin.id }
        let retainedURLs = Set(homePins.compactMap(\.iconURL))
        pinImages = pinImages.filter { retainedURLs.contains($0.key) }
        persistPins()
    }
    func openPin(_ pin: BrowserHomePin) async {
        switch pin.destination {
        case .webpage(let url, let bookmarkID): openURL(url, bookmarkID: bookmarkID)
        case .document(let text): await open(text)
        }
    }
    private func persistPins() {
        if let data = try? JSONEncoder().encode(homePins) {
            UserDefaults.standard.set(data, forKey: "browser.home-pins." + namespace)
        }
    }
    private func connectBrowser() {
        browser.web.allowsBackForwardNavigationGestures = canSwipe(-1) || canSwipe(1)
        browser.web.search = { [weak self] query in self?.search(query) }
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
        rememberCurrentReading()
        rememberCurrentWebpage()
        error = nil
    }
    func openReview(_ selection: ReviewSelection) {
        let existing = history.entries.compactMap { entry -> ReviewModel? in
            if case .reviewSession(let model) = entry.resource, model.selection == selection { return model }
            return nil
        }.first
        visit(.reviewSession(existing ?? ReviewModel(client: client, selection: selection)))
    }
    func updateReview(_ model: ReviewModel) {
        guard let snapshot = model.snapshot else { return }
        reviewProgress[model.selection.id] = .init(percentage: snapshot.percentage, conversationCompleted: snapshot.conversation?.status == .complete)
    }
    func go(_ distance: Int, rememberingWebPosition: Bool = true) {
        if distance < 0, case .reviewSession(let model) = current.resource, model.exercise != nil {
            model.exercise = nil
            return
        }
        if rememberingWebPosition { rememberWebPosition() }
        guard history.go(distance) else { return }
        openRequest = UUID(); opening = false; error = nil
        if case .web(let page) = current.resource {
            restoringWeb = true
            if let item = page.item, browser.web.backForwardList.currentItem !== item {
                if browser.go(to: item, offset: page.offset) == nil { browser.load(page.url, offset: page.offset) }
            }
            else if browser.url != page.url { browser.load(page.url, offset: page.offset) }
            else { restoringWeb = false; browser.restoreScrollPosition(page.offset) }
        }
        rememberCurrentWebpage()
        acknowledgeCurrent()
        rememberCurrentReading()
    }
    func search(_ query: String) {
        guard let url = TextBrowserModel.searchURL(query) else { return }
        visit(.web(WebResource(url: url)))
        restoringWeb = true
        browser.load(url, animateSearch: true)
    }
    func openURL(_ url: URL, bookmarkID: String? = nil) {
        visit(.web(WebResource(url: url, bookmarkID: bookmarkID)))
        restoringWeb = true
        browser.load(url)
    }
    private func committed(_ item: WKBackForwardListItem) {
        guard current.isWeb else { return }
        if case .web(let page) = current.resource, restoringWeb || page.item === item {
            restoringWeb = false
            let updated = WebResource(url: browser.url ?? item.url, bookmarkID: page.bookmarkID, item: item, offset: page.offset)
            var entry = current; entry.resource = .web(updated); history.replaceCurrent(entry)
            rememberCurrentWebpage()
            return
        }
        if let index = history.entries.firstIndex(where: { entry in
            if case .web(let page) = entry.resource { return page.item === item }; return false
        }) { go(index - history.index, rememberingWebPosition: false); return }
        visit(.web(WebResource(url: browser.url ?? item.url, item: item)), rememberingWebPosition: false)
    }
    func rememberCurrentWebpage() {
        guard case .web(let page) = current.resource, page.item != nil else { return }
        restoreHomeRecent(textID: page.bookmarkID, webpageURL: page.url)
        let title = browser.url == page.url ? browser.title : page.item?.title
        let savedTitle = recentWebpages.first(where: { $0.url == page.url })?.title
        let bookmarkTitle = recentTexts.first(where: { $0.id == page.bookmarkID })?.title
        let recent = RecentWebpage(url: page.url, title: RecentWebpage.normalizedTitle(title) ?? savedTitle ?? bookmarkTitle, bookmarkID: page.bookmarkID)
        let pages = [recent]
        guard pages != recentWebpages else { return }
        recentWebpages = pages
        persistRecentWebpages()
    }
    func refreshRecentWebpageTitle() {
        guard let url = browser.url, let index = recentWebpages.firstIndex(where: { $0.url == url }),
              let title = RecentWebpage.normalizedTitle(browser.title),
              recentWebpages[index].title != title else { return }
        recentWebpages[index].title = title
        persistRecentWebpages()
    }
    private func persistRecentWebpages() {
        if let data = try? JSONEncoder().encode(recentWebpages) { UserDefaults.standard.set(data, forKey: "browser.recent-web." + namespace) }
    }
    private func rememberCurrentReading() {
        guard case .document(let details) = current.resource else { return }
        rememberReading(details.text)
    }
    private func rememberReading(_ text: CatalogText) {
        restoreHomeRecent(textID: text.id, webpageURL: text.bookmarkURL.flatMap(TextBrowserModel.address))
        recentReading.ids = Array(([text.id] + recentReading.ids.filter { $0 != text.id }).prefix(5))
        recentReading.texts.removeAll { $0.id == text.id }
        recentReading.texts.insert(text, at: 0)
        persistRecentReading()
    }
    private func persistRecentReading() {
        recentReading.texts = Array(recentTexts.prefix(5))
        if let data = try? JSONEncoder().encode(recentReading) {
            UserDefaults.standard.set(data, forKey: "browser.recent." + namespace)
        }
    }
    func canSwipe(_ distance: Int) -> Bool {
        let index = history.index + distance
        return current.isWeb && history.entries.indices.contains(index) && history.entries[index].isWeb
    }
    private func handleWebGesture(_ url: URL) -> Bool {
        guard !restoringWeb else { return false }
        let target = history.entries.firstIndex { entry in
            if case .web(let page) = entry.resource, let item = page.item {
                return item === browser.web.backForwardList.currentItem
            }
            return false
        }
        let distance: Int
        if let target, target != history.index { distance = target - history.index }
        else { distance = browser.web.backForwardList.backItem?.url == url ? -1 : 1 }
        guard abs(distance) == 1, canSwipe(distance) else { return true }
        let index = history.index + distance
        guard history.entries.indices.contains(index) else { return true }
        if case .web(let page) = history.entries[index].resource, page.url == url { return false }
        go(distance)
        return true
    }
    private func rememberWebPosition() {
        guard !restoringWeb, case .web(var page) = current.resource else { return }
        page.offset = browser.scrollPosition
        var entry = current; entry.resource = .web(page); history.replaceCurrent(entry)
    }
    func recordDocument(_ details: RemoteDocument) {
        documents[details.text.id] = details
    }
    func recordArticleAudio(textID: String, revision documentRevision: String, audioID: String) {
        guard var details = documents[textID], details.document?.revision == documentRevision else { return }
        details.fullArticleAudioId = audioID
        documents[textID] = details
        revision += 1
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
            if details.text.format == "bookmark" { rememberReading(details.text) }
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
    func contentChanged(_ text: CatalogText, reloadReader: Bool = true) async {
        catalogMutation += 1
        folderRequests[text.libraryId] = UUID()
        openRequest = UUID()
        texts[text.libraryId, default: []].removeAll { $0.id == text.id }
        texts[text.libraryId, default: []].insert(text, at: 0)
        documents[text.id] = nil
        if reloadReader { ebookReader = nil; ebookTextID = nil }
        homePins = homePins.map { pin in
            guard case .document(let previous) = pin.destination, previous.id == text.id else { return pin }
            var pin = pin; pin.destination = .document(text)
            if pin.title == previous.title { pin.title = text.title }
            return pin
        }
        persistPins(); rememberReading(text)
        recentlyOpened[text.libraryId] = text.preview
        persistRecentlyOpened()
        // Replace all retained copies so Back and Forward cannot resurrect a stale reader.
        do {
            let details = try await client.documentDetails(textID: text.id)
            documents[text.id] = details
            history.transform { entry in
                guard entry.textID == text.id else { return entry }
                if reloadReader { return BrowserEntry(resource: .document(details)) }
                var entry = entry; entry.resource = .document(details)
                return entry
            }
        } catch {
            history.removeAll { $0.textID == text.id }
        }
        revision += 1
    }
    func contentRemoved(_ text: CatalogText) {
        catalogMutation += 1; openRequest = UUID(); opening = false
        folderRequests[text.libraryId] = UUID()
        texts[text.libraryId]?.removeAll { $0.id == text.id }
        documents[text.id] = nil
        activities.removeAll { $0.id == text.id }; persistActivities()
        pollAttempts[text.id] = nil
        recentReading.ids.removeAll { $0 == text.id }
        recentReading.texts.removeAll { $0.id == text.id }; persistRecentReading()
        if recentlyOpened[text.libraryId]?.id.rawValue == text.id { recentlyOpened[text.libraryId] = nil }
        persistRecentlyOpened()
        homePins.removeAll { if case .document(let saved) = $0.destination { return saved.id == text.id }; return false }
        persistPins()
        history.removeAll { $0.textID == text.id }
        if ebookTextID == text.id { ebookReader = nil; ebookTextID = nil }
        revision += 1
    }
    private func persistRecentlyOpened() {
        if let data = try? JSONEncoder().encode(recentlyOpened) { UserDefaults.standard.set(data, forKey: "recent-access." + namespace) }
    }
    func refresh(online: Bool) async {
        let request = UUID(); catalogRequest = request
        let mutation = catalogMutation
        if let cached = await client.localStore?.value([CatalogLibrary].self, for: "libraries"), catalogRequest == request, catalogMutation == mutation, !Task.isCancelled { libraries = cached; loading = false }
        guard catalogRequest == request, catalogMutation == mutation, !Task.isCancelled else { return }
        for library in libraries {
            let cached = await client.localStore?.value([CatalogText].self, for: "texts/\(library.id)")
            guard catalogRequest == request, catalogMutation == mutation, !Task.isCancelled else { return }
            if let cached { texts[library.id] = cached }
        }
        persistRecentReading()
        loading = false
        if online {
            do {
                let result = try await client.allLibraries()
                guard catalogRequest == request, catalogMutation == mutation, !Task.isCancelled else { return }
                libraries = result
                let accessible = Set(result.map(\.id))
                texts = texts.filter { accessible.contains($0.key) }
                recentReading.texts.removeAll { !accessible.contains($0.libraryId) }
                persistRecentReading()
            }
            catch { }
        }
    }
    func loadFolder(_ library: CatalogLibrary, online: Bool, reportsFailure: Bool = true) async {
        let request = UUID(); folderRequests[library.id] = request
        folderFailures.remove(library.id)
        let mutation = catalogMutation
        if let cached = await client.localStore?.value([CatalogText].self, for: "texts/\(library.id)"), folderRequests[library.id] == request, catalogMutation == mutation, !Task.isCancelled { texts[library.id] = cached }
        guard online, folderRequests[library.id] == request, catalogMutation == mutation, !Task.isCancelled else { return }
        do {
            let result = try await client.allTexts(libraryID: library.id)
            guard folderRequests[library.id] == request, catalogMutation == mutation, !Task.isCancelled else { return }
            texts[library.id] = result
            folderFailures.remove(library.id)
            let available = Set(result.map(\.id))
            recentReading.texts.removeAll { $0.libraryId == library.id && !available.contains($0.id) }
            persistRecentReading()
        }
        catch {
            guard folderRequests[library.id] == request, catalogMutation == mutation, !Task.isCancelled else { return }
            if MobileClient.isAccessFailure(error) {
                texts[library.id] = []
                recentReading.texts.removeAll { $0.libraryId == library.id }
                persistRecentReading()
            }
            if reportsFailure { folderFailures.insert(library.id) }
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
                let mutation = catalogMutation
                let details = try await client.documentDetails(textID: activity.id)
                guard catalogMutation == mutation, activities.contains(where: { $0.id == activity.id }) else { continue }
                documents[activity.id] = details
                track(details)
                pollAttempts[activity.id, default: 0] += 1
                if pollAttempts[activity.id, default: 0] >= 150, let index = activities.firstIndex(where: { $0.id == activity.id && $0.state == .pending }) {
                    activities[index].state = .failed
                }
                revision += 1
            } catch {
                guard !Task.isCancelled else { return }
                if MutationRetry.isRetryable(error) { continue }
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
        recentWebpages = []
        UserDefaults.standard.removeObject(forKey: "browser.recent-web." + namespace)
        restoringWeb = false
    }
}

extension EnvironmentValues {
    @Entry var browserWorkspace: BrowserWorkspaceModel? = nil
    @Entry var browserChromeHeight: CGFloat = 0
    @Entry var browserResourceActive = true
}
