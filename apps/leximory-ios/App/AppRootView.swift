import SwiftUI
import LeximoryCore
#if DEBUG && targetEnvironment(simulator)
import OpenAPIRuntime
import HTTPTypes
#endif

struct AppRootView: View {
    let fixturePlayback: PlaybackController
    @State private var session: AccountSession?
    @State private var livePlayback: PlaybackController?
    @State private var fixtureTab = 0
    private var fixtureClient: MobileClient? = nil
    init(fixturePlayback: PlaybackController) {
        self.fixturePlayback = fixturePlayback
        #if DEBUG && targetEnvironment(simulator)
        if ProcessInfo.processInfo.arguments.contains("--browser-workspace-fixtures") { return }
        try? FileManager.default.removeItem(at: FileManager.default.temporaryDirectory.appending(path: "browser-workspace-fixture", directoryHint: .isDirectory))
        let fixtureWallpapers = HomeWallpaperStore(namespace: "workspace-fixture")
        try? fixtureWallpapers.removeAll()
        for key in ["browser.hidden-home-recents.workspace-fixture", "browser.home-pins.workspace-fixture", "browser.annotations.workspace-fixture", "browser.recent.workspace-fixture", "browser.recent-web.workspace-fixture", "browser.web-history.workspace-fixture", "recent-access.workspace-fixture"] { UserDefaults.standard.removeObject(forKey: key) }
        for key in UserDefaults.standard.dictionaryRepresentation().keys
            where key.hasSuffix(".workspace-fixture") && (key.hasPrefix("browser.home-pins.") || key.hasPrefix("browser.pin-sync.") || key.hasPrefix("browser.guest-pins.")) {
            UserDefaults.standard.removeObject(forKey: key)
        }
        if ProcessInfo.processInfo.arguments.contains("--account-fixtures") || ProcessInfo.processInfo.arguments.contains("--fixtures") || ProcessInfo.processInfo.arguments.contains("--authoring-fixtures") {
            if ProcessInfo.processInfo.arguments.contains("--remote-gallery-fixtures") {
                fixtureClient = MobileClient(baseURL: URL(string: "https://catalog-fixture.invalid")!, transport: GalleryFixtureTransport(), token: { _ in "fixture" })
            }
            return
        }
        #endif
        var configuration = AppConfiguration.bundled
        #if DEBUG && targetEnvironment(simulator)
        if ProcessInfo.processInfo.arguments.contains("--account-entry-preview") || ProcessInfo.processInfo.arguments.contains("--account-deletion-preview") || ProcessInfo.processInfo.arguments.contains("--guest-home-preview") {
            configuration = AppConfiguration(apiURL: URL(string: "https://account-preview.invalid")!,
                supabaseURL: URL(string: "https://account-preview.invalid")!, anonKey: "preview")
        }
        if configuration == nil && ProcessInfo.processInfo.arguments.contains("--onboarding") {
            configuration = AppConfiguration(apiURL: URL(string: "http://localhost:3001")!,
                supabaseURL: URL(string: "https://onboarding-preview.invalid")!, anonKey: "preview")
        }
        #endif
        guard let configuration else { return }
        let account = AccountSession(configuration: configuration)
        #if DEBUG && targetEnvironment(simulator)
        if ProcessInfo.processInfo.arguments.contains("--account-entry-preview") {
            account.entry = Self.bundledAnnotationEntry(prefersInflected: ProcessInfo.processInfo.arguments.contains("--account-entry-inflected"))
        }
        if ProcessInfo.processInfo.arguments.contains("--account-deletion-preview") { account.deletion.presented = true }
        #endif
        _session = State(initialValue: account)
        _livePlayback = State(initialValue: PlaybackController { source in
            let descriptor = try await account.client.audio(textID: source.textID.rawValue, audioID: source.audioID)
            return PlaybackDescriptor(url: descriptor.url, expiresAt: descriptor.expiresAt)
        })
    }
    var body: some View {
        Group {
            if let session, let livePlayback {
                #if DEBUG && targetEnvironment(simulator)
                if ProcessInfo.processInfo.arguments.contains("--onboarding") {
                    WelcomeGate(session: session)
                } else {
                    AccountRoot(session: session, playback: livePlayback)
                }
                #else
                AccountRoot(session: session, playback: livePlayback)
                #endif
            } else {
                #if DEBUG && targetEnvironment(simulator)
                if ProcessInfo.processInfo.arguments.contains("--browser-workspace-fixtures") {
                    BrowserWorkspacePreview(playback: fixturePlayback)
                } else if ProcessInfo.processInfo.arguments.contains("--account-fixtures") {
                    AccountPreview(playback: fixturePlayback)
                } else if ProcessInfo.processInfo.arguments.contains("--authoring-fixtures") {
                    AuthoringPreview(playback: fixturePlayback)
                } else if ProcessInfo.processInfo.arguments.contains("--fixtures") {
                    if ProcessInfo.processInfo.arguments.contains("--tab-fixtures") {
                        LibraryTabShell(selection: $fixtureTab) {
                            fixtureBrowser
                        } browser: {
                            if let fixtureClient { TextBrowserScreen(client: fixtureClient) }
                            else { LeximoryUnavailableView("浏览网页", systemImage: "globe") }
                        } account: {
                            Text("账号").displayFont(24, relativeTo: .title2)
                        }
                    } else { fixtureBrowser }
                } else {
                    LeximoryUnavailableView("暂时无法连接", systemImage: "wifi.exclamationmark", message: "请稍后重试。")
                }
                #else
                LeximoryUnavailableView("暂时无法连接", systemImage: "wifi.exclamationmark", message: "请稍后重试。")
                #endif
            }
        }
    }
    #if DEBUG && targetEnvironment(simulator)
    private static func bundledAnnotationEntry(prefersInflected: Bool) -> AccountEntryContext? {
        guard let url = Bundle.main.url(forResource: "reader", withExtension: "json"),
              let data = try? Data(contentsOf: url), let document = try? JSONDecoder().decode(ReadingDocument.self, from: data) else { return nil }
        let title = document.blocks.first { $0.kind == .heading1 }?.displayText
        for block in document.blocks {
            for span in block.spans {
                guard case .definition(let definition) = span.style, let range = try? span.range.validated(in: block.displayText) else { continue }
                if prefersInflected && String(block.displayText[range]) == definition.lemma { continue }
                let selection = GuestSelection(quote: String(block.displayText[range]), context: block.displayText,
                    offset: span.range.location, title: title, language: "en")
                return AccountEntryContext(purpose: .words, word: AccountWordContext(definition: definition, original: selection.quote,
                    quote: selection.excerpt, title: title, language: "en"))
            }
        }
        return nil
    }
    private var fixtureBrowser: some View {
        FixtureLibraryView(playback: fixturePlayback, libraries: ProcessInfo.processInfo.arguments.contains("--ebook-fixtures") ? FixtureLibrary.ebookSamples : ProcessInfo.processInfo.arguments.contains("--catalog-layout-fixtures") ? FixtureLibrary.layoutSamples : FixtureLibrary.samples, client: fixtureClient)
    }
    #endif
}

private enum AccountRootSheet: Identifiable {
    case entry(AccountEntryContext), deletion
    var id: String { switch self { case .entry(let context): context.id.uuidString; case .deletion: "deletion" } }
}

private struct AccountPresentationSizing: PresentationSizing {
    func proposedSize(for root: PresentationSizingRoot, context: PresentationSizingContext) -> ProposedViewSize {
        ProposedViewSize(width: 560, height: 900)
    }
}

private struct AccountRoot: View {
    let session: AccountSession
    let playback: PlaybackController
    @State private var pendingText: TextID?
    @State private var pendingHome = false
    @Environment(\.scenePhase) private var scenePhase
    private var sheet: Binding<AccountRootSheet?> {
        Binding(get: {
            if let entry = session.entry { return .entry(entry) }
            return session.deletion.presented ? .deletion : nil
        }, set: { value in
            if value == nil { session.entry = nil; session.deletion.presented = false }
        })
    }
    var body: some View {
        ZStack {
            switch session.state {
            case .restoring: ReadingLoadingIndicator("正在打开文库").frame(maxWidth: .infinity, maxHeight: .infinity)
            case .signedOut, .expired:
                BrowserWorkspaceView(client: session.client, namespace: "local-guest", playback: playback,
                    session: session, guest: session.guest, pendingText: $pendingText, pendingHome: $pendingHome)
                    .environment(\.guestSession, session.guest)
                    .id("local-guest/\(session.generation)")
            case .signedIn: BrowserWorkspaceView(client: session.client, namespace: session.state.accountID ?? "", playback: playback, session: session, pendingText: $pendingText, pendingHome: $pendingHome).id(session.generation)
            case .unavailable(let message):
                LeximoryUnavailableView("暂时无法连接", systemImage: "wifi.exclamationmark", message: message) {
                    Button("重试") { Task { await session.restore() } }
                    Button("返回登录") { session.entry = AccountEntryContext() }
                }
            }
        }
        .background(LeximoryPalette.paper)
        .environment(\.nativeSync, session.sync)
        .environment(\.accountSession, session)
        .sheet(item: sheet) { destination in
            NavigationStack {
                switch destination {
                case .entry(let context):
                    SignInView(session: session, notice: signInNotice, context: context)
                case .deletion: AccountDeletionView(session: session)
                }
            }.leximorySheetStyle().presentationDetents([.large]).presentationSizing(AccountPresentationSizing())
        }
        .alert("登录链接未能打开", isPresented: Binding(get: { session.callbackFailure != nil }, set: { if !$0 { session.callbackFailure = nil } })) {
            Button("好", role: .cancel) { session.callbackFailure = nil }
        } message: { Text(session.callbackFailure ?? "") }
        .task(id: "deletion/\(scenePhase == .active)/\(session.deletion.accepted)") {
            guard scenePhase == .active else { return }
            await session.deletion.resume()
            await session.finishAcceptedDeletion()
            while session.deletion.accepted && session.deletion.status == .pending && !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(10)) } catch { return }
                await session.deletion.refresh()
            }
        }
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            repeat {
                await session.restore()
                guard case .restoring = session.state else { return }
                do { try await Task.sleep(for: .seconds(15)) } catch { return }
            } while !Task.isCancelled
        }
        .task(id: "\(session.state.accountID ?? "")/\(scenePhase == .active)") {
            guard session.state.isSignedIn, scenePhase == .active else { session.sync?.pause(); return }
            await session.sync?.run()
        }
        .task(id: "widget/\(session.generation)/\(session.state.accountID ?? "")/\(scenePhase == .active)/\(session.sync?.online != false)") {
            guard session.state.isSignedIn, scenePhase == .active, session.sync?.online != false else { return }
            await SavedWordsWidgetSync.refresh(client: session.client)
        }
        .onChange(of: session.generation) { _, _ in playback.stop(); pendingText = nil }
        .onOpenURL { url in
            if url.scheme == "leximory", url.host == "auth", url.path == "/callback" {
                Task {
                    do { try await session.handleAuthCallback(url) }
                    catch { session.callbackFailure = "链接可能已失效，请重新发送确认邮件或重设密码邮件。" }
                }
            } else if SavedWordsWidgetLink.opensHome(url) { pendingHome = true }
            else { pendingText = TextLink.textID(from: url, webURL: session.client.webURL) }
        }
    }
    private var signInNotice: String? {
        if case .expired = session.state { return "登录已过期，请重新登录。" }
        return nil
    }
}

#if DEBUG && targetEnvironment(simulator)
private struct GalleryFixtureTransport: ClientTransport {
    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        try await Task.detached { try await Task.sleep(for: .milliseconds(800)) }.value
        let data = try await MainActor.run {
            let library = FixtureLibrary.samples.first { request.path?.contains($0.id.rawValue) == true } ?? FixtureLibrary.samples[0]
            func text(_ article: FixtureArticle) -> [String: Any] {
                ["id": article.id.rawValue, "libraryId": library.id.rawValue, "title": article.title,
                 "topics": article.topics, "emoji": NSNull(), "createdAt": NSNull(), "format": "article"]
            }
            let payload: [String: Any]
            if operationID == "document" {
                let article = library.articles.first { request.path?.contains($0.id.rawValue) == true } ?? library.articles[0]
                guard let documentURL = Bundle.main.url(forResource: article.resource, withExtension: "json") else { throw CocoaError(.fileNoSuchFile) }
                payload = ["text": text(article),
                    "library": ["id": library.id.rawValue, "name": library.name, "language": "en", "owned": true, "archived": false, "shadow": false],
                    "document": try JSONSerialization.jsonObject(with: Data(contentsOf: documentURL)), "annotationProgress": NSNull()]
            } else {
                payload = ["items": library.articles.map(text), "nextCursor": NSNull()]
            }
            return try JSONSerialization.data(withJSONObject: payload)
        }
        return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(data))
    }
}
#endif
