import SwiftUI
import LeximoryCore

struct TextBrowserScreen: View {
    @ScaledMetric(relativeTo: .subheadline) private var addressTextSize = LeximoryTypography.addressSize
    let client: MobileClient
    var bookmarkID: String? = nil
    var initialURL: String? = nil
    var sessionKey: String? = nil
    var homeURL: String? = nil
    var sharedBrowser: TextBrowserModel? = nil
    var showsControls = true
    var restoresSession = true
    var close: (() -> Void)? = nil
    @Environment(\.tabBarPlacement) private var tabBarPlacement
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.browserActive) private var active
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Namespace private var chrome
    @State private var opened = false
    @State private var addressEditor = BrowserAddressEditor()
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var localBrowser = BrowserModelStorage()
    private var browser: TextBrowserModel { sharedBrowser ?? localBrowser.model }
    @State private var address = ""
    @AppStorage("browser.searchEngine") private var searchEngine = BrowserSearchEngine.bing
    @State private var editingAddress = false
    @State private var settings = false
    @State private var adBlockingSettings = false
    @State private var settingsFromDefinition = false
    @State private var savingBookmark = false
    @State private var definition: DefinitionPresentation?
    @State private var selectedLibraryID: String?
    @State private var selectedDomain = ""
    @State private var openingAttempt = 0
    @State private var lastSelection: BrowserSelection?
    @State private var confirmingClear = false
    @State private var clearingData = false

    var body: some View {
        Group {
            if active { page }
        }
        .onChange(of: scenePhase) { _, phase in if phase != .active { rememberPage() } }
        .onChange(of: active) { _, active in
            if !active { finishEditing() }
        }
        .onReceive(NotificationCenter.default.publisher(for: TextBrowserModel.browsingDataWillClear)) { _ in
            guard sharedBrowser == nil else { return }
            finishEditing()
            browser.web.stopLoading()
            browser.web.lookup = nil
            localBrowser = BrowserModelStorage()
            browser.web.lookup = { selection in define(selection) }
            opened = true
            address = ""
            definition = nil
            lastSelection = nil
        }
    }
    private var controlsAtTop: Bool { false }
    private var page: some View {
        ZStack(alignment: .top) {
            BrowserWebContent(model: browser, reservesBottomControls: !controlsAtTop).frame(maxWidth: .infinity, maxHeight: .infinity)
                .ignoresSafeArea(.container, edges: .bottom)
                .ignoresSafeArea(.keyboard)
                .backgroundExtensionEffect(isEnabled: controlsAtTop)
            if sharedBrowser == nil && browser.url == nil && !browser.loading && !editingAddress {
                LeximoryUnavailableView("浏览网页", systemImage: "globe", message: "输入网址或关键词，阅读时选中文字即可猫忆查。")
                    .frame(maxHeight: .infinity)
            }
            if let error = browser.error {
                VStack(spacing: 12) {
                    Text(error).interfaceFont(16, style: .callout)
                    Button("重试", systemImage: "arrow.clockwise") {
                        if browser.url == nil { opened = false; openingAttempt += 1 }
                        else { browser.web.reload() }
                    }
                    .interfaceFont(17, style: .body)
                    .buttonStyle(.borderedProminent).buttonBorderShape(.capsule).controlSize(.large)
                    .tint(LeximoryPalette.ink).foregroundStyle(LeximoryPalette.paper)
                    .accessibilityIdentifier("browser-load-retry")
                }.padding(20).foregroundStyle(.primary)
                    .glassEffect(.regular, in: .rect(cornerRadius: 24))
                    .accessibilityIdentifier("browser-load-error")
                    .padding(.top, 70)
            }
            if editingAddress {
                Color.black.opacity(0.12).ignoresSafeArea()
                    .onTapGesture { finishEditing() }
                    .transition(.opacity)
            }
            if let definition {
                DefinitionTopTray(item: definition, client: client, language: "English") {
                    self.definition = nil
                    lastSelection = nil
                }
                    .id(definition.id)
            }
        }
        .background(Color(uiColor: browser.pageColor).ignoresSafeArea())
        .safeAreaInset(edge: .top, spacing: 0) {
            if showsControls && controlsAtTop {
                controls.padding(.horizontal, 16).padding(.vertical, 8)
            }
        }
        .overlay(alignment: .bottom) {
            if showsControls && !controlsAtTop {
                controls.padding(.horizontal, 16).padding(.bottom, 8)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .toolbar(bookmarkID == nil ? .visible : .hidden, for: .tabBar)
        .sheet(isPresented: $settings) {
            BrowserPreferencesView(client: client, domain: browser.domain, bookmarkMode: bookmarkID != nil,
                selectedLibraryID: selectedLibraryID) { libraryID in
                    selectedLibraryID = libraryID; selectedDomain = browser.domain
                    if settingsFromDefinition, definition != nil, let lastSelection { define(lastSelection) }
                }
        }
        .sheet(isPresented: $savingBookmark) {
            BrowserBookmarkSheet(client: client, url: browser.url?.absoluteString ?? "")
        }
        .sheet(isPresented: $adBlockingSettings) {
            BrowserAdBlockingSettings(blocker: browser.adBlocker, browser: browser)
        }
        .confirmationDialog("清除所有浏览数据？", isPresented: $confirmingClear, titleVisibility: .visible) {
            Button("清除浏览数据", role: .destructive) {
                Task {
                    clearingData = true
                    await TextBrowserModel.clearBrowsingData()
                    clearingData = false
                }
            }
            Button("取消", role: .cancel) {}
        } message: {
            Text("将清除浏览记录、Cookie 和网站数据，并退出网站登录。书签和词汇会保留。")
        }
        .task(id: openingAttempt) {
            browser.web.lookup = { selection in define(selection) }
            guard !opened else { return }
            opened = true
            #if DEBUG && targetEnvironment(simulator)
            if ProcessInfo.processInfo.arguments.contains("--browser-chrome-fixture") {
                let paragraphs = String(repeating: "<p>We followed the river through the forest, watching the light change beneath the trees.</p>", count: 25)
                browser.web.loadHTMLString("<html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head><body style=\"font:20px/1.7 Georgia;margin:24px\"><header style=\"position:fixed;top:0;left:0;right:0;background:white;height:40px\">Important page controls</header><h1 style=\"margin-top:64px\">A quiet forest</h1>\(paragraphs)</body></html>", baseURL: URL(string: "https://browser-fixture.invalid"))
                return
            }
            #endif
            guard sharedBrowser == nil else { return }
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
            } else if restoresSession, let saved = savedPage, let url = TextBrowserModel.address(saved.url) {
                browser.load(url, offset: saved.offset)
            } else if let homeURL, let url = TextBrowserModel.address(homeURL) {
                browser.load(url)
            }
        }
        .onChange(of: browser.url) { _, _ in rememberPage() }
        .onChange(of: browser.navigationID) { _, _ in
            definition = nil; lastSelection = nil
            browser.web.lookup = { selection in define(selection) }
        }
        .onChange(of: bookmarkID) { _, _ in
            definition = nil; lastSelection = nil
            browser.web.lookup = { selection in define(selection) }
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
                    if bookmarkID != nil {
                        Button { if let close { close() } else { dismiss() } } label: { chromeIcon("xmark") }
                            .buttonStyle(.plain).accessibilityLabel("关闭")
                            .glassEffectID("close", in: chrome)
                            .transition(.opacity.combined(with: .scale(scale: 0.85)))
                    }
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
                        .interfaceFont(15).frame(minWidth: 44, minHeight: 48)
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
                                Button("词汇收藏设置", systemImage: "book.closed") {
                                    settingsFromDefinition = false
                                    settings = true
                                }
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
                        Section {
                            Button("广告拦截", systemImage: "hand.raised") { adBlockingSettings = true }
                                .accessibilityIdentifier("browser-ad-blocking")
                        }
                        Section {
                            Button(role: .destructive) { confirmingClear = true } label: {
                                Label {
                                    Text("清除浏览数据")
                                } icon: {
                                    Image(uiImage: UIImage(systemName: "trash")?.withTintColor(.systemRed, renderingMode: .alwaysOriginal) ?? UIImage())
                                }
                            }
                        }
                    } label: { chromeIcon("ellipsis") }
                        .buttonStyle(.plain).accessibilityLabel("网页选项")
                        .glassEffectID("options", in: chrome)
                }
            }
        }.frame(maxWidth: 640).tint(.primary).disabled(clearingData)
            .animation(motion, value: editingAddress)
            .animation(motion, value: browser.canGoBack)
    }
    private var addressControl: some View {
        HStack(spacing: 8) {
            if editingAddress {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                BrowserAddressField(address: address, editor: addressEditor, submit: openAddress, search: { query in
                    finishEditing()
                    browser.web.search?(query)
                })
                    .frame(maxWidth: .infinity).frame(height: 48)
            } else {
                Button {
                    address = browser.url?.absoluteString ?? ""
                    withAnimation(motion) { editingAddress = true }
                } label: {
                    HStack(spacing: 8) {
                        if browser.loading { ProgressView().controlSize(.small) }
                        else { Image(systemName: "globe").foregroundStyle(.secondary) }
                        Text(LeximoryTypography.scaledChineseText(browser.url?.host ?? "输入网址或搜索", size: addressTextSize)).lineLimit(1)
                    }.frame(maxWidth: .infinity, minHeight: 48).contentShape(Capsule())
                }.buttonStyle(.plain).accessibilityLabel("地址").accessibilityIdentifier("browser-address")
            }
        }.addressFont().frame(maxWidth: .infinity, minHeight: 48)
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
        addressEditor.field?.wantsFocus = false
        addressEditor.field?.resignFirstResponder()
        withAnimation(motion) { editingAddress = false }
    }
    private func openAddress() {
        guard let url = TextBrowserModel.destination(addressEditor.field?.text ?? address, engine: searchEngine) else { return }
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
        guard !browser.loading, browser.error == nil else { return }
        lastSelection = selection
        definition = DefinitionPresentation(source: .webpage(id: UUID(), selection: selection,
            bookmarkID: bookmarkID, libraryID: nil), definition: nil)
    }

}

struct BrowserAddressField: UIViewRepresentable {
    let address: String
    let editor: BrowserAddressEditor
    let submit: () -> Void
    var search: ((String) -> Void)? = nil
    var draftChanged: ((String) -> Void)? = nil

    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func makeUIView(context: Context) -> BrowserURLTextField {
        let field = BrowserURLTextField()
        editor.field = field
        field.delegate = context.coordinator
        field.placeholder = "输入网址或搜索"
        field.font = LeximoryTypography.addressUI
        field.text = address
        field.adjustsFontForContentSizeCategory = true
        field.keyboardType = .default
        field.autocapitalizationType = .none
        field.autocorrectionType = .no
        field.spellCheckingType = .no
        field.returnKeyType = .search
        field.enablesReturnKeyAutomatically = true
        field.clearButtonMode = .whileEditing
        field.accessibilityIdentifier = "browser-address-input"
        field.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        field.addTarget(context.coordinator, action: #selector(Coordinator.changed(_:)), for: .editingChanged)
        return field
    }
    func updateUIView(_ field: BrowserURLTextField, context: Context) {
        context.coordinator.parent = self
        // UIKit owns text, selection, and composition until editing ends.
        if !field.isFirstResponder, field.markedTextRange == nil, field.text != address {
            field.text = address
        }
    }
    static func dismantleUIView(_ field: BrowserURLTextField, coordinator: Coordinator) {
        field.wantsFocus = false
        field.resignFirstResponder()
    }
    final class Coordinator: NSObject, UITextFieldDelegate {
        var parent: BrowserAddressField
        init(_ parent: BrowserAddressField) { self.parent = parent }
        @objc func changed(_ field: UITextField) {
            let draft = field.text
            // Publish suggestions after the edit transaction without writing back
            // into the keyboard's text storage or selection.
            DispatchQueue.main.async { [weak field] in
                guard let field, field.isFirstResponder, field.markedTextRange == nil, field.text == draft else { return }
                self.parent.draftChanged?(field.text ?? "")
            }
        }
        func textFieldDidBeginEditing(_ field: UITextField) {
            let initialText = field.text
            DispatchQueue.main.async { [weak field] in
                guard let field, field.isFirstResponder, field.markedTextRange == nil, field.text == initialText else { return }
                field.selectAll(nil)
            }
        }
        func textFieldShouldReturn(_ field: UITextField) -> Bool {
            parent.submit()
            return false
        }
        func textField(_ textField: UITextField, editMenuForCharactersIn range: NSRange, suggestedActions: [UIMenuElement]) -> UIMenu? {
            let text = (textField.text ?? "") as NSString
            let native = ReadingSelectionMenu.removingSystemSearchActions(suggestedActions)
            guard range.location <= text.length, range.length <= text.length - range.location else { return UIMenu(children: native) }
            return UIMenu(children: native + [ReadingSelectionMenu.searchAction(query: text.substring(with: range), perform: parent.search)])
        }
    }
}

final class BrowserURLTextField: UITextField {
    var wantsFocus = true
    private var applyingTypography = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        addTarget(self, action: #selector(applyTypography), for: .editingChanged)
        registerForTraitChanges([UITraitPreferredContentSizeCategory.self]) { (field: BrowserURLTextField, _: UITraitCollection) in
            field.applyTypography()
        }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override var text: String? {
        didSet { applyTypography() }
    }

    override func unmarkText() {
        super.unmarkText()
        applyTypography()
    }

    @objc private func applyTypography() {
        // Never replace the keyboard's marked text during Chinese/Japanese composition.
        guard !applyingTypography, markedTextRange == nil else { return }
        applyingTypography = true
        defer { applyingTypography = false }
        let base = UIFontMetrics(forTextStyle: .subheadline).scaledFont(
            for: LeximoryTypography.editorialUI(LeximoryTypography.addressSize), compatibleWith: traitCollection)
        let styled = LeximoryTypography.scaledChineseInput(text ?? "", size: base.pointSize)
        let current = attributedText ?? NSAttributedString(string: "")
        let formatted = NSMutableAttributedString(attributedString: current)
        var changed = false
        styled.enumerateAttribute(.font, in: NSRange(location: 0, length: styled.length)) { value, range, _ in
            let expected = value as! UIFont
            current.enumerateAttribute(.font, in: range) { value, run, _ in
                let existing = value as? UIFont
                if existing?.fontName != expected.fontName || existing?.pointSize != expected.pointSize {
                    formatted.addAttribute(.font, value: expected, range: run)
                    changed = true
                }
            }
        }
        if changed {
            let selection = selectedTextRange
            attributedText = formatted
            if let selection { selectedTextRange = selection }
        }
        if let placeholder {
            let styledPlaceholder = NSMutableAttributedString(attributedString:
                LeximoryTypography.scaledChineseInput(placeholder, size: base.pointSize))
            styledPlaceholder.addAttribute(.foregroundColor, value: UIColor.placeholderText,
                                           range: NSRange(location: 0, length: styledPlaceholder.length))
            attributedPlaceholder = styledPlaceholder
        }
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        guard window != nil else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self, self.wantsFocus, self.window != nil, !self.isFirstResponder else { return }
            self.becomeFirstResponder()
        }
    }
}

final class BrowserAddressEditor {
    weak var field: BrowserURLTextField?
}

struct BrowserSession: Codable {
    let url: String
    let offset: CGFloat
}

@MainActor private final class BrowserModelStorage {
    // SwiftUI recreates view values frequently. Only create WebKit when this screen
    // actually owns a browser, never for a screen using the workspace's browser.
    lazy var model = TextBrowserModel()
}
