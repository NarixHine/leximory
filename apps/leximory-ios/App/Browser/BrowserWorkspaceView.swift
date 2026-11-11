import SwiftUI
import UniformTypeIdentifiers
import LeximoryCore

struct BrowserWorkspaceView: View {
    @ScaledMetric(relativeTo: .subheadline) private var addressTextSize = LeximoryTypography.addressSize
    let client: MobileClient
    let playback: PlaybackController
    var session: AccountSession?
    var guest: GuestSession?
    @Binding var pendingText: TextID?
    @Binding var pendingHome: Bool
    @State private var workspace: BrowserWorkspaceModel
    @State private var wallpapers: HomeWallpaperStore
    @State private var editingWallpaper = false
    @State private var adBlockingSettings = false
    @State private var address = ""
    @State private var addressQuery = ""
    @AppStorage("browser.searchEngine") private var searchEngine = BrowserSearchEngine.bing
    @State private var editingAddress = false
    @State private var addressEditor = BrowserAddressEditor()
    @State private var choosingFile = false
    @State private var importRequest: BrowserImportRequest?
    @State private var importedText: (CatalogText, Bool)?
    @State private var extracting = false
    @State private var clipboardNotice: UUID?
    @State private var finding = false
    @State private var findRequest: UUID?
    @State private var findInteraction: UIFindInteraction?
    @State private var findDismissal: BrowserFindDismissal?
    @State private var editingText: CatalogText?
    @State private var editingPin: BrowserHomePin?
    @State private var activitySheet = false
    @State private var confirmingClear = false
    @State private var externalURL: URL?
    @State private var chromeHeight: CGFloat = 64
    @State private var completionNotice = false
    @State private var clearingData = false
    @Environment(\.nativeSync) private var sync
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.openURL) private var openURL
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.displayScale) private var displayScale
    @Namespace private var chromeNamespace

    init(client: MobileClient, namespace: String, playback: PlaybackController, session: AccountSession? = nil, guest: GuestSession? = nil, pendingText: Binding<TextID?>, pendingHome: Binding<Bool> = .constant(false), initialWorkspace: BrowserWorkspaceModel? = nil) {
        self.client = client; self.playback = playback; self.session = session; self.guest = guest; _pendingText = pendingText; _pendingHome = pendingHome
        _workspace = State(initialValue: initialWorkspace ?? BrowserWorkspaceModel(client: client, namespace: namespace, localOnly: guest != nil))
        _wallpapers = State(initialValue: HomeWallpaperStore(namespace: namespace))
    }
    private var webBookmarkID: String? { if case .web(let page) = workspace.current.resource { page.bookmarkID } else { nil } }
    private var motion: Animation? { reduceMotion ? nil : .spring(response: 0.42, dampingFraction: 0.86) }
    private func handleKeyboardHidden() {
        if editingAddress, addressEditor.field?.isFirstResponder != true { finishEditing() }
    }
    private var pinIconTaskID: [String] {
        var values: [String] = [scenePhase == .active ? "active" : "inactive", sync?.online == false ? "offline" : "online"]
        for pin in workspace.homePins {
            values.append(pin.id.uuidString + (pin.iconURL?.absoluteString ?? ""))
        }
        return values
    }
    private var workspaceNavigation: some View {
        NavigationStack {
            GeometryReader { geometry in
                HomeWallpaperSurface(wallpaper: isHome ? wallpapers[HomeWallpaperAppearance(colorScheme)] : nil,
                    usesSystemBackground: isHome && wallpapers.choice(for: HomeWallpaperAppearance(colorScheme)) == .solid) {
                    ZStack {
                        TextBrowserScreen(client: client, bookmarkID: webBookmarkID, sharedBrowser: workspace.browser, showsControls: false, restoresSession: false)
                            .environment(\.openURL, openURL)
                            .id(ObjectIdentifier(workspace.browser))
                            .opacity(workspace.current.isWeb ? 1 : 0)
                            .blur(radius: editingAddress ? 3 : 0)
                            .allowsHitTesting(workspace.current.isWeb && !editingAddress)
                            .accessibilityHidden(!workspace.current.isWeb)
                        retainedResources.blur(radius: editingAddress ? 3 : 0).allowsHitTesting(!editingAddress)
                        if editingAddress {
                            Color.black.opacity(0.18).ignoresSafeArea().onTapGesture { finishEditing() }
                        }
                        if editingAddress || isHome {
                            BrowserHomeView(pins: workspace.homePins, pinImages: workspace.pinImages,
                                openPin: { pin in Task { await workspace.openPin(pin) } },
                                editPin: { editingPin = $0 }, deletePin: workspace.deletePin,
                                hiddenRecentTextIDs: workspace.hiddenHomeRecents.textIDs,
                                hiddenRecentWebURLs: workspace.hiddenHomeRecents.webpageURLs,
                                hideRecentText: workspace.hideRecentText, hideRecentWebpage: workspace.hideRecentWebpage,
                                compact: editingAddress, recent: workspace.recentTexts, recentImages: workspace.recentImages, libraryName: workspace.recentLibraryName,
                                browse: beginEditing, paste: openClipboard, recentWebpages: workspace.recentWebpages, openWebpage: { finishEditing(); workspace.openURL($0.url, bookmarkID: $0.bookmarkID) }, bookmarks: { finishEditing(); workspace.visit(.bookmarks) },
                                ebook: { finishEditing(); choosingFile = true }, review: { finishEditing(); workspace.visit(.review) },
                                addressQuery: addressQuery, addressMatches: { workspace.addressMatches($0, limit: $1) },
                                openAddressMatch: { match in finishEditing(); Task { await workspace.openAddressMatch(match) } },
                                resume: { text in finishEditing(); Task { await workspace.open(text) } })
                                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                                .padding(.bottom, editingAddress ? chromeHeight + 12 : 0)
                        }
                        if workspace.opening || extracting { ProgressView().padding(20).glassEffect(.regular, in: .circle).accessibilityLabel(extracting && !workspace.browser.isPDF ? "正在提取正文" : "正在打开") }
                    }
                }
                .simultaneousGesture(DragGesture(minimumDistance: 35).onEnded { gesture in
                    guard !editingAddress, abs(gesture.translation.width) > abs(gesture.translation.height) * 1.5 else { return }
                    if gesture.startLocation.x < 20, gesture.translation.width > 60 {
                        guard workspace.canSwipe(-1) else { return }
                        if workspace.browser.canGoBack { return }
                        workspace.go(-1)
                    } else if gesture.startLocation.x > geometry.size.width - 20, gesture.translation.width < -60 {
                        guard workspace.canSwipe(1) else { return }
                        if workspace.browser.canGoForward { return }
                        workspace.go(1)
                    }
                })
            }
            .ignoresSafeArea(keepsReadingViewport || (workspace.current.isReviewLawn && !editingAddress) ? .keyboard : [], edges: .bottom)
            .background(LeximoryPalette.paper)
            .overlay(alignment: .top) {
                if completionNotice || clipboardNotice != nil {
                    Label(clipboardNotice != nil ? "不是有效网页链接" : "预注释已完成", systemImage: clipboardNotice != nil ? "link" : "sparkles")
                        .interfaceFont(15, style: .subheadline).padding(.horizontal, 18).padding(.vertical, 12)
                        .glassEffect(.regular, in: .capsule).padding(.top, 16)
                        .transition(.opacity.combined(with: .scale(scale: reduceMotion ? 1 : 0.94)))
                        .allowsHitTesting(false).accessibilityAddTraits(.updatesFrequently)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .toolbar(.hidden, for: .tabBar)
            .disabled(clearingData)
        }
    }
    private var workspacePresentation: some View {
        workspaceNavigation
        .ignoresSafeArea(keepsReadingViewport ? .keyboard : [], edges: .bottom)
        .overlay(alignment: .bottom) {
                controls.padding(.horizontal, 12).padding(.bottom, 8)
                    .opacity(finding ? 0 : 1).allowsHitTesting(!finding).accessibilityHidden(finding)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { chromeHeight = $0 }
            }
        .environment(\.browserWorkspace, workspace)
        .environment(\.browserChromeHeight, chromeHeight)
        .environment(\.openURL, OpenURLAction { url in
            guard TextBrowserModel.address(url.absoluteString) != nil else { externalURL = url; return .handled }
            finishEditing(); workspace.openURL(url)
            return .handled
        })
        .sheet(item: $editingText) { text in
            TextManagementSheet(text: text, workspace: workspace, playback: playback)
        }
        .sheet(item: $importRequest, onDismiss: {
            if let (text, annotating) = importedText { importedText = nil; Task { await workspace.imported(text, annotating: annotating) } }
        }) { request in
            BrowserImportSheet(request: request, workspace: workspace) { text, annotating in importedText = (text, annotating) }
        }
        .sheet(item: $editingPin) { pin in
            BrowserPinEditor(pin: pin) { workspace.savePin($0) }
        }
        .sheet(isPresented: $activitySheet) { BrowserAnnotationSheet(workspace: workspace) }
        .sheet(isPresented: $adBlockingSettings) {
            BrowserAdBlockingSettings(blocker: workspace.browser.adBlocker, browser: workspace.current.isWeb ? workspace.browser : nil)
        }
        .sheet(isPresented: $editingWallpaper) {
            HomeWallpaperEditor(store: wallpapers, appearance: HomeWallpaperAppearance(colorScheme))
        }
        .task { await wallpapers.load() }
        .fileImporter(isPresented: $choosingFile, allowedContentTypes: [.epub, .pdf]) { result in
            Task {
                do {
                    let file = try await BrowserEbookFile.read(result.get())
                    if let guest {
                        let input = try guest.openFile(file)
                        workspace.recordDocument(input.document)
                        workspace.visit(.document(input.document))
                    } else { importRequest = BrowserImportRequest(source: .ebook(file)) }
                }
                catch {
                    if (error as NSError).code == NSUserCancelledError { return }
                    workspace.error = .openFile(oversized: (error as? URLError)?.code == .dataLengthExceedsMaximum)
                }
            }
        }
        .alert(workspace.error?.title ?? "操作未完成", isPresented: Binding(get: { workspace.error != nil }, set: { if !$0 { workspace.error = nil } }), presenting: workspace.error) { failure in
            switch failure {
            case .openText(let text): Button("重试") { Task { await workspace.open(text) } }
            case .openArticle(let id): Button("重试") { pendingText = id }
            case .archiveFolder(let folder): Button("重试") { Task { await workspace.setArchived(folder) } }
            case .openFile: Button("重新选择") { choosingFile = true }
            case .savePDF(false): Button("重试") { Task { await extract() } }
            case .savePDF(true): EmptyView()
            }
            Button(failure.dismissal, role: .cancel) { }
        } message: { failure in Text(failure.message) }
        .modifier(ExternalLinkConfirmation(url: $externalURL))
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
    }
    private var workspaceCaching: some View {
        workspacePresentation
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardDidHideNotification)) { _ in
            handleKeyboardHidden()
        }
        .task(id: pinIconTaskID) {
            guard scenePhase == .active else { return }
            await workspace.cachePinIcons()
        }
        .task(id: recentArtworkTaskID) {
            guard scenePhase == .active else { return }
            await workspace.cacheRecentImages()
        }
        .task(id: "pins/\(scenePhase == .active)/\(sync?.online != false)/\(workspace.pinMutationRevision)") {
            guard scenePhase == .active, sync?.online != false else { return }
            while !Task.isCancelled {
                await workspace.syncPins()
                do { try await Task.sleep(for: .seconds(15)) } catch { return }
            }
        }
    }
    private var workspaceRequests: some View {
        workspaceCaching
        .task(id: sync?.revision) { await workspace.refresh(online: sync == nil) }
        .task(id: editingAddress ? workspace.addressSearchFolders.map(\.id) + [sync?.online == false ? "offline" : "online"] : []) {
            guard editingAddress else { return }
            await workspace.prepareAddressSearch(online: sync?.online != false)
        }
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                if sync?.online != false { await workspace.poll() }
                do { try await Task.sleep(for: .seconds(workspace.hasPending ? 2 : 15)) } catch { return }
            }
        }
        .task(id: pendingText) {
            guard let id = pendingText else { return }
            if guest != nil { session?.entry = AccountEntryContext(purpose: .cloudLibrary); pendingText = nil; return }
            do {
                let document = try await client.documentDetails(textID: id.rawValue)
                guard !Task.isCancelled else { return }
                pendingText = nil
                await workspace.open(document.text)
            } catch { workspace.error = .openArticle(id); pendingText = nil }
        }
        .task(id: pendingHome) {
            guard pendingHome else { return }
            finishEditing()
            workspace.visit(.home)
            pendingHome = false
        }
    }
    private var workspaceFind: some View {
        workspaceRequests
        .task(id: findRequest) {
            guard let request = findRequest, let interaction = findInteraction else { return }
            // Let the menu finish dismissing before presenting UIKit's find controls.
            do { try await Task.sleep(for: .milliseconds(300)) } catch { return }
            if workspace.ebookReader?.format == "pdf", interaction === workspace.ebookReader?.findInteraction {
                await workspace.ebookReader?.prepareForFind?()
            }
            guard !Task.isCancelled, findRequest == request else { return }
            finding = true
            let dismissal = BrowserFindDismissal(interaction: interaction)
            findDismissal = dismissal
            defer { dismissal.stop(); if findRequest == request { findDismissal = nil } }
            interaction.presentFindNavigator(showingReplace: false)
            // UIKit does not publish navigator visibility changes. Observe only during this find session.
            repeat {
                do { try await Task.sleep(for: .milliseconds(150)) } catch { return }
            } while interaction.isFindNavigatorVisible
            guard findRequest == request else { return }
            finding = false; findInteraction = nil
        }
    }
    var body: some View {
        workspaceFind
        .task(id: workspace.completionID) {
            guard workspace.completionID != nil else { return }
            withAnimation(motion) { completionNotice = true }
            do { try await Task.sleep(for: .seconds(2)) } catch { return }
            withAnimation(motion) { completionNotice = false }
        }

        .task(id: clipboardNotice) {
            guard let notice = clipboardNotice else { return }
            do { try await Task.sleep(for: .seconds(2)) } catch { return }
            if clipboardNotice == notice { withAnimation(motion) { clipboardNotice = nil } }
        }
        .sensoryFeedback(.success, trigger: workspace.completionID)
        .onChange(of: workspace.browser.title) { _, _ in workspace.refreshRecentWebpageTitle() }
        .onChange(of: workspace.canSwipe(-1) || workspace.canSwipe(1), initial: true) { _, enabled in
            workspace.browser.web.allowsBackForwardNavigationGestures = enabled
        }
        .onChange(of: workspace.browser.loading) { _, _ in workspace.refreshRecentWebpageTitle() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background {
                findInteraction?.dismissFindNavigator()
                findDismissal?.stop(); findDismissal = nil
                findRequest = nil; finding = false; findInteraction = nil
            }
        }
        .onChange(of: workspace.current.id) { _, _ in
            workspace.error = nil
            findDismissal?.stop(); findDismissal = nil
            workspace.browser.web.findInteraction?.dismissFindNavigator()
            findInteraction?.dismissFindNavigator()
            findRequest = nil; finding = false; findInteraction = nil
            if playback.textID?.rawValue != workspace.current.textID { playback.stop() }
        }
        .onChange(of: workspace.browser.navigationID) { if case .savePDF = workspace.error { workspace.error = nil } }
    }
    private var recentArtworkTaskID: [String] {
        let state = [scenePhase == .active ? "active" : "inactive", sync?.online == false ? "offline" : "online"]
        let pages = workspace.recentWebpages.flatMap { page -> [String] in
            [page.url.absoluteString, page.iconURL?.absoluteString ?? "", page.previewImageURL?.absoluteString ?? ""]
        }
        return state + pages
    }
    private var keepsReadingViewport: Bool {
        !editingAddress && (workspace.current.isWeb ||
            (workspace.ebookReader != nil && workspace.current.textID == workspace.ebookTextID))
    }
    private func beginFind(_ interaction: UIFindInteraction?) {
        guard let interaction else { return }
        findInteraction = interaction
        findRequest = UUID()
    }
    private var isHome: Bool { if case .home = workspace.current.resource { true } else { false } }
    private var retainedEntries: [BrowserEntry] {
        var ids = Set<String>()
        return workspace.history.entries.filter { entry in
            switch entry.resource {
            case .bookmarks: return ids.insert("bookmarks").inserted
            case .account: return ids.insert("account").inserted
            case .review: return ids.insert("review").inserted
            case .reviewSession(let model): return ids.insert("review/" + model.selection.id).inserted
            case .document(let document): return ids.insert(document.text.id).inserted
            default: return false
            }
        }
    }
    private func active(_ entry: BrowserEntry) -> Bool {
        switch (entry.resource, workspace.current.resource) {
        case (.bookmarks, .bookmarks), (.account, .account), (.review, .review): true
        case (.reviewSession(let a), .reviewSession(let b)): a.selection == b.selection
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
        case .bookmarks:
            if guest != nil { GuestAccountPrompt(title: "我的书签", message: "登录后查看你的文件夹和已保存内容。", purpose: .cloudLibrary) }
            else { BrowserFoldersView(workspace: workspace, editText: { editingText = $0 }) }
        case .account:
            if let session { AccountView(session: session, playback: playback).safeAreaPadding(.bottom, chromeHeight) }
            else { LeximoryUnavailableView("账号", systemImage: "person.crop.circle") }
        case .review:
            if guest != nil { GuestAccountPrompt(title: "每日复习", message: "登录后复习你收藏的生词。", purpose: .review) }
            else { ReviewTimelineView(client: client, progressOverrides: workspace.reviewProgress, open: workspace.openReview) }
        case .reviewSession(let model):
            ReviewSessionView(model: model, onProgress: { workspace.updateReview(model) })
        case .document(let document):
            if document.text.format == "ebook" {
                EbookScreen(article: document.text.preview, client: guest == nil ? client : nil,
                    language: document.library.preview.language, localInput: guest?.files[document.text.id])
            }
            else { ReaderScreen(article: document.text.preview, playback: playback, language: document.library.preview.language, client: client) }
        default: EmptyView()
        }
    }
    private var chromeGlass: Glass {
        if case .document(let document) = workspace.current.resource,
           document.text.format == "ebook", workspace.ebookReader?.format == "epub", !editingAddress {
            return .clear.interactive()
        }
        return .regular.interactive()
    }
    private var controls: some View {
        GlassEffectContainer(spacing: 6) {
            HStack(spacing: 6) {
                if editingAddress {
                    chromeButton("后退", symbol: "chevron.left", action: finishEditing)
                } else {
                    if workspace.history.canGoBack { chromeButton("后退", symbol: "chevron.left") { workspace.go(-1) } }
                    if workspace.history.canGoForward { chromeButton("前进", symbol: "chevron.right") { workspace.go(1) } }
                }
                addressControl.glassEffect(chromeGlass, in: .capsule)
                    .glassEffectID("workspace-address", in: chromeNamespace)
                if !editingAddress {
                    if !isHome { chromeButton("首页", symbol: "house") { withAnimation(motion) { workspace.visit(.home) } } }
                    if workspace.current.isWeb {
                        Button { Task { await extract() } } label: {
                            Image(systemName: "bookmark.fill").font(.system(size: 17, weight: .medium))
                                .foregroundStyle(LinearGradient(colors: [
                                    Color(red: 188 / 255.0, green: 231 / 255.0, blue: 132 / 255.0),
                                    Color(red: 93 / 255.0, green: 211 / 255.0, blue: 158 / 255.0),
                                    Color(red: 52 / 255.0, green: 138 / 255.0, blue: 167 / 255.0)
                                ], startPoint: .topLeading, endPoint: .bottomTrailing))
                                .frame(width: 44, height: 48).contentShape(Circle()).glassEffect(chromeGlass, in: .circle)
                        }.buttonStyle(.plain).disabled(extracting || sync?.online == false || workspace.browser.loading || workspace.browser.error != nil)
                            .accessibilityLabel(workspace.browser.isPDF ? "保存 PDF" : "保存网页").accessibilityIdentifier("browser-magic-save")
                    }
                    more
                }
            }
        }.overlay(alignment: .topTrailing) {
            if !editingAddress {
                annotationBadge.allowsHitTesting(false).accessibilityHidden(true)
            }
        }.frame(maxWidth: 720).tint(.primary)
            .animation(motion, value: editingAddress).animation(motion, value: workspace.current.id)
    }
    private var addressControl: some View {
        HStack(spacing: 8) {
            if editingAddress {
                BrowserAddressField(address: address, editor: addressEditor, submit: submitAddress, search: { query in
                    finishEditing()
                    workspace.search(query)
                }, draftChanged: { addressQuery = $0 }).frame(height: 48)
            } else {
                Button(action: beginEditing) {
                    HStack(spacing: 6) {
                        Group {
                            if case .document(let document) = workspace.current.resource { BrowserTextIcon(text: document.text) }
                            else if let id = webBookmarkID, let text = workspace.documents[id]?.text { BrowserTextIcon(text: text) }
                            else { Image(systemName: workspace.current.symbol) }
                        }.foregroundStyle(.secondary)
                        Text(LeximoryTypography.scaledChineseText(workspace.addressLabel, size: addressTextSize))
                            .lineLimit(1).truncationMode(.middle)
                    }.frame(maxWidth: .infinity, minHeight: 48).contentShape(Capsule())
                }.buttonStyle(.plain).accessibilityLabel("地址").accessibilityIdentifier("browser-address")
            }
        }.addressFont().padding(.horizontal, 12).frame(maxWidth: .infinity, minHeight: 48)
            .simultaneousGesture(DragGesture(minimumDistance: 35).onEnded { value in
                guard !editingAddress, abs(value.translation.width) > 60 else { return }
                let distance = value.translation.width > 0 ? -1 : 1
                guard workspace.canSwipe(distance) else { return }
                workspace.go(distance)
            })
    }
    private var more: some View {
        Menu {
            if isHome {
                Section {
                    Button("主页壁纸", systemImage: "photo") { editingWallpaper = true }
                        .accessibilityIdentifier("browser-home-wallpaper")
                }
            }
            if case .document(let document) = workspace.current.resource, document.library.owned && !document.library.shadow {
                Section {
                    Button("编辑", systemImage: "pencil") { editingText = workspace.documents[document.text.id]?.text ?? document.text }
                        .disabled(sync?.online == false).accessibilityIdentifier("browser-edit-text")
                }
            }
            if let pin = workspace.currentPin, guest == nil || workspace.current.isWeb {
                Section {
                    if workspace.current.isWeb {
                        Button("在网页中查找", systemImage: "magnifyingglass") {
                            beginFind(workspace.browser.web.findInteraction)
                        }
                    } else if let reader = workspace.ebookReader, workspace.ebookTextID == workspace.current.textID,
                              reader.format == "pdf", reader.canFind {
                        Button("在 PDF 中查找", systemImage: "magnifyingglass") { beginFind(reader.findInteraction) }
                    }
                    Button("固定到主页", systemImage: "pin") { editingPin = pin }
                    if workspace.current.isWeb, workspace.browser.recoveryURL != nil {
                        Button(workspace.browser.loading ? "停止" : "重新加载", systemImage: workspace.browser.loading ? "xmark" : "arrow.clockwise") {
                            if workspace.browser.loading { workspace.browser.web.stopLoading() } else { workspace.browser.reload() }
                        }
                    }
                }
            }
            if workspace.current.isWeb, let url = workspace.browser.recoveryURL {
                Section {
                    ShareLink(item: url) { Label("分享", systemImage: "square.and.arrow.up") }
                    Button("在 Safari 中打开", systemImage: "safari") { externalURL = url }
                }
            }
            if case .document(let document) = workspace.current.resource, document.text.format == "ebook" {
                Section {
                    if let reader = workspace.ebookReader, workspace.ebookTextID == document.text.id,
                       let file = reader.export(title: workspace.documents[document.text.id]?.text.title ?? document.text.title) {
                        ShareLink(item: file, preview: SharePreview(file.filename)) {
                            Label("导出电子书", systemImage: "square.and.arrow.up")
                        }.accessibilityIdentifier("browser-export-ebook")
                    } else {
                        Button("导出电子书", systemImage: "square.and.arrow.up") {}.disabled(true)
                    }
                }
            }
            Section {
                if !workspace.current.isAccount {
                    Button("账号", systemImage: "person.crop.circle") {
                        finishEditing()
                        if guest != nil { session?.entry = AccountEntryContext() }
                        else { workspace.visit(.account) }
                    }
                        .accessibilityIdentifier("browser-account")
                }
                if guest == nil {
                    Button { activitySheet = true } label: {
                        Label { Text("文章注释队列") } icon: { annotationQueueIcon }
                    }
                    .accessibilityValue(annotationActivityValue)
                }
                if let session, guest != nil, session.deletion.accepted {
                    Button("账号删除状态", systemImage: "person.crop.circle.badge.minus") { session.deletion.presented = true }
                }
                Button("广告拦截", systemImage: "hand.raised") { adBlockingSettings = true }
                    .accessibilityIdentifier("browser-ad-blocking")
                Picker(selection: $searchEngine) {
                    ForEach(BrowserSearchEngine.allCases) { engine in Text(engine.name).tag(engine) }
                } label: {
                    Label("搜索引擎", systemImage: "slider.horizontal.3")
                }.pickerStyle(.menu)
            }
            if workspace.current.isWeb {
                Section {
                    Button(role: .destructive) { confirmingClear = true } label: {
                        Label { Text("清除浏览数据") } icon: {
                            Image(uiImage: UIImage(systemName: "trash")?.withTintColor(.systemRed, renderingMode: .alwaysOriginal) ?? UIImage())
                                .renderingMode(.original)
                        }.foregroundStyle(.red)
                    }
                }
            }
        } label: { moreLabel }
        .menuOrder(.fixed)
        .buttonStyle(.plain).accessibilityLabel("更多")
            .accessibilityIdentifier("browser-more")
            .accessibilityValue(annotationActivityValue)
    }
    private var moreLabel: some View {
        Image(systemName: "ellipsis").font(.system(size: 17, weight: .medium)).frame(width: 44, height: 48).contentShape(Circle())
            .glassEffect(chromeGlass, in: .circle)
    }
    private var annotationActivityValue: String {
        workspace.readyCount > 0 ? "\(workspace.readyCount) 篇预注释已完成" : workspace.hasPending ? "正在预注释" : ""
    }
    private var annotationQueueIcon: Image {
        guard workspace.readyCount > 0 || workspace.hasPending else { return Image(systemName: "tray") }
        let renderer = ImageRenderer(content:
            Image(systemName: "tray")
                .font(.system(size: 22)).foregroundStyle(.primary)
                .frame(width: 34, height: 32, alignment: .bottomLeading)
                .overlay(alignment: .topTrailing) { annotationBadge.fixedSize() }
                .environment(\.colorScheme, colorScheme)
        )
        renderer.scale = displayScale
        guard let image = renderer.uiImage else { return Image(systemName: "tray") }
        return Image(uiImage: image).renderingMode(.original)
    }
    @ViewBuilder private var annotationBadge: some View {
        if workspace.readyCount > 0 {
            Text(workspace.readyCount > 99 ? "99+" : "\(workspace.readyCount)").interfaceFont(11, semibold: true, style: .caption2)
                .foregroundStyle(.white).padding(.horizontal, 5).frame(minWidth: 18, minHeight: 18).background(.red, in: .capsule)
        } else if workspace.hasPending {
            Circle().fill(.red).frame(width: 8, height: 8).padding(3)
        }
    }
    private func chromeButton(_ title: String, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { Image(systemName: symbol).font(.system(size: 17, weight: .medium)).frame(width: 44, height: 48).contentShape(Circle()).glassEffect(chromeGlass, in: .circle).glassEffectID(title, in: chromeNamespace) }
            .buttonStyle(.plain).accessibilityLabel(title)
    }
    private func beginEditing() {
        if case .web(let page) = workspace.current.resource { address = page.url.absoluteString } else { address = "" }
        addressQuery = address
        withAnimation(motion) { editingAddress = true }
    }
    private func finishEditing() {
        addressEditor.field?.wantsFocus = false
        editingAddress = false
        addressEditor.field?.resignFirstResponder()
    }
    private func openClipboard() {
        let input = UIPasteboard.general.string ?? UIPasteboard.general.url?.absoluteString
        guard let input, let url = TextBrowserModel.address(input), let host = url.host,
              host.contains(".") || host == "localhost" || host.contains(":") else {
            withAnimation(motion) { clipboardNotice = UUID() }
            UIAccessibility.post(notification: .announcement, argument: "不是有效网页链接")
            return
        }
        clipboardNotice = nil
        finishEditing(); workspace.openURL(url)
    }
    private func submitAddress() {
        guard let url = TextBrowserModel.destination(addressEditor.field?.text ?? address, engine: searchEngine) else { return }
        finishEditing(); workspace.openURL(url)
    }
    private func extract() async {
        guard guest == nil else { session?.entry = AccountEntryContext(purpose: .cloudLibrary); return }
        workspace.error = nil
        extracting = true
        defer { extracting = false }
        let resourceID = workspace.current.id
        let navigationID = workspace.browser.navigationID
        let pdf = workspace.browser.isPDF
        do {
            if pdf {
                let file = try await workspace.browser.pdfFile()
                guard workspace.current.id == resourceID, workspace.browser.navigationID == navigationID else { return }
                importRequest = BrowserImportRequest(source: .pdf(file))
                return
            }
            var draft = try await workspace.browser.extractArticle()
            guard workspace.current.id == resourceID, workspace.browser.navigationID == navigationID else { return }
            if let id = webBookmarkID { draft.sourceFolderID = workspace.documents[id]?.library.id }
            importRequest = BrowserImportRequest(source: .article(draft))
        }
        catch {
            guard workspace.current.id == resourceID, workspace.browser.navigationID == navigationID,
                  !Task.isCancelled, !(error is CancellationError), (error as? URLError)?.code != .cancelled else { return }
            if pdf { workspace.error = .savePDF(oversized: (error as? URLError)?.code == .dataLengthExceedsMaximum) }
            else if let url = workspace.browser.url {
                var draft = BrowserArticleDraft(url: url, title: workspace.browser.title.isEmpty ? url.host ?? "网页" : workspace.browser.title,
                    content: "", extractionFailed: true)
                if let id = webBookmarkID { draft.sourceFolderID = workspace.documents[id]?.library.id }
                importRequest = BrowserImportRequest(source: .article(draft))
            }
        }
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
            }.overlay { if workspace.activities.isEmpty { LeximoryUnavailableView("暂无预注释文章", systemImage: "sparkles") } }
                .navigationTitle("文章注释队列").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        LeximorySheetCloseButton { dismiss() }.accessibilityIdentifier("annotation-activity-close")
                    }
                }
        }.leximorySheetStyle().presentationDetents([.medium, .large])
    }
}

@MainActor private final class BrowserFindDismissal {
    private let backdrop = UIControl()

    init(interaction: UIFindInteraction) {
        guard let window = interaction.view?.window else { return }
        backdrop.frame = window.bounds
        backdrop.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        backdrop.backgroundColor = UIColor.black.withAlphaComponent(0.18)
        backdrop.isAccessibilityElement = true
        backdrop.accessibilityTraits = .button
        backdrop.accessibilityLabel = "关闭查找"
        backdrop.accessibilityIdentifier = "browser-find-backdrop"
        backdrop.addAction(UIAction { [weak interaction] _ in interaction?.dismissFindNavigator() }, for: .touchUpInside)
        window.addSubview(backdrop)
    }
    func stop() { backdrop.removeFromSuperview() }
}
