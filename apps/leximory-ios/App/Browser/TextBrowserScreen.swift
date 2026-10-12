import SwiftUI
import LeximoryCore

struct TextBrowserScreen: View {
    let client: MobileClient
    var bookmarkID: String? = nil
    var initialURL: String? = nil
    var sessionKey: String? = nil
    var homeURL: String? = "https://www.cgtn.com"
    var close: (() -> Void)? = nil
    @State private var chromeLayout = BrowserChromeLayout()
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
            finishEditing()
            browser.web.stopLoading()
            browser.web.lookup = nil
            browser = TextBrowserModel()
            browser.web.lookup = { selection in define(selection) }
            opened = true
            address = ""
            definition = nil
            lastSelection = nil
        }
    }
    private var page: some View {
        ZStack(alignment: .top) {
            BrowserWebContent(model: browser).frame(maxWidth: .infinity, maxHeight: .infinity)
                .ignoresSafeArea(.container, edges: .bottom)
                .ignoresSafeArea(.keyboard)
            if browser.url == nil && !browser.loading && !editingAddress {
                LeximoryUnavailableView("浏览网页", systemImage: "globe", message: "输入网址或关键词，阅读时选中文字即可猫忆查。")
                    .frame(maxHeight: .infinity)
            }
            if let error = browser.error {
                VStack(spacing: 12) {
                    Text(error).font(.callout)
                    Button("重试") {
                        if browser.url == nil { opened = false; openingAttempt += 1 }
                        else { browser.web.reload() }
                    }
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
                DefinitionTopTray(item: definition, client: client, language: "English",
                    configureBrowser: bookmarkID == nil ? {
                        settingsFromDefinition = true
                        settings = true
                    } : nil) {
                        self.definition = nil
                        lastSelection = nil
                    }
                    .id(definition.id)
            }
        }
        .background(Color(uiColor: browser.pageColor).ignoresSafeArea())
        .overlay(alignment: .bottom) {
            if UIDevice.current.userInterfaceIdiom == .phone {
                GeometryReader { geometry in
                    let row = chromeLayout.controls(in: geometry.size, editing: editingAddress, hasTabs: bookmarkID == nil)
                    controls.frame(width: row.width, height: 48)
                        .position(x: row.midX, y: row.midY)
                        .animation(motion, value: chromeLayout.isMinimized)
                        .animation(reduceMotion ? nil : .easeOut(duration: 0.25), value: chromeLayout.keyboardFrame)
                }
                .ignoresSafeArea(.container, edges: .bottom)
                .background(BrowserChromeProbe(layout: $chromeLayout).allowsHitTesting(false))
            } else { controls.padding(.horizontal, 16).padding(.bottom, 8) }
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
                browser.web.loadHTMLString("<html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head><body style=\"font:20px/1.7 Georgia;margin:24px\"><h1>A quiet forest</h1>\(paragraphs)</body></html>", baseURL: URL(string: "https://browser-fixture.invalid"))
                return
            }
            #endif
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
                        .font(LeximoryTypography.interface(15)).frame(minWidth: 44, minHeight: 48)
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
                        Text(browser.url?.host ?? "输入网址或搜索").lineLimit(1)
                    }.frame(maxWidth: .infinity, minHeight: 48).contentShape(Capsule())
                }.buttonStyle(.plain).accessibilityLabel("地址").accessibilityIdentifier("browser-address")
            }
        }.font(LeximoryTypography.interface(15)).frame(maxWidth: .infinity, minHeight: 48)
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
        guard let url = TextBrowserModel.destination(address) else { return }
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
        field.placeholder = "输入网址或搜索"
        field.font = UIFontMetrics(forTextStyle: .subheadline).scaledFont(for: LeximoryTypography.interfaceUI(15))
        field.adjustsFontForContentSizeCategory = true
        field.keyboardType = .webSearch
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

private struct BrowserChromeLayout: Equatable {
    var tabFrame = CGRect.zero
    var keyboardFrame = CGRect.zero
    var bottomInset: CGFloat = 0
    var isMinimized: Bool { tabFrame.width > 0 && tabFrame.width < tabFrame.height * 1.5 }

    func controls(in size: CGSize, editing: Bool, hasTabs: Bool) -> CGRect {
        let keyboardVisible = keyboardFrame.height > 100
        let inline = hasTabs && !editing && !keyboardVisible && isMinimized
        var left: CGFloat = 16
        var right = size.width - 16
        var centerY = size.height - bottomInset - 32
        if hasTabs && tabFrame.width > 0 {
            if inline {
                if tabFrame.midX < size.width / 2 { left = tabFrame.maxX + 12 }
                else { right = tabFrame.minX - 12 }
                centerY = tabFrame.midY
            } else { centerY = tabFrame.minY - 32 }
        }
        if keyboardVisible { centerY = min(centerY, keyboardFrame.minY - 32) }
        if editing { centerY = min(centerY, size.height - bottomInset - 32) }
        return CGRect(x: left, y: max(24, centerY) - 24, width: max(48, right - left), height: 48)
    }
}

private struct BrowserChromeProbe: UIViewRepresentable {
    @Binding var layout: BrowserChromeLayout
    func makeUIView(context: Context) -> ProbeView {
        let view = ProbeView()
        view.isUserInteractionEnabled = false
        view.changed = { layout = $0 }
        return view
    }
    func updateUIView(_ uiView: ProbeView, context: Context) { uiView.changed = { layout = $0 } }
    static func dismantleUIView(_ uiView: ProbeView, coordinator: ()) { uiView.stop() }

    final class ProbeView: UIView {
        var changed: ((BrowserChromeLayout) -> Void)?
        private var displayLink: CADisplayLink?
        private var lastLayout = BrowserChromeLayout()
        private weak var tabs: UITabBarController?
        private final class TickTarget: NSObject {
            weak var view: ProbeView?
            @objc func tick() { view?.measure() }
        }
        override func didMoveToWindow() {
            super.didMoveToWindow()
            stop()
            guard window != nil else { return }
            keyboardLayoutGuide.followsUndockedKeyboard = true
            let target = TickTarget()
            target.view = self
            let link = CADisplayLink(target: target, selector: #selector(TickTarget.tick))
            link.preferredFrameRateRange = CAFrameRateRange(minimum: 30, maximum: 60, preferred: 60)
            link.add(to: .main, forMode: .common)
            displayLink = link
        }
        func stop() { displayLink?.invalidate(); displayLink = nil }
        private func findTabs(in controller: UIViewController) -> UITabBarController? {
            if let tabs = controller as? UITabBarController { return tabs }
            for child in controller.children {
                if let tabs = findTabs(in: child) { return tabs }
            }
            return nil
        }
        private func navigationControls(in view: UIView, titles: Set<String>) -> [UIControl] {
            let opacity = view.layer.presentation()?.opacity ?? Float(view.alpha)
            guard !view.isHidden, opacity > 0.01 else { return [] }
            if let control = view as? UIControl, let label = control.accessibilityLabel,
               titles.contains(where: { label.contains($0) }) { return [control] }
            return view.subviews.flatMap { navigationControls(in: $0, titles: titles) }
        }
        private func visibleFrame(of view: UIView) -> CGRect {
            let destination = layer.presentation() ?? layer
            let source = view.layer.presentation() ?? view.layer
            var rect = source.convert(source.bounds, to: destination)
            var ancestor = view.superview
            while let parent = ancestor {
                if parent.clipsToBounds {
                    let clip = parent.layer.presentation() ?? parent.layer
                    rect = rect.intersection(clip.convert(clip.bounds, to: destination))
                }
                ancestor = parent.superview
            }
            return rect
        }
        private func measure() {
            guard let window else { return }
            if tabs == nil, let root = window.rootViewController { tabs = findTabs(in: root) }
            var frame = CGRect.zero
            if let tabs {
                let titles = Set((tabs.tabBar.items ?? []).compactMap(\.title))
                let targets = navigationControls(in: tabs.view, titles: titles)
                for target in targets {
                    let rect = visibleFrame(of: target)
                    guard !rect.isNull, rect.width > 10, rect.height > 10 else { continue }
                    frame = frame == .zero ? rect : frame.union(rect)
                }
                if frame == .zero, !tabs.tabBar.isHidden { frame = tabs.tabBar.convert(tabs.tabBar.bounds, to: self) }
            }
            let next = BrowserChromeLayout(tabFrame: frame, keyboardFrame: keyboardLayoutGuide.layoutFrame, bottomInset: safeAreaInsets.bottom)
            guard next != lastLayout else { return }
            lastLayout = next
            changed?(next)
        }
    }
}
