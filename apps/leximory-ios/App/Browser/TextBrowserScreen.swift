import SwiftUI
import LeximoryCore

struct TextBrowserScreen: View {
    let client: MobileClient
    var bookmarkID: String? = nil
    var initialURL: String? = nil
    var close: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var browser = TextBrowserModel()
    @State private var address = ""
    @State private var editingAddress = false
    @State private var settings = false
    @State private var savingBookmark = false
    @State private var definition: DefinitionPresentation?
    @State private var lookup: Task<Void, Never>?
    @State private var resolving = false
    @State private var selectedLibraryID: String?
    @State private var selectedDomain = ""
    @State private var lookupError: String?
    @State private var openingAttempt = 0
    @State private var lastSelection: BrowserSelection?
    @FocusState private var addressFocused: Bool

    var body: some View {
        ZStack(alignment: .top) {
            BrowserWebContent(model: browser).frame(maxWidth: .infinity, maxHeight: .infinity)
                .ignoresSafeArea(.container, edges: .bottom)
            if browser.url == nil && !browser.loading && !editingAddress {
                ContentUnavailableView("浏览网页", systemImage: "globe", description: Text("输入网址，阅读时选中文字即可猫忆查。"))
                    .frame(maxHeight: .infinity)
            }
            if let error = browser.error {
                VStack(spacing: 12) {
                    Text(error).font(.callout)
                    Button("重试") {
                        if browser.url == nil { openingAttempt += 1 }
                        else { browser.web.reload() }
                    }
                }.padding(20).background(LeximoryPalette.paper, in: RoundedRectangle(cornerRadius: 24))
                    .padding(.top, 70)
            }
            HStack {
                Button { if let close { close() } else { dismiss() } } label: { chromeIcon("xmark") }
                    .buttonStyle(.plain).accessibilityLabel("关闭")
                Spacer()
                if resolving { ProgressView().padding(12).glassEffect(in: .circle) }
            }.padding(.horizontal, 16).padding(.top, 8)
            if let definition, case .browser(_, let target) = definition.source {
                DefinitionTopTray(item: definition, client: client, language: target.displayLanguage,
                    configureBrowser: bookmarkID == nil ? { settings = true } : nil) { self.definition = nil }
                    .id(definition.id)
            }
        }
        .overlay(alignment: .bottom) { controls.padding(.horizontal, 16).padding(.bottom, 8) }
        .toolbar(.hidden, for: .navigationBar).toolbar(.hidden, for: .tabBar)
        .sheet(isPresented: $editingAddress) { addressSheet }
        .sheet(isPresented: $settings) {
            BrowserPreferencesView(client: client, domain: browser.domain, bookmarkMode: bookmarkID != nil,
                selectedLibraryID: selectedLibraryID) { libraryID in
                    selectedLibraryID = libraryID; selectedDomain = browser.domain
                    if let lastSelection { define(lastSelection) }
                }
        }
        .sheet(isPresented: $savingBookmark) {
            BrowserBookmarkSheet(client: client, url: browser.url?.absoluteString ?? "")
        }
        .alert("猫忆查暂时不可用", isPresented: Binding(get: { lookupError != nil }, set: { if !$0 { lookupError = nil } })) {
            Button("重试") { if let lastSelection { define(lastSelection) } }
            Button("取消", role: .cancel) { lookupError = nil }
        } message: { Text(lookupError ?? "") }
        .task(id: openingAttempt) {
            browser.web.lookup = { selection in define(selection) }
            if let initialURL, let url = TextBrowserModel.address(initialURL) { browser.load(url) }
            else if let bookmarkID {
                do {
                    let details = try await client.documentDetails(textID: bookmarkID)
                    guard !Task.isCancelled else { return }
                    guard let url = details.text.bookmarkURL.flatMap(TextBrowserModel.address) else {
                        browser.error = "书签网址无法打开。"; return
                    }
                    browser.load(url)
                } catch { browser.error = "书签暂时无法打开，请重试。" }
            } else { address = ""; editingAddress = true }
        }
        .onChange(of: browser.navigationID) { _, _ in
            lookup?.cancel(); resolving = false; definition = nil; lastSelection = nil; lookupError = nil
        }
        .onChange(of: browser.domain) { _, domain in
            if domain != selectedDomain { selectedLibraryID = nil }
        }
        .onDisappear { lookup?.cancel(); browser.web.stopLoading() }
    }
    private var controls: some View {
        GlassEffectContainer(spacing: 10) {
            HStack(spacing: 10) {
                Button { browser.web.goBack() } label: { chromeIcon("chevron.left") }
                    .buttonStyle(.plain).accessibilityLabel("后退").disabled(!browser.canGoBack)
                Button {
                    address = browser.url?.absoluteString ?? ""; editingAddress = true
                } label: {
                    HStack(spacing: 8) {
                        if browser.loading { ProgressView().controlSize(.small) }
                        else { Image(systemName: "globe") }
                        Text(browser.url?.host ?? "输入网址").lineLimit(1)
                    }.font(.subheadline).frame(maxWidth: .infinity, minHeight: 48)
                        .padding(.horizontal, 12)
                }.buttonStyle(.plain).glassEffect(.regular.tint(LeximoryPalette.paper.opacity(0.8)).interactive(), in: .capsule)
                    .accessibilityLabel("地址").accessibilityIdentifier("browser-address")
                Menu {
                    Button("前进", systemImage: "chevron.right") { browser.web.goForward() }.disabled(!browser.canGoForward)
                    Button(browser.loading ? "停止" : "重新加载", systemImage: browser.loading ? "xmark" : "arrow.clockwise") {
                        if browser.loading { browser.web.stopLoading() } else { browser.web.reload() }
                    }
                    if let url = browser.url {
                        ShareLink(item: url) { Label("分享", systemImage: "square.and.arrow.up") }
                        Button("存为书签", systemImage: "bookmark") { savingBookmark = true }
                        Button("在 Safari 中打开", systemImage: "safari") { openURL(url) }
                    }
                    Button("词汇收藏设置", systemImage: "book.closed") { settings = true }.disabled(browser.url == nil)
                } label: { chromeIcon("ellipsis") }
                    .buttonStyle(.plain).accessibilityLabel("网页选项")
            }
        }.frame(maxWidth: 640).tint(LeximoryPalette.ink)
    }
    private func chromeIcon(_ symbol: String) -> some View {
        Image(systemName: symbol).font(.system(size: 17))
            .foregroundStyle(LeximoryPalette.ink).frame(width: 44, height: 44)
            .glassEffect(.regular.tint(LeximoryPalette.paper.opacity(0.8)).interactive(), in: .circle)
            .contentShape(Circle())
    }
    private var addressSheet: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                TextField("输入网址", text: $address)
                    .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                    .submitLabel(.go).focused($addressFocused).onSubmit(openAddress)
                    .padding(16).background(LeximoryPalette.shell, in: RoundedRectangle(cornerRadius: 18))
                Button("打开网页", action: openAddress).buttonStyle(.glassProminent)
                    .disabled(TextBrowserModel.address(address) == nil)
            }.padding(24).navigationTitle("浏览网页").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { editingAddress = false } } }
                .task { addressFocused = true }
        }.presentationDetents([.height(220)])
    }
    private func openAddress() {
        guard let url = TextBrowserModel.address(address) else { return }
        editingAddress = false
        browser.load(url)
    }
    private func define(_ selection: BrowserSelection) {
        lookup?.cancel(); definition = nil; resolving = true; lastSelection = selection; lookupError = nil
        let navigation = browser.navigationID
        lookup = Task {
            defer { if browser.navigationID == navigation && !Task.isCancelled { resolving = false } }
            do {
                let target = try await client.browserSelection(url: selection.url, quote: selection.quote,
                    context: selection.context, offset: selection.offset, bookmarkID: bookmarkID, libraryID: selectedLibraryID)
                guard !Task.isCancelled, browser.navigationID == navigation else { return }
                definition = DefinitionPresentation(source: .browser(quote: selection.quote, target: target), definition: nil)
            } catch {
                if !Task.isCancelled { lookupError = (MobileClient.cause(of: error) as? MobileFailure)?.error.message ?? "请重试。" }
            }
        }
    }
}
