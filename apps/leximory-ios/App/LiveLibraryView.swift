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
    @Environment(\.nativeSync) private var sync
    @State private var openDocument: RemoteDocument?
    @State private var linkError: String?
    @State private var libraries: [CatalogLibrary] = []
    @State private var loading = true
    @State private var error: String?
    @State private var selectedTab = 0
    var body: some View {
        LibraryTabShell(selection: $selectedTab) {
            libraryBrowser
        } account: {
            AccountView(session: session, playback: playback)
        }
        .onChange(of: selectedTab) { _, tab in if tab != 0 { playback.stop() } }
        .task { await load() }
        .onChange(of: sync?.revision) { _, _ in Task { await hydrate() } }
        .task(id: ReadingLinkRequest(textID: pendingText, catalogReady: !loading && error == nil)) {
            guard !loading, error == nil, let id = pendingText else { return }
            let generation = session.generation
            selectedTab = 0
            openDocument = nil
            do {
                let document: RemoteDocument
                if let cached = await session.client.cachedDocument(textID: id.rawValue) { document = cached }
                else { document = try await session.client.documentDetails(textID: id.rawValue) }
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
    private var archiveAction: ((FixtureLibrary, Bool) async throws -> Void)? {
        return { library, archived in try await archive(library, archived) }
    }
    private var libraryBrowser: some View {
        FixtureLibraryView(playback: playback, libraries: libraries.map(\.preview), client: session.client,
            openDocument: openDocument, refresh: load, archive: archiveAction,
            recentNamespace: session.state.accountID ?? "signed-out", loadingLibraries: loading, libraryError: error)
    }
    private func archive(_ library: FixtureLibrary, _ archived: Bool) async throws {
        try await session.client.setLibraryArchived(libraryID: library.id.rawValue, archived: archived)
        if let index = libraries.firstIndex(where: { $0.id == library.id.rawValue }) { libraries[index].archived = archived }
    }
    private func hydrate() async {
        if let cached = await session.client.localStore?.value([CatalogLibrary].self, for: "libraries") {
            libraries = cached; loading = false
        }
    }
    private func load() async {
        await hydrate()
        guard sync?.online != false else { loading = false; return }
        loading = libraries.isEmpty; error = nil
        let generation = session.generation
        defer { loading = false }
        do {
            let all = try await session.client.allLibraries()
            guard generation == session.generation, !Task.isCancelled else { return }
            libraries = all
        } catch {
            if generation == session.generation, !Task.isCancelled, libraries.isEmpty {
                self.error = "请联网后同步文库，再离线阅读。"
            }
        }
    }
}

struct RemoteTextGallery: View {
    @Environment(\.nativeSync) private var sync
    @Environment(\.horizontalSizeClass) private var sizeClass
    let library: FixtureLibrary
    let client: MobileClient
    let open: (FixtureArticle) -> Void
    @State private var texts: [CatalogText] = []
    @State private var importing = false
    @State private var importedArticle: FixtureArticle?
    @State private var vocabulary = false
    @State private var loading = true
    @State private var error: String?
    @State private var requestID = UUID()
    var body: some View {
        ZStack {
            if vocabulary {
                VocabularyLibraryView(library: library, client: client, closeCorpus: { vocabulary = false })
            } else if loading { ReadingLoadingIndicator("正在加载文章……") }
            else if let error {
                LeximoryUnavailableView("暂时无法加载文章", systemImage: "wifi.exclamationmark", message: error) { Button("重试") { Task { await load() } } }
            } else if texts.isEmpty {
                LeximoryUnavailableView("还没有文章", systemImage: "doc.text")
            } else {
                TextGallery(library: FixtureLibrary(id: library.id, name: library.name, language: library.language,
                    articles: texts.map(\.preview), isRemote: true), showsNavigationBar: sizeClass != .regular,
                    openVocabulary: sizeClass == .regular ? { vocabulary = true } : nil,
                    importText: sizeClass == .regular && library.owned && !library.shadow ? { importing = true } : nil) { article in
                    open(article)
                }
            }
        }
        .toolbar {
            if sizeClass != .regular && !loading && !vocabulary {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("语料本", systemImage: "book.closed") { vocabulary = true }
                        .buttonStyle(.glass).buttonBorderShape(.circle).foregroundStyle(LeximoryPalette.sage)
                }
                if library.owned && !library.shadow {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("导入", systemImage: "plus") { importing = true }
                            .buttonStyle(.glass).buttonBorderShape(.circle).foregroundStyle(LeximoryPalette.sage)
                            .disabled(sync?.online == false)
                    }
                }
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            if sizeClass == .regular && !loading && !vocabulary && (error != nil || texts.isEmpty) {
                GlassEffectContainer(spacing: 16) {
                    HStack {
                        Spacer()
                        Button("语料本", systemImage: "book.closed") { vocabulary = true }
                            .buttonStyle(.glass).buttonBorderShape(.circle).labelStyle(.iconOnly).frame(minWidth: 44, minHeight: 44)
                        if library.owned && !library.shadow {
                            Button("导入", systemImage: "plus") { importing = true }
                                .buttonStyle(.glass).buttonBorderShape(.circle).labelStyle(.iconOnly).frame(minWidth: 44, minHeight: 44)
                                .disabled(sync?.online == false)
                        }
                    }.padding(.horizontal, 24).padding(.top, 22)
                        .tint(LeximoryPalette.sage).background(LeximoryPalette.paper)
                }
            }
        }
        .sheet(isPresented: $importing, onDismiss: {
            if let article = importedArticle {
                importedArticle = nil
                open(article)
            }
        }) {
            ContentImportView(library: library, client: client) { text in
                texts.insert(text, at: 0)
                if text.format != "bookmark" { importedArticle = text.preview }
            }
        }
        .navigationBarTitleDisplayMode(.inline).toolbar(sizeClass == .regular ? .hidden : .visible, for: .navigationBar)
        .background(LeximoryPalette.paper)
        .task(id: library.id) { await load() }
        .task(id: sync?.revision) { await hydrate() }
        .onDisappear { requestID = UUID() }
        .refreshable { await load() }
    }
    private func hydrate() async {
        let request = requestID
        if let cached = await client.localStore?.value([CatalogText].self, for: "texts/\(library.id.rawValue)"),
           !Task.isCancelled, requestID == request {
            texts = cached; loading = false; error = nil
        }
    }
    private func load() async {
        let request = UUID()
        requestID = request
        await hydrate()
        guard !Task.isCancelled, requestID == request else { return }
        guard sync?.online != false else {
            loading = false
            if texts.isEmpty { error = "暂时无法打开文章，请联网后重试。" }
            return
        }
        loading = texts.isEmpty; error = nil
        defer { if requestID == request, !Task.isCancelled { loading = false } }
        do {
            let result = try await client.allTexts(libraryID: library.id.rawValue)
            guard !Task.isCancelled, requestID == request else { return }
            texts = result
        } catch {
            guard !Task.isCancelled, requestID == request else { return }
            if MobileClient.isAccessFailure(error) { texts = []; self.error = "暂时无法访问这个文库。" }
            else if texts.isEmpty { self.error = "暂时无法打开文章，请联网后重试。" }
        }
    }
}
extension CatalogLibrary {
    var preview: FixtureLibrary {
        let language = ["en": "English", "ja": "Japanese", "fr": "French", "zh": "Chinese", "nl": "Dutch"][language] ?? language
        return FixtureLibrary(id: LibraryID(rawValue: id), name: name, language: language,
            articles: [], isRemote: true, archived: archived, shadow: shadow, owned: owned)
    }
}
extension CatalogText {
    var preview: FixtureArticle {
        let motifs: [CoverMotif] = [.leaf, .bubbles, .orbit, .waves]
        let seed = id.utf8.reduce(0) { ($0 &* 31) &+ Int($1) }
        return FixtureArticle(id: TextID(rawValue: id), title: title,
            subtitle: bookmarkURL.flatMap { URL(string: $0)?.host } ?? "", resource: "", topics: topics,
            cover: motifs[Int(seed.magnitude % 4)], coverEmoji: emoji ?? (format == "ebook" ? "📖" : format == "bookmark" ? "🌐" : nil), format: format, bookmarkURL: bookmarkURL)
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

struct LibraryTabShell<Library: View, Account: View>: View {
    @Binding var selection: Int
    @ViewBuilder let library: Library
    @ViewBuilder let account: Account
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.displayScale) private var displayScale
    @Environment(\.horizontalSizeClass) private var sizeClass
    var body: some View {
        if sizeClass == .regular {
            ZStack {
                library.environment(\.librarySectionSelection, $selection)
                    .opacity(selection == 0 ? 1 : 0)
                    .allowsHitTesting(selection == 0).accessibilityHidden(selection != 0)
                if selection == 1 {
                    account
                        .safeAreaInset(edge: .top, alignment: .leading, spacing: 12) {
                            LibrarySectionPicker(selection: $selection)
                                .frame(width: 280).padding(.horizontal, 20).padding(.top, 12)
                        }
                }
            }.background(LeximoryPalette.paper)
        } else {
            phoneTabs
        }
    }
    private var phoneTabs: some View {
        TabView(selection: $selection) {
            Tab(value: 0) { library } label: {
                Label { Text("文库").editorialFont(16, language: "Chinese") } icon: {
                    tabIcon(selection == 0 ? "books.vertical.fill" : "books.vertical", selected: selection == 0)
                }
            }
            Tab(value: 1) { account } label: {
                Label { Text("账户").editorialFont(16, language: "Chinese") } icon: {
                    tabIcon(selection == 1 ? "person.crop.circle.fill" : "person.crop.circle", selected: selection == 1)
                }
            }
        }
        .tint(LeximoryPalette.sage)
        .tabBarMinimizeBehavior(.onScrollDown)
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
}

extension EnvironmentValues {
    @Entry var librarySectionSelection: Binding<Int>? = nil
}

struct LibrarySectionPicker: View {
    @Binding var selection: Int
    var body: some View {
        Picker("导航", selection: $selection) {
            Text("文库").tag(0)
            Text("账户").tag(1)
        }.pickerStyle(.segmented)
            .font(LeximoryTypography.prose(16, language: "Chinese"))
            .accessibilityIdentifier("library-section-picker")
    }
}
