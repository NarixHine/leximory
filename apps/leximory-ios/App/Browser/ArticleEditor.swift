import SwiftUI
import WebKit

@MainActor @Observable final class ArticleEditorController {
    var ready = false
    var failed = false
    weak var web: WKWebView?
    func command(_ name: String) {
        Task { _ = try? await web?.callAsyncJavaScript("window.lexiEditor.command(name)", arguments: ["name": name], in: nil, contentWorld: .page) }
    }
    func markdown() async throws -> String {
        guard ready, let web,
              let value = try await web.callAsyncJavaScript("return window.lexiEditor.markdown()", arguments: [:], in: nil, contentWorld: .page) as? String else { throw URLError(.cannotParseResponse) }
        return value
    }
}

struct ArticleEditorPage: View {
    @Binding var content: String
    let language: String
    @State private var controller = ArticleEditorController()
    @State private var error: String?
    @State private var committing = false
    @ScaledMetric(relativeTo: .body) private var size = 17.0
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        VStack(spacing: 0) {
            ScrollView(.horizontal) {
                HStack(spacing: 4) {
                    formatting("标题", symbol: "textformat.size", command: "heading")
                    formatting("粗体", symbol: "bold", command: "bold")
                    formatting("斜体", symbol: "italic", command: "italic")
                    formatting("引用", symbol: "text.quote", command: "quote")
                    formatting("列表", symbol: "list.bullet", command: "list")
                    Divider().frame(height: 20)
                    formatting("撤销", symbol: "arrow.uturn.backward", command: "undo")
                    formatting("重做", symbol: "arrow.uturn.forward", command: "redo")
                }.padding(.horizontal, 12)
            }.scrollIndicators(.hidden).disabled(!controller.ready || committing)
            Divider()
            ArticleEditorWebView(source: content, language: language, fontSize: size, controller: controller)
                .overlay { if !controller.ready && !controller.failed { ProgressView() } }
            if let error { Text(error).interfaceFont(14).foregroundStyle(.secondary).padding(12) }
            if controller.failed {
                Text("正文未能打开，请返回后重试。").interfaceFont(14).foregroundStyle(.secondary).padding()
            }
        }.background(LeximoryPalette.paper).tint(.primary)
            .navigationTitle("编辑全文").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if controller.failed {
                    ToolbarItem(placement: .cancellationAction) { Button("返回") { dismiss() } }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("应用") {
                        committing = true
                        Task {
                            defer { committing = false }
                            do { content = try await controller.markdown(); dismiss() }
                            catch { self.error = "修改未能保存，请重试。" }
                        }
                    }.disabled(!controller.ready || committing).accessibilityIdentifier("article-editor-done")
                }
            }
            .navigationBarBackButtonHidden()

    }
    private func formatting(_ title: String, symbol: String, command: String) -> some View {
        Button(title, systemImage: symbol) { controller.command(command) }
            .labelStyle(.iconOnly).frame(minWidth: 44, minHeight: 44).accessibilityIdentifier("article-format-" + command)
    }
}

struct ArticleEditorWebView: UIViewRepresentable {
    let source: String
    let language: String
    let fontSize: Double
    let controller: ArticleEditorController
    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.userContentController.add(context.coordinator, name: "editor")
        let web = WKWebView(frame: .zero, configuration: configuration)
        web.tintColor = .systemBlue
        web.isOpaque = false; web.backgroundColor = .clear; web.scrollView.backgroundColor = .clear
        web.navigationDelegate = context.coordinator
        web.scrollView.keyboardDismissMode = .interactive
        controller.web = web
        if let url = Bundle.main.url(forResource: "editor", withExtension: "html") {
            web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else { controller.failed = true }
        return web
    }
    func updateUIView(_ web: WKWebView, context: Context) {}
    static func dismantleUIView(_ web: WKWebView, coordinator: Coordinator) {
        web.configuration.userContentController.removeScriptMessageHandler(forName: "editor")
        web.navigationDelegate = nil
    }
    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        let parent: ArticleEditorWebView
        init(_ parent: ArticleEditorWebView) { self.parent = parent }
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.frameInfo.isMainFrame, let event = message.body as? [String: Any], let kind = event["kind"] as? String else { return }
            if kind == "ready", let web = parent.controller.web {
                let family: String
                switch parent.language {
                case "Chinese": family = "ChillDuanHeiSong, Songti SC, serif"
                case "Japanese": family = "ChillDuanHeiSongProJP, Hiragino Mincho ProN, serif"
                default: family = "Libre Baskerville, Georgia, serif"
                }
                Task {
                    do {
                        _ = try await web.callAsyncJavaScript("window.lexiEditor.load(source, size, family)", arguments: ["source": parent.source, "size": parent.fontSize, "family": family], in: nil, contentWorld: .page)
                    } catch { parent.controller.failed = true }
                }
            } else if kind == "loaded" { parent.controller.ready = true }
        }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) { parent.controller.failed = true }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) { parent.controller.failed = true }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
            navigationAction.navigationType == .other && navigationAction.request.url?.isFileURL == true ? .allow : .cancel
        }
    }
}
