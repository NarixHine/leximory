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
        if ProcessInfo.processInfo.arguments.contains("--fixtures") || ProcessInfo.processInfo.arguments.contains("--authoring-fixtures") {
            if ProcessInfo.processInfo.arguments.contains("--remote-gallery-fixtures") {
                fixtureClient = MobileClient(baseURL: URL(string: "https://catalog-fixture.invalid")!, transport: GalleryFixtureTransport(), token: { _ in "fixture" })
            }
            return
        }
        #endif
        var configuration = AppConfiguration.bundled
        #if DEBUG && targetEnvironment(simulator)
        if configuration == nil && ProcessInfo.processInfo.arguments.contains("--onboarding") {
            configuration = AppConfiguration(apiURL: URL(string: "http://localhost:3001")!,
                supabaseURL: URL(string: "https://onboarding-preview.invalid")!, anonKey: "preview")
        }
        #endif
        guard let configuration else { return }
        let account = AccountSession(configuration: configuration)
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
                if ProcessInfo.processInfo.arguments.contains("--authoring-fixtures") {
                    AuthoringPreview(playback: fixturePlayback)
                } else if ProcessInfo.processInfo.arguments.contains("--fixtures") {
                    if ProcessInfo.processInfo.arguments.contains("--tab-fixtures") {
                        LibraryTabShell(selection: $fixtureTab) {
                            fixtureBrowser
                        } account: {
                            Text("账户").font(LeximoryTypography.interface(24))
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
    private var fixtureBrowser: some View {
        FixtureLibraryView(playback: fixturePlayback, libraries: ProcessInfo.processInfo.arguments.contains("--ebook-fixtures") ? FixtureLibrary.ebookSamples : ProcessInfo.processInfo.arguments.contains("--catalog-layout-fixtures") ? FixtureLibrary.layoutSamples : FixtureLibrary.samples, client: fixtureClient)
    }
    #endif
}

private struct AccountRoot: View {
    let session: AccountSession
    let playback: PlaybackController
    @State private var pendingText: TextID?
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("hasOpenedLeximory") private var hasOpened = false
    var body: some View {
        ZStack {
            switch session.state {
            case .restoring: ReadingLoadingIndicator("正在打开文库……").frame(maxWidth: .infinity, maxHeight: .infinity)
            case .signedOut:
                if hasOpened { SignInView(session: session) } else { WelcomeGate(session: session) }
            case .expired: SignInView(session: session, notice: "登录已过期，请重新登录。")
            case .signedIn: LiveLibraryView(session: session, playback: playback, pendingText: $pendingText).id(session.generation)
            case .unavailable(let message):
                LeximoryUnavailableView("暂时无法连接", systemImage: "wifi.exclamationmark", message: message) {
                    Button("重试") { Task { await session.restore() } }
                    Button("返回登录") { Task { await session.signOut() } }
                }
            }
        }
        .background(LeximoryPalette.paper)
        .environment(\.nativeSync, session.sync)
        .task { await session.restore() }
        .task(id: "\(session.state.accountID ?? "")/\(scenePhase == .active)") {
            guard session.state.isSignedIn, scenePhase == .active else { session.sync?.pause(); return }
            await session.sync?.run()
        }
        .onChange(of: session.state.isSignedIn) { _, signedIn in if signedIn { hasOpened = true } }
        .onChange(of: session.generation) { _, _ in playback.stop(); pendingText = nil }
        .onOpenURL { url in pendingText = TextLink.textID(from: url, webURL: session.client.webURL) }
    }
}

struct SignInView: View {
    let session: AccountSession
    var notice: String? = nil
    @State private var email = ""
    @State private var password = ""
    @State private var submitting = false
    @State private var error: String?
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("继续语言学习之旅")
                        .font(LeximoryTypography.interface(24, semibold: true, style: .title2)).tracking(-0.3).lineSpacing(3)
                }
                if let notice { Text(notice).font(LeximoryTypography.interface(15, style: .subheadline)).foregroundStyle(.secondary) }
                VStack(spacing: 16) {
                    TextField("邮箱", text: $email).textContentType(.username).keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never).autocorrectionDisabled().accessibilityIdentifier("sign-in-email")
                    Divider()
                    SecureField("密码", text: $password).textContentType(.password).accessibilityIdentifier("sign-in-password")
                }.padding(20).background(LeximoryPalette.shell, in: RoundedRectangle(cornerRadius: 22))
                Link("忘记密码？", destination: session.client.webURL.appending(path: "forgot-password"))
                    .font(LeximoryTypography.interface(15, style: .subheadline))
                if let error { Text(error).font(LeximoryTypography.interface(15, style: .subheadline)).foregroundStyle(.red).accessibilityAddTraits(.updatesFrequently) }
                Button {
                    submitting = true; error = nil
                    Task {
                        defer { password = ""; submitting = false }
                        do { try await session.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password) }
                        catch { if !Task.isCancelled { self.error = "登录未成功，请检查邮箱、密码和网络后重试。" } }
                    }
                } label: {
                    HStack {
                        if submitting { ProgressView().tint(LeximoryPalette.paper) }
                        Text(submitting ? "登录中……" : "登录").font(LeximoryTypography.interface(17, semibold: true, style: .headline))
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 17)
                    .foregroundStyle(LeximoryPalette.paper)
                    .background(LeximoryPalette.ink, in: Capsule())
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .disabled(submitting || email.isEmpty || password.isEmpty)
            }.padding(28).frame(maxWidth: 480).frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
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
