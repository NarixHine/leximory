import SwiftUI

struct BrowserAdBlockingSettings: View {
    let blocker: BrowserAdBlocker
    let browser: TextBrowserModel?
    @State private var documentID: UUID?
    @State private var pageURL: URL?
    @State private var initial: BrowserBlockingPreferences
    @State private var revision: Int
    @State private var draft: BrowserBlockingPreferences
    @State private var applying = false
    @State private var error: String?
    @State private var application: Task<Void, Never>?
    @Environment(\.dismiss) private var dismiss

    init(blocker: BrowserAdBlocker, browser: TextBrowserModel? = nil) {
        self.blocker = blocker
        self.browser = browser
        _documentID = State(initialValue: browser?.navigationID)
        _pageURL = State(initialValue: browser?.url)
        _initial = State(initialValue: blocker.preferences)
        _revision = State(initialValue: blocker.revision)
        _draft = State(initialValue: blocker.preferences)
    }

    private var host: String? { pageURL.flatMap(BrowserBlockingPreferences.host) }
    private var reloadsPage: Bool {
        guard let browser, let pageURL, browser.navigationID == documentID, browser.canReloadForBlocking else { return false }
        return initial.blocks(pageURL) != draft.blocks(pageURL)
    }
    private var changed: Bool { draft != initial }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("拦截广告", isOn: $draft.enabled)
                        .accessibilityIdentifier("ad-blocking-enabled")
                } footer: {
                    Text("减少网页中的广告与跟踪。")
                }
                if let host {
                    Section {
                        Toggle("在此网站拦截", isOn: Binding(
                            get: { !draft.excludedHosts.contains(host) },
                            set: { if $0 { draft.excludedHosts.remove(host) } else { draft.excludedHosts.insert(host) } }
                        )).disabled(!draft.enabled)
                            .accessibilityIdentifier("ad-blocking-site")
                    } header: { Text(host).textCase(nil) }
                }
                if !draft.excludedHosts.isEmpty {
                    Section {
                        NavigationLink("网站例外") {
                            List {
                                ForEach(draft.excludedHosts.sorted(), id: \.self) { host in
                                    HStack {
                                        Text(host).textSelection(.enabled)
                                        Spacer(minLength: 16)
                                        Button("恢复拦截") { draft.excludedHosts.remove(host) }
                                            .accessibilityLabel("在 \(host) 恢复拦截")
                                    }
                                }
                            }
                            .navigationTitle("网站例外").navigationBarTitleDisplayMode(.inline)
                        }.accessibilityIdentifier("ad-blocking-exceptions")
                    }
                }
                if changed, pageURL != nil {
                    Section {} footer: {
                        Text(reloadsPage ? "更改后将重新载入当前网页，请先保存网页中填写的内容。" : "更改将在下次打开网页时生效。")
                    }
                }
                if let error {
                    Section {
                        Text(error).foregroundStyle(.secondary)
                        Button("重试", action: apply)
                    }
                } else if blocker.unavailable {
                    Section {
                        Text("广告拦截暂时不可用，网页仍可正常打开。")
                            .foregroundStyle(.secondary)
                        Button("重试", action: apply)
                    }
                }
            }
            .font(LeximoryTypography.interface(17, style: .body))
            .disabled(applying)
            .navigationTitle("广告拦截").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { application?.cancel(); dismiss() }
                        .accessibilityIdentifier("ad-blocking-cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(action: apply) {
                        if applying { ProgressView().accessibilityLabel("正在应用") }
                        else { Text(reloadsPage ? "应用并重新载入" : "完成") }
                    }.disabled(applying)
                        .accessibilityIdentifier("ad-blocking-confirm")
                }
            }
        }
        .interactiveDismissDisabled(applying)
        .presentationSizing(.form)
        .onDisappear { application?.cancel() }
    }

    private func apply() {
        guard changed || blocker.unavailable else { dismiss(); return }
        let shouldReload = reloadsPage
        applying = true
        error = nil
        application = Task { @MainActor in
            defer { applying = false }
            do {
                let policy = try await blocker.prepare(draft)
                try Task.checkCancellation()
                try blocker.commit(policy, expectedRevision: revision)
                if let browser, browser.navigationID == documentID, shouldReload {
                    browser.installBlocking(policy)
                    browser.web.reload()
                }
                dismiss()
            } catch is CancellationError {
                if !Task.isCancelled { error = "设置已在其他页面更改，请重新打开后调整。" }
            } catch {
                self.error = "广告拦截设置未能应用，请重试。"
            }
        }
    }
}
