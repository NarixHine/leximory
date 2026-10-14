import SwiftUI
import UniformTypeIdentifiers
import LeximoryCore

struct BrowserEbookFile {
    let name: String
    let data: Data
    static func read(_ url: URL) async throws -> Self {
        try await Task.detached {
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            guard ["epub", "pdf"].contains(url.pathExtension.lowercased()) else { throw URLError(.unsupportedURL) }
            let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
            guard size > 0, size <= 4_718_592 else { throw URLError(.dataLengthExceedsMaximum) }
            let data = try Data(contentsOf: url)
            guard !data.isEmpty, data.count <= 4_718_592 else { throw URLError(.dataLengthExceedsMaximum) }
            return Self(name: url.lastPathComponent, data: data)
        }.value
    }
}

struct BrowserImportRequest: Identifiable {
    enum Source { case article(BrowserArticleDraft), ebook(BrowserEbookFile) }
    let id = UUID()
    let source: Source
}

private enum ImportStep: Hashable { case folder, content }

struct BrowserImportSheet: View {
    let request: BrowserImportRequest
    @Bindable var workspace: BrowserWorkspaceModel
    let imported: (CatalogText, Bool) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.nativeSync) private var sync
    @State private var title: String
    @State private var content: String
    @State private var folderID: String?
    @State private var fullText = true
    @State private var remember = false
    @State private var initialRuleFolderID: String?
    @State private var busy = false
    @State private var uncertain = false
    @State private var error: String?
    @State private var path: [ImportStep] = []
    @State private var requestID = UUID().uuidString
    @State private var editingTitle = false
    private var draft: BrowserArticleDraft? { if case .article(let draft) = request.source { draft } else { nil } }
    private var file: BrowserEbookFile? { if case .ebook(let file) = request.source { file } else { nil } }
    private var folder: CatalogLibrary? { workspace.writableFolders.first { $0.id == folderID } }
    private var limit: Int { switch folder?.language { case "en", "fr": 30000; case "zh": 5000; default: 10000 } }
    private var valid: Bool {
        folder != nil && !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && title.count <= 512 &&
        (file != nil || !fullText || !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && content.utf16.count <= limit)
    }
    init(request: BrowserImportRequest, workspace: BrowserWorkspaceModel, imported: @escaping (CatalogText, Bool) -> Void) {
        self.request = request; self.workspace = workspace; self.imported = imported
        switch request.source {
        case .article(let draft): _title = State(initialValue: draft.title); _content = State(initialValue: draft.content)
        case .ebook(let file): _title = State(initialValue: (file.name as NSString).deletingPathExtension); _content = State(initialValue: "")
        }
    }
    var body: some View {
        NavigationStack(path: $path) {
            Form {
                if file == nil {
                    Section {
                        Picker("保存方式", selection: $fullText) {
                            Text("导入并预注释全文").tag(true)
                            Text("存为链接书签").tag(false)
                        }.pickerStyle(.inline).labelsHidden()
                    } header: {
                        sectionHeading("保存方式")
                    }
                }
                Section {
                    if let file {
                        Label(file.name, systemImage: "book.closed").foregroundStyle(.secondary)
                        if editingTitle { TextField("标题", text: $title) }
                        else { Button("编辑标题", systemImage: "pencil") { editingTitle = true } }
                    } else { TextField("标题", text: $title, axis: .vertical).lineLimit(1...3) }
                    Button { path.append(.folder) } label: {
                        HStack {
                            Label("文件夹", systemImage: "folder")
                            Spacer()
                            Text(folder?.name ?? "选择文件夹").foregroundStyle(.secondary).lineLimit(1)
                            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
                        }
                    }.foregroundStyle(.primary)
                    if draft != nil { Toggle("本网站总是存于此文件夹", isOn: $remember).disabled(folder == nil) }
                }
                if file == nil && fullText {
                    Section {
                        ArticleMarkdownPreview(content: content, language: folder?.preview.language ?? "English")
                        Button("编辑全文", systemImage: "pencil") { path.append(.content) }
                        if content.utf16.count > limit { Text("全文超过此文件夹的 \(limit) 字符上限，请编辑后重试。").foregroundStyle(.secondary) }
                        if content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { Text("未能提取正文。可以存为链接，或手动编辑全文。").foregroundStyle(.secondary) }
                    } header: {
                        sectionHeading("全文预览")
                    }
                }
                if let error { Section { Text(error).foregroundStyle(.secondary).accessibilityAddTraits(.updatesFrequently) } }
            }
            .disabled(busy)
            .navigationTitle(file != nil ? "打开电子书" : "保存网页").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) }
                if path.isEmpty {
                    ToolbarItem(placement: .confirmationAction) {
                        Button { confirmImport() } label: {
                            if busy { ProgressView() } else { Text(file != nil ? "打开" : fullText ? "导入" : "保存") }
                        }.disabled(!valid || busy || uncertain || sync?.online == false)
                            .accessibilityIdentifier("browser-import-submit")
                    }
                }
            }
            .navigationDestination(for: ImportStep.self) { step in
                switch step {
                case .folder: BrowserFolderPicker(workspace: workspace, selection: $folderID)
                case .content:
                    TextEditor(text: $content).font(LeximoryTypography.prose(17)).padding(16)
                        .navigationTitle("编辑全文").navigationBarTitleDisplayMode(.inline)
                        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { path.removeLast() } } }
                }
            }
            .task {
                if let id = draft?.sourceFolderID, workspace.writableFolders.contains(where: { $0.id == id }) { folderID = id }
                if let draft, let domain = draft.url.host {
                    do {
                        let rules = try await workspace.client.browserRules()
                        let normalized = domain.lowercased().replacingOccurrences(of: #"^www\.|\.$"#, with: "", options: .regularExpression)
                        if let rule = rules.first(where: { $0.domain == normalized }), workspace.writableFolders.contains(where: { $0.id == rule.libraryId }) {
                            if folderID == nil { folderID = rule.libraryId }
                            remember = rule.libraryId == folderID; initialRuleFolderID = rule.libraryId
                        }
                    } catch { }
                }
                if folderID == nil, workspace.writableFolders.count == 1 { folderID = workspace.writableFolders.first?.id }
            }
            .interactiveDismissDisabled(busy)
        }.font(LeximoryTypography.interface(17)).presentationDetents([.large]).presentationDragIndicator(.visible).tint(.primary)
    }
    private func sectionHeading(_ title: String) -> some View {
        Text(title).font(LeximoryTypography.interface(13, style: .caption1)).foregroundStyle(.secondary)
    }
    private func confirmImport() {
        Task { await submit() }
    }
    private func submit() async {
        guard valid, let folder, !busy, !uncertain else { return }
        busy = true; error = nil
        defer { busy = false }
        var importStarted = false
        do {
            if let domain = draft?.url.host, remember || initialRuleFolderID != nil {
                try await workspace.client.setBrowserRule(domain: domain, libraryID: remember ? folder.id : nil)
                initialRuleFolderID = remember ? folder.id : nil
            }
            importStarted = true
            let text: CatalogText
            if let file { text = try await workspace.client.uploadEbook(libraryID: folder.id, title: title, filename: file.name, data: file.data) }
            else if fullText {
                text = try await workspace.client.importArticle(libraryID: folder.id, title: title, content: content, annotate: true, onlyComments: false, generateTitle: false)
            } else if let draft {
                text = try await workspace.client.createBookmark(libraryID: folder.id, url: draft.url.absoluteString, requestID: requestID, title: title)
            } else { return }
            imported(text, file == nil && fullText); dismiss()
        } catch {
            if let failure = MobileClient.cause(of: error) as? MobileFailure {
                uncertain = importStarted && (file != nil || fullText) && failure.error.code == "service_unavailable"
                self.error = uncertain ? "未能确认导入结果，请先查看我的书签，避免重复导入。" : failure.error.message
            } else {
                uncertain = importStarted && (file != nil || fullText)
                self.error = uncertain ? "未能确认导入结果，请先查看我的书签，避免重复导入。" : !importStarted ? "网站文件夹设置未能保存，请重试。" : "链接未能保存，请重试。"
            }
        }
    }
}
