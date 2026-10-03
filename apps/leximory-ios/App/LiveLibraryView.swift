import SwiftUI
import LeximoryCore

private struct ReadingLinkRequest: Equatable {
    let textID: TextID?
    let catalogReady: Bool
}

struct LiveLibraryView: View {
    let session: AccountSession
    let playback: PlaybackController
    @Binding var pendingText: TextID?
    @State private var openDocument: RemoteDocument?
    @State private var linkError: String?
    @State private var libraries: [CatalogLibrary] = []
    @State private var loading = true
    @State private var error: String?
    @State private var selectedTab = 0
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.displayScale) private var displayScale
    var body: some View {
        TabView(selection: $selectedTab) {
            Tab(value: 0) {
                libraryBrowser
            } label: {
                Label { Text("文库") } icon: {
                    tabIcon(selectedTab == 0 ? "books.vertical.fill" : "books.vertical", selected: selectedTab == 0)
                }
            }
            Tab(value: 1) {
                AccountView(session: session, playback: playback)
            } label: {
                Label { Text("账户") } icon: {
                    tabIcon(selectedTab == 1 ? "person.crop.circle.fill" : "person.crop.circle", selected: selectedTab == 1)
                }
            }
        }
        .tint(LeximoryPalette.sage)
        .tabBarMinimizeBehavior(.onScrollDown)
        .onChange(of: selectedTab) { _, tab in if tab != 0 { playback.stop() } }
        .task { await load() }
        .task(id: ReadingLinkRequest(textID: pendingText, catalogReady: !loading && error == nil)) {
            guard !loading, error == nil, let id = pendingText else { return }
            let generation = session.generation
            selectedTab = 0
            openDocument = nil
            do {
                let document = try await session.client.documentDetails(textID: id.rawValue)
                guard !Task.isCancelled, session.generation == generation else { return }
                openDocument = document
                pendingText = nil
            } catch {
                guard !Task.isCancelled, session.generation == generation else { return }
                linkError = "暂时无法打开文章，请检查访问权限和网络后重试。"
                pendingText = nil
            }
        }
        .alert("暂时无法打开文章", isPresented: Binding(get: { linkError != nil }, set: { if !$0 { linkError = nil } })) {
            Button("完成", role: .cancel) { linkError = nil }
        } message: { Text(linkError ?? "") }
    }
    private func tabIcon(_ name: String, selected: Bool) -> Image {
        let traits = UITraitCollection(userInterfaceStyle: colorScheme == .dark ? .dark : .light)
        let color = UIColor(selected ? LeximoryPalette.sage : LeximoryPalette.muted).resolvedColor(with: traits)
        let symbol = UIImage(systemName: name, withConfiguration: UIImage.SymbolConfiguration(pointSize: 22, weight: .regular))!
            .withTintColor(color, renderingMode: .alwaysOriginal)
        let format = UIGraphicsImageRendererFormat(); format.scale = displayScale
        let image = UIGraphicsImageRenderer(size: symbol.size, format: format).image { _ in symbol.draw(at: .zero) }
        return Image(uiImage: image.withRenderingMode(.alwaysOriginal))
    }
    private var libraryBrowser: some View {
        FixtureLibraryView(playback: playback, libraries: libraries.map(\.preview), client: session.client,
            openDocument: openDocument, refresh: load, archive: archive,
            recentNamespace: session.state.accountID ?? "signed-out")
            .overlay {
                if loading && libraries.isEmpty { ProgressView("正在打开文库……").frame(maxWidth: .infinity, maxHeight: .infinity).background(LeximoryPalette.paper) }
                else if let error {
                    ContentUnavailableView {
                        Label("暂时无法打开文库", systemImage: "wifi.exclamationmark")
                    } description: { Text(error) } actions: { Button("重试") { Task { await load() } } }
                        .background(LeximoryPalette.paper)
                }
            }
    }
    private func archive(_ library: FixtureLibrary, _ archived: Bool) async throws {
        try await session.client.setLibraryArchived(libraryID: library.id.rawValue, archived: archived)
        if let index = libraries.firstIndex(where: { $0.id == library.id.rawValue }) { libraries[index].archived = archived }
    }
    private func load() async {
        guard !loading || libraries.isEmpty else { return }
        loading = true; error = nil
        let generation = session.generation
        defer { loading = false }
        do {
            var all: [CatalogLibrary] = []
            var cursor: String?
            var seen: Set<String> = []
            repeat {
                let page = try await session.client.libraries(cursor: cursor)
                all.append(contentsOf: page.items)
                cursor = page.nextCursor
                if let cursor, !seen.insert(cursor).inserted { throw URLError(.badServerResponse) }
                try Task.checkCancellation()
            } while cursor != nil
            guard generation == session.generation else { return }
            libraries = all
        } catch {
            if generation == session.generation, !Task.isCancelled { self.error = "请检查网络后重试。" }
        }
    }
}

struct RemoteTextGallery: View {
    let library: FixtureLibrary
    let client: MobileClient
    let open: (FixtureArticle) -> Void
    @State private var texts: [CatalogText] = []
    @State private var loading = true
    @State private var error: String?
    var body: some View {
        ZStack {
            if loading { ProgressView("正在加载文章……") }
            else if let error {
                ContentUnavailableView {
                    Label("暂时无法加载文章", systemImage: "wifi.exclamationmark")
                } description: { Text(error) } actions: { Button("重试") { Task { await load() } } }
            } else if texts.isEmpty {
                ContentUnavailableView("还没有文章", systemImage: "doc.text", description: Text("在网页版导入文章后，即可在这里阅读。"))
            } else {
                TextGallery(library: FixtureLibrary(id: library.id, name: library.name, language: library.language,
                    articles: texts.map(\.preview), isRemote: true)) { article in
                    open(article)
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline).toolbar(.visible, for: .navigationBar)
        .background(LeximoryPalette.paper)
        .task(id: library.id) { await load() }
        .refreshable { await load() }
    }
    private func load() async {
        loading = true; error = nil
        defer { loading = false }
        do {
            var all: [CatalogText] = []
            var cursor: String?
            var seen: Set<String> = []
            repeat {
                let page = try await client.texts(libraryID: library.id.rawValue, cursor: cursor)
                all.append(contentsOf: page.items); cursor = page.nextCursor
                if let cursor, !seen.insert(cursor).inserted { throw URLError(.badServerResponse) }
                try Task.checkCancellation()
            } while cursor != nil
            texts = all
        } catch { if !Task.isCancelled { self.error = "请检查网络后重试。" } }
    }
}
extension CatalogLibrary {
    var preview: FixtureLibrary {
        let language = ["en": "English", "ja": "Japanese", "fr": "French", "zh": "Chinese", "nl": "Dutch"][language] ?? language
        return FixtureLibrary(id: LibraryID(rawValue: id), name: name, language: language,
            articles: [], isRemote: true, archived: archived, shadow: shadow)
    }
}
extension CatalogText {
    var preview: FixtureArticle {
        let motifs: [CoverMotif] = [.leaf, .bubbles, .orbit, .waves]
        let seed = id.utf8.reduce(0) { ($0 &* 31) &+ Int($1) }
        return FixtureArticle(id: TextID(rawValue: id), title: title,
            subtitle: "", resource: "", topics: topics,
            cover: motifs[Int(seed.magnitude % 4)], coverEmoji: emoji ?? (format == "ebook" ? "📖" : nil), format: format)
    }
}

private struct AccountView: View {
    let session: AccountSession
    let playback: PlaybackController
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    Text("账户").font(.custom("LXGWWenKaiScreen", size: 30, relativeTo: .largeTitle))
                    if case .signedIn(let account) = session.state {
                        LabeledContent("本期词点", value: "\(Int(account.definitions.used)) / \(Int(account.definitions.limit))")
                    }
                    Button("退出登录", role: .destructive) {
                        playback.stop()
                        Task { await session.signOut() }
                    }.frame(minHeight: 44)
                }.padding(28).frame(maxWidth: 560, alignment: .leading).frame(maxWidth: .infinity)
            }.background(LeximoryPalette.paper).toolbar(.hidden, for: .navigationBar)
        }.task { await session.refreshAccount() }
    }
}
