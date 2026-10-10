import SwiftUI
import LeximoryCore

struct TextBrowserScreen: View {
    let client: MobileClient
    var bookmarkID: String? = nil
    var initialURL: String? = nil
    var sessionKey: String? = nil
    var homeURL: String? = "https://www.cgtn.com"
    var close: (() -> Void)? = nil
    @Environment(\.browserActive) private var active
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Namespace private var chrome
    @State private var opened = false
    @State private var addressEditor = BrowserAddressEditor()
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var browser = TextBrowserModel()
    @State private var address = ""
    @State private var editingAddress = false
    @State private var settings = false
    @State private var savingBookmark = false
    @State private var definition: DefinitionPresentation?
    @State private var selectedLibraryID: String?
    @State private var selectedDomain = ""
    @State private var openingAttempt = 0
    @State private var lastSelection: BrowserSelection?

    var body: some View {
        Group {
            if active { page }
        }
        .onChange(of: scenePhase) { _, phase in if phase != .active { rememberPage() } }
        .onChange(of: active) { _, active in
            if !active { finishEditing() }
        }
    }
    private var page: some View {
        ZStack(alignment: .top) {
            BrowserWebContent(model: browser).frame(maxWidth: .infinity, maxHeight: .infinity)
                .ignoresSafeArea(.container, edges: .bottom)
                .ignoresSafeArea(.keyboard)
            if browser.url == nil && !browser.loading && !editingAddress {
                ContentUnavailableView("浏览网页", systemImage: "globe", description: Text("输入网址，阅读时选中文字即可猫忆查。"))
                    .frame(maxHeight: .infinity)
            }
            if let error = browser.error {
                VStack(spacing: 12) {
                    Text(error).font(.callout)
                    Button("重试") {
                        if browser.url == nil { opened = false; openingAttempt += 1 }
                        else { browser.web.reload() }
                    }
                }.padding(20).background(LeximoryPalette.paper, in: RoundedRectangle(cornerRadius: 24))
                    .padding(.top, 70)
            }
            if editingAddress {
                Color.black.opacity(0.12).ignoresSafeArea()
                    .onTapGesture { finishEditing() }
                    .transition(.opacity)
            }
            if let definition {
                DefinitionTopTray(item: definition, client: client, language: "English",
                    configureBrowser: bookmarkID == nil ? { settings = true } : nil) { self.definition = nil }
                    .id(definition.id)
            }
        }
        .overlay(alignment: .bottom) { controls.padding(.horizontal, 16).padding(.bottom, 8) }
        .toolbar(.hidden, for: .navigationBar).toolbar(.hidden, for: .tabBar)
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
        .task(id: openingAttempt) {
            browser.web.lookup = { selection in define(selection) }
            guard !opened else { return }
            opened = true
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
            } else if let saved = savedPage, let url = TextBrowserModel.address(saved.url) {
                browser.load(url, offset: saved.offset)
            } else if let homeURL, let url = TextBrowserModel.address(homeURL) {
                browser.load(url)
            }
        }
        .onChange(of: browser.url) { _, _ in rememberPage() }
        .onChange(of: browser.navigationID) { _, _ in
            definition = nil; lastSelection = nil
        }
        .onChange(of: browser.domain) { _, domain in
            if domain != selectedDomain { selectedLibraryID = nil }
        }
        .onDisappear { rememberPage(); browser.web.stopLoading() }
    }
    private var motion: Animation? {
        reduceMotion ? .easeOut(duration: 0.15) : .spring(response: 0.42, dampingFraction: 0.86)
    }
    private var controls: some View {
        GlassEffectContainer(spacing: 8) {
            HStack(spacing: 8) {
                if !editingAddress {
                    Button { if let close { close() } else { dismiss() } } label: { chromeIcon("xmark") }
                        .buttonStyle(.plain).accessibilityLabel("关闭")
                        .glassEffectID("close", in: chrome)
                        .transition(.opacity.combined(with: .scale(scale: 0.85)))
                    if browser.canGoBack {
                        Button { browser.web.goBack() } label: { chromeIcon("chevron.left") }
                            .buttonStyle(.plain).accessibilityLabel("后退")
                            .glassEffectID("back", in: chrome)
                            .transition(.opacity.combined(with: .scale(scale: 0.85)))
                    }
                }
                addressControl
                    .glassEffect(.regular.interactive(), in: .capsule)
                    .glassEffectID("address", in: chrome)
                if editingAddress {
                    Button("取消") { finishEditing() }
                        .font(LeximoryTypography.prose(15)).frame(minWidth: 44, minHeight: 48)
                        .padding(.horizontal, 8).buttonStyle(.plain)
                        .glassEffect(.regular.interactive(), in: .capsule)
                        .glassEffectID("options", in: chrome)
                } else {
                    Menu {
                        if let url = browser.url {
                            Section {
                                ShareLink(item: url) { Label("分享", systemImage: "square.and.arrow.up") }
                                Button("存为书签", systemImage: "bookmark") { savingBookmark = true }
                                Button("在 Safari 中打开", systemImage: "safari") { openURL(url) }
                            }
                        }
                        if bookmarkID == nil {
                            Section {
                                Button("词汇收藏设置", systemImage: "book.closed") { settings = true }
                                    .disabled(browser.url == nil)
                            }
                        }
                        Section {
                            Button(browser.loading ? "停止" : "重新加载", systemImage: browser.loading ? "xmark" : "arrow.clockwise") {
                                if browser.loading { browser.web.stopLoading() } else { browser.web.reload() }
                            }.disabled(browser.url == nil)
                            if browser.canGoForward {
                                Button("前进", systemImage: "chevron.right") { browser.web.goForward() }
                            }
                        }
                    } label: { chromeIcon("ellipsis") }
                        .buttonStyle(.plain).accessibilityLabel("网页选项")
                        .glassEffectID("options", in: chrome)
                }
            }
        }.frame(maxWidth: 640).tint(.primary)
            .animation(motion, value: editingAddress)
            .animation(motion, value: browser.canGoBack)
    }
    private var addressControl: some View {
        HStack(spacing: 8) {
            if editingAddress {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                BrowserAddressField(address: $address, editor: addressEditor, submit: openAddress)
                    .frame(maxWidth: .infinity).frame(height: 48)
            } else {
                Button {
                    address = browser.url?.absoluteString ?? ""
                    withAnimation(motion) { editingAddress = true }
                } label: {
                    HStack(spacing: 8) {
                        if browser.loading { ProgressView().controlSize(.small) }
                        else { Image(systemName: "globe").foregroundStyle(.secondary) }
                        Text(browser.url?.host ?? "输入网址").lineLimit(1)
                    }.frame(maxWidth: .infinity, minHeight: 48).contentShape(Capsule())
                }.buttonStyle(.plain).accessibilityLabel("地址").accessibilityIdentifier("browser-address")
            }
        }.font(LeximoryTypography.prose(15)).frame(maxWidth: .infinity, minHeight: 48)
            .padding(.horizontal, 14)
            .foregroundStyle(.primary)
    }
    private func chromeIcon(_ symbol: String) -> some View {
        Image(systemName: symbol).font(.system(size: 17, weight: .medium))
            .foregroundStyle(.primary).frame(width: 48, height: 48)
            .glassEffect(.regular.interactive(), in: .circle)
            .contentShape(Circle())
    }
    private func finishEditing() {
        addressEditor.field?.resignFirstResponder()
        withAnimation(motion) { editingAddress = false }
    }
    private func openAddress() {
        guard let url = TextBrowserModel.address(address) else { return }
        finishEditing()
        browser.load(url)
    }
    private var savedPage: BrowserSession? {
        guard let sessionKey, let data = UserDefaults.standard.data(forKey: "browser.last-page." + sessionKey) else { return nil }
        return try? JSONDecoder().decode(BrowserSession.self, from: data)
    }
    private func rememberPage() {
        guard bookmarkID == nil, let sessionKey, let url = browser.url else { return }
        let page = BrowserSession(url: url.absoluteString, offset: browser.web.scrollView.contentOffset.y)
        if let data = try? JSONEncoder().encode(page) {
            UserDefaults.standard.set(data, forKey: "browser.last-page." + sessionKey)
        }
    }
    private func define(_ selection: BrowserSelection) {
        lastSelection = selection
        definition = DefinitionPresentation(source: .webpage(id: UUID(), selection: selection,
            bookmarkID: bookmarkID, libraryID: selectedLibraryID), definition: nil)
    }

}

private struct BrowserAddressField: UIViewRepresentable {
    @Binding var address: String
    let editor: BrowserAddressEditor
    let submit: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func makeUIView(context: Context) -> BrowserURLTextField {
        let field = BrowserURLTextField()
        editor.field = field
        field.delegate = context.coordinator
        field.placeholder = "输入网址"
        field.font = UIFontMetrics(forTextStyle: .subheadline).scaledFont(for: LeximoryTypography.proseUI(15))
        field.adjustsFontForContentSizeCategory = true
        field.keyboardType = .URL
        field.autocapitalizationType = .none
        field.autocorrectionType = .no
        field.spellCheckingType = .no
        field.returnKeyType = .go
        field.clearButtonMode = .whileEditing
        field.accessibilityIdentifier = "browser-address-input"
        field.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        field.addTarget(context.coordinator, action: #selector(Coordinator.changed(_:)), for: .editingChanged)
        return field
    }
    func updateUIView(_ field: BrowserURLTextField, context: Context) {
        context.coordinator.parent = self
        if field.text != address { field.text = address }
        field.enablesReturnKeyAutomatically = true
    }
    static func dismantleUIView(_ field: BrowserURLTextField, coordinator: Coordinator) {
        field.resignFirstResponder()
    }
    final class Coordinator: NSObject, UITextFieldDelegate {
        var parent: BrowserAddressField
        init(_ parent: BrowserAddressField) { self.parent = parent }
        @objc func changed(_ field: UITextField) { parent.address = field.text ?? "" }
        func textFieldDidBeginEditing(_ field: UITextField) {
            DispatchQueue.main.async { field.selectAll(nil) }
        }
        func textFieldShouldReturn(_ field: UITextField) -> Bool {
            parent.submit()
            return false
        }
    }
}

private final class BrowserURLTextField: UITextField {
    override func didMoveToWindow() {
        super.didMoveToWindow()
        guard window != nil else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self, self.window != nil else { return }
            self.becomeFirstResponder()
        }
    }
}

private final class BrowserAddressEditor {
    weak var field: UITextField?
}

struct BrowserSession: Codable {
    let url: String
    let offset: CGFloat
}
