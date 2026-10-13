import SwiftUI
import UniformTypeIdentifiers
import LeximoryCore

struct BrowserWorkspaceView: View {
    let client: MobileClient
    let playback: PlaybackController
    var session: AccountSession?
    @Binding var pendingText: TextID?
    @State private var workspace: BrowserWorkspaceModel
    @State private var address = ""
    @State private var editingAddress = false
    @State private var addressEditor = BrowserAddressEditor()
    @State private var choosingFile = false
    @State private var importRequest: BrowserImportRequest?
    @State private var importedText: (CatalogText, Bool)?
    @State private var extracting = false
    @State private var activitySheet = false
    @State private var confirmingClear = false
    @State private var chromeHeight: CGFloat = 64
    @State private var completionNotice = false
    @State private var clearingData = false
    @Environment(\.nativeSync) private var sync
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.openURL) private var openURL
    @Namespace private var chromeNamespace

    init(client: MobileClient, namespace: String, playback: PlaybackController, session: AccountSession? = nil, pendingText: Binding<TextID?>, initialWorkspace: BrowserWorkspaceModel? = nil) {
        self.client = client; self.playback = playback; self.session = session; _pendingText = pendingText
        _workspace = State(initialValue: initialWorkspace ?? BrowserWorkspaceModel(client: client, namespace: namespace))
    }
    private var webBookmarkID: String? { if case .web(let page) = workspace.current.resource { page.bookmarkID } else { nil } }
    private var motion: Animation? { reduceMotion ? nil : .spring(response: 0.42, dampingFraction: 0.86) }
    var body: some View {
        NavigationStack {
            GeometryReader { geometry in
                ZStack {
                    TextBrowserScreen(client: client, bookmarkID: webBookmarkID, sharedBrowser: workspace.browser, showsControls: false, restoresSession: false)
                        .id(ObjectIdentifier(workspace.browser))
                        .opacity(workspace.current.isWeb ? 1 : 0)
                        .allowsHitTesting(workspace.current.isWeb && !editingAddress)
                        .accessibilityHidden(!workspace.current.isWeb)
                    retainedResources
                    if editingAddress && !isHome {
                        Rectangle().fill(.regularMaterial).ignoresSafeArea()
                            .onTapGesture { finishEditing() }
                    }
                    if editingAddress || isHome {
                        ZStack {
                            if editingAddress { Rectangle().fill(.regularMaterial).ignoresSafeArea() }
                            BrowserHomeView(compact: editingAddress, recent: workspace.recentText,
                                browse: beginEditing, bookmarks: { finishEditing(); workspace.visit(.bookmarks) },
                                ebook: { finishEditing(); choosingFile = true }, account: { finishEditing(); workspace.visit(.account) },
                                resume: { text in Task { await workspace.open(text) } })
                        }
                    }
                    if workspace.opening || extracting { ProgressView().padding(20).glassEffect(.regular, in: .circle).accessibilityLabel(extracting ? "正在提取正文" : "正在打开") }
                }
                .simultaneousGesture(DragGesture(minimumDistance: 35).onEnded { gesture in
                    guard !editingAddress, abs(gesture.translation.width) > abs(gesture.translation.height) * 1.5 else { return }
                    if gesture.startLocation.x < 20, gesture.translation.width > 60 {
                        if workspace.current.isWeb && workspace.browser.canGoBack { return }
                        if case .document(let document) = workspace.current.resource, document.text.format == "ebook" { return }
                        workspace.go(-1)
                    } else if gesture.startLocation.x > geometry.size.width - 20, gesture.translation.width < -60 {
                        if workspace.current.isWeb && workspace.browser.canGoForward { return }
                        workspace.go(1)
                    }
                })
            }
            .background(LeximoryPalette.paper)
            .overlay(alignment: .bottom) {
                controls.padding(.horizontal, 12).padding(.bottom, 8)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { chromeHeight = $0 }
            }
            .overlay(alignment: .top) {
                if completionNotice {
                    Label("预注释已完成", systemImage: "sparkles")
                        .font(LeximoryTypography.interface(15, style: .subheadline)).padding(.horizontal, 18).padding(.vertical, 12)
                        .glassEffect(.regular, in: .capsule).padding(.top, 16)
                        .transition(.opacity.combined(with: .scale(scale: reduceMotion ? 1 : 0.94)))
                        .allowsHitTesting(false).accessibilityAddTraits(.updatesFrequently)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .toolbar(.hidden, for: .tabBar)
            .disabled(clearingData)
        }
        .environment(\.browserWorkspace, workspace)
        .environment(\.browserChromeHeight, chromeHeight)
        .environment(\.openURL, OpenURLAction { url in
            guard TextBrowserModel.address(url.absoluteString) != nil else { return .systemAction }
            finishEditing(); workspace.openURL(url)
            return .handled
        })
        .sheet(item: $importRequest, onDismiss: {
            if let (text, annotating) = importedText { importedText = nil; Task { await workspace.imported(text, annotating: annotating) } }
        }) { request in
            BrowserImportSheet(request: request, workspace: workspace) { text, annotating in importedText = (text, annotating) }
        }
        .sheet(isPresented: $activitySheet) { BrowserAnnotationSheet(workspace: workspace) }
        .fileImporter(isPresented: $choosingFile, allowedContentTypes: [.epub, .pdf]) { result in
            Task {
                do { let file = try await BrowserEbookFile.read(result.get()); importRequest = BrowserImportRequest(source: .ebook(file)) }
                catch {
                    if (error as NSError).code == NSUserCancelledError { return }
                    workspace.error = (error as? URLError)?.code == .dataLengthExceedsMaximum ? "请选择小于 4.5 MB 的电子书。" : "电子书无法打开，请重新选择 EPUB 或 PDF 文件。"
                }
            }
        }
        .alert("暂时无法完成", isPresented: Binding(get: { workspace.error != nil }, set: { if !$0 { workspace.error = nil } })) {
            Button("完成", role: .cancel) { workspace.error = nil }
        } message: { Text(workspace.error ?? "") }
        .confirmationDialog("清除所有浏览数据？", isPresented: $confirmingClear, titleVisibility: .visible) {
            Button("清除浏览数据", role: .destructive) {
                Task {
                    clearingData = true
                    defer { clearingData = false }
                    await TextBrowserModel.clearBrowsingData()
                    workspace.clearHistory()
                }
            }
            Button("取消", role: .cancel) {}
        } message: { Text("将清除浏览记录、Cookie 和网站数据，并退出网站登录。书签和词汇会保留。") }
        .task { await workspace.refresh(online: sync?.online != false) }
        .task(id: sync?.revision) { await workspace.refresh(online: sync?.online != false) }
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                if sync?.online != false { await workspace.poll() }
                do { try await Task.sleep(for: .seconds(workspace.hasPending ? 2 : 15)) } catch { return }
            }
        }
        .task(id: pendingText) {
            guard let id = pendingText else { return }
            do {
                let document = try await client.documentDetails(textID: id.rawValue)
                guard !Task.isCancelled else { return }
                pendingText = nil
                await workspace.open(document.text)
            } catch { workspace.error = "暂时无法打开文章，请稍后重试。"; pendingText = nil }
        }
        .task(id: workspace.completionID) {
            guard workspace.completionID != nil else { return }
            withAnimation(motion) { completionNotice = true }
            do { try await Task.sleep(for: .seconds(2)) } catch { return }
            withAnimation(motion) { completionNotice = false }
        }
        .sensoryFeedback(.success, trigger: workspace.completionID)
        .onChange(of: workspace.current.id) { _, _ in
            if playback.textID?.rawValue != workspace.current.textID { playback.stop() }
        }
    }
    private var isHome: Bool { if case .home = workspace.current.resource { true } else { false } }
    private var retainedEntries: [BrowserEntry] {
        var ids = Set<String>()
        return workspace.history.entries.filter { entry in
            switch entry.resource {
            case .bookmarks: return ids.insert("bookmarks").inserted
            case .account: return ids.insert("account").inserted
            case .vocabulary: return ids.insert("vocabulary").inserted
            case .document(let document): return ids.insert(document.text.id).inserted
            default: return false
            }
        }
    }
    private func active(_ entry: BrowserEntry) -> Bool {
        switch (entry.resource, workspace.current.resource) {
        case (.bookmarks, .bookmarks), (.account, .account), (.vocabulary, .vocabulary): true
        case (.document(let a), .document(let b)): a.text.id == b.text.id
        default: false
        }
    }
    private var retainedResources: some View {
        ForEach(retainedEntries) { entry in
            resource(entry).opacity(active(entry) ? 1 : 0).allowsHitTesting(active(entry))
                .accessibilityHidden(!active(entry)).environment(\.browserResourceActive, active(entry))
        }
    }
    @ViewBuilder private func resource(_ entry: BrowserEntry) -> some View {
        switch entry.resource {
        case .bookmarks: BrowserFoldersView(workspace: workspace)
        case .account:
            if let session { AccountView(session: session, playback: playback).safeAreaPadding(.bottom, chromeHeight) }
            else { ContentUnavailableView("账号", systemImage: "person.crop.circle") }
        case .vocabulary: BrowserVocabularyView(workspace: workspace)
        case .document(let document):
            if document.text.format == "ebook" { EbookScreen(article: document.text.preview, client: client, language: document.library.preview.language) }
            else { ReaderScreen(article: document.text.preview, playback: playback, language: document.library.preview.language, client: client) }
        default: EmptyView()
        }
    }
    private var controls: some View {
        GlassEffectContainer(spacing: 6) {
            HStack(spacing: 6) {
                if !editingAddress {
                    chromeButton("后退", symbol: "chevron.left") { workspace.go(-1) }.disabled(!workspace.history.canGoBack)
                    chromeButton("前进", symbol: "chevron.right") { workspace.go(1) }.disabled(!workspace.history.canGoForward)
                }
                addressControl.glassEffect(.regular.interactive(), in: .capsule)
                    .glassEffectID("workspace-address", in: chromeNamespace)
                if editingAddress {
                    Button("取消", action: finishEditing).frame(minWidth: 44, minHeight: 48)
                        .padding(.horizontal, 8).buttonStyle(.plain).glassEffect(.regular.interactive(), in: .capsule)
                } else {
                    chromeButton("首页", symbol: "house") { workspace.visit(.home) }
                    if workspace.current.isWeb {
                        Button { Task { await extract() } } label: {
                            Image(systemName: "bookmark.fill").font(.system(size: 17, weight: .medium))
                                .foregroundStyle(LinearGradient(colors: [.purple, .pink, .orange], startPoint: .topLeading, endPoint: .bottomTrailing))
                                .frame(width: 44, height: 48).glassEffect(.regular.interactive(), in: .circle)
                        }.buttonStyle(.plain).disabled(extracting || sync?.online == false || workspace.browser.loading || workspace.browser.error != nil)
                            .accessibilityLabel("保存网页").accessibilityIdentifier("browser-magic-save")
                    }
                    more
                }
            }
        }.frame(maxWidth: 720).tint(.primary).animation(motion, value: editingAddress)
    }
    private var addressControl: some View {
        HStack(spacing: 8) {
            if editingAddress {
                BrowserAddressField(address: $address, editor: addressEditor, submit: submitAddress).frame(height: 48)
                PasteButton(payloadType: String.self) { strings in
                    guard let string = strings.first else { return }
                    if let url = TextBrowserModel.address(string), let host = url.host, host.contains(".") || host == "localhost" || host.contains(":") {
                        finishEditing(); workspace.openURL(url)
                    } else { address = string }
                }.labelStyle(.iconOnly).accessibilityLabel("粘贴并打开")
            } else {
                Button(action: beginEditing) {
                    HStack(spacing: 6) {
                        Group {
                            if case .document(let document) = workspace.current.resource { BrowserTextIcon(text: document.text) }
                            else if let id = webBookmarkID, let text = workspace.documents[id]?.text { BrowserTextIcon(text: text) }
                            else { Image(systemName: workspace.current.symbol) }
                        }.foregroundStyle(.secondary)
                        Text(workspace.currentTitle)
                            .lineLimit(1).truncationMode(.middle)
                    }.frame(maxWidth: .infinity, minHeight: 48).contentShape(Capsule())
                }.buttonStyle(.plain).accessibilityLabel("地址").accessibilityIdentifier("browser-address")
            }
        }.font(LeximoryTypography.interface(15, style: .subheadline)).padding(.horizontal, 12).frame(maxWidth: .infinity, minHeight: 48)
            .simultaneousGesture(DragGesture(minimumDistance: 35).onEnded { value in
                guard !editingAddress, abs(value.translation.width) > 60 else { return }
                workspace.go(value.translation.width > 0 ? -1 : 1)
            })
    }
    private var more: some View {
        Menu {
            Button("我的书签", systemImage: "bookmark") { workspace.visit(.bookmarks) }
            Button("打开电子书", systemImage: "book.closed") { choosingFile = true }.disabled(sync?.online == false)
            Section {
                Button("文章预注释", systemImage: "sparkles") { activitySheet = true }
                Button("已存词汇", systemImage: "character.book.closed") { workspace.visit(.vocabulary) }
            }
            if let id = workspace.current.textID {
                ShareLink(item: client.webURL.appending(path: "read/\(id)")) { Label("分享", systemImage: "square.and.arrow.up") }
                if workspace.ebookTextID == id, let reader = workspace.ebookReader {
                    Section {
                        Button("目录", systemImage: "list.bullet") { reader.trayRequest = "contents" }.disabled(!reader.ready)
                        Button("荧光笔", systemImage: "highlighter") { reader.trayRequest = "bookmarks" }.disabled(!reader.ready)
                        Button("阅读选项", systemImage: "slider.horizontal.3") { reader.trayRequest = "settings" }.disabled(!reader.ready)
                    }
                } else if let document = workspace.documents[id]?.document {
                    let audioIDs = Array(Set(document.blocks.compactMap(\.audioId))).sorted()
                    if !audioIDs.isEmpty {
                        Section {
                            ForEach(audioIDs, id: \.self) { audioID in
                                Button("播放录音", systemImage: "headphones") { playback.toggle(textID: TextID(rawValue: id), audioID: audioID, title: workspace.current.title) }
                                    .disabled(sync?.online == false)
                            }
                        }
                    }
                }
            }
            if workspace.current.isWeb, let url = workspace.browser.url {
                Section {
                    ShareLink(item: url) { Label("分享", systemImage: "square.and.arrow.up") }
                    Button("在 Safari 中打开", systemImage: "safari") { openURL(url) }
                    Button(workspace.browser.loading ? "停止" : "重新加载", systemImage: workspace.browser.loading ? "xmark" : "arrow.clockwise") {
                        if workspace.browser.loading { workspace.browser.web.stopLoading() } else { workspace.browser.web.reload() }
                    }
                }
            }
            Section {
                Button("账号", systemImage: "person.crop.circle") { workspace.visit(.account) }
                Button("清除浏览数据", systemImage: "trash", role: .destructive) { confirmingClear = true }
            }
        } label: {
            Image(systemName: "ellipsis").font(.system(size: 17, weight: .medium)).frame(width: 44, height: 48)
                .glassEffect(.regular.interactive(), in: .circle)
                .overlay(alignment: .topTrailing) {
                    if workspace.readyCount > 0 {
                        Text(workspace.readyCount > 99 ? "99+" : "\(workspace.readyCount)").font(LeximoryTypography.interface(11, semibold: true, style: .caption2))
                            .foregroundStyle(.white).padding(.horizontal, 5).frame(minWidth: 18, minHeight: 18).background(.red, in: .capsule)
                    } else if workspace.hasPending { Circle().fill(.red).frame(width: 8, height: 8).padding(3) }
                }
        }.buttonStyle(.plain).accessibilityLabel("更多")
            .accessibilityValue(workspace.readyCount > 0 ? "\(workspace.readyCount) 篇预注释已完成" : workspace.hasPending ? "正在预注释" : "")
            .accessibilityIdentifier("browser-more")
    }
    private func chromeButton(_ title: String, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { Image(systemName: symbol).font(.system(size: 17, weight: .medium)).frame(width: 44, height: 48).glassEffect(.regular.interactive(), in: .circle) }
            .buttonStyle(.plain).accessibilityLabel(title)
    }
    private func beginEditing() {
        if case .web(let page) = workspace.current.resource { address = page.url.absoluteString } else { address = "" }
        withAnimation(motion) { editingAddress = true }
    }
    private func finishEditing() {
        addressEditor.field?.resignFirstResponder()
        withAnimation(motion) { editingAddress = false }
    }
    private func submitAddress() {
        guard let url = TextBrowserModel.destination(address) else { return }
        finishEditing(); workspace.openURL(url)
    }
    private func extract() async {
        extracting = true
        defer { extracting = false }
        let resourceID = workspace.current.id
        do {
            var draft = try await workspace.browser.extractArticle()
            guard workspace.current.id == resourceID else { return }
            if let id = webBookmarkID { draft.sourceFolderID = workspace.documents[id]?.library.id }
            importRequest = BrowserImportRequest(source: .article(draft))
        }
        catch { if (error as? URLError)?.code != .cancelled { workspace.error = "正文暂时无法提取，请重新加载网页后重试。" } }
    }
}

private struct BrowserAnnotationSheet: View {
    let workspace: BrowserWorkspaceModel
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            List {
                ForEach(workspace.activities) { activity in
                    HStack {
                        BrowserResourceRow(text: activity.text) { dismiss(); Task { await workspace.open(activity.text) } }
                        switch activity.state {
                        case .pending: ProgressView().accessibilityLabel("正在预注释")
                        case .ready: Image(systemName: "checkmark.circle.fill").foregroundStyle(.secondary).accessibilityLabel("已完成")
                        case .failed: Button("重试") { workspace.retry(activity.id) }
                        }
                    }
                }
            }.overlay { if workspace.activities.isEmpty { ContentUnavailableView("暂无预注释文章", systemImage: "sparkles") } }
                .navigationTitle("文章预注释").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() } } }
        }.presentationDetents([.medium, .large]).tint(.primary)
    }
}

private struct BrowserVocabularyView: View {
    let workspace: BrowserWorkspaceModel
    @State private var selected: CatalogLibrary?
    @Environment(\.browserChromeHeight) private var chromeHeight
    var body: some View {
        Group {
            if let selected { VocabularyLibraryView(library: selected.preview, client: workspace.client, closeCorpus: { self.selected = nil }) }
            else {
                List {
                    Section("已存词汇") {
                        ForEach(workspace.libraries.filter(\.owned)) { library in
                            Button { selected = library } label: { BrowserFolderLabel(library: library) }.foregroundStyle(.primary)
                        }
                    }
                }.listStyle(.insetGrouped)
            }
        }.safeAreaPadding(.bottom, chromeHeight)
    }
}
