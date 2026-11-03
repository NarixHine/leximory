import SwiftUI
import UniformTypeIdentifiers
import LeximoryCore

struct BrowserEbookFile: Sendable {
    static let maximumSize = 4_718_592
    let name: String
    let data: Data
    static func read(_ url: URL) async throws -> Self {
        try await Task.detached {
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            guard ["epub", "pdf"].contains(url.pathExtension.lowercased()) else { throw URLError(.unsupportedURL) }
            let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
            guard size > 0, size <= maximumSize else { throw URLError(.dataLengthExceedsMaximum) }
            let data = try Data(contentsOf: url)
            guard !data.isEmpty, data.count <= maximumSize else { throw URLError(.dataLengthExceedsMaximum) }
            return Self(name: url.lastPathComponent, data: data)
        }.value
    }
}

struct BrowserImportRequest: Identifiable {
    enum Source { case article(BrowserArticleDraft), ebook(BrowserEbookFile), pdf(BrowserEbookFile) }
    let id = UUID()
    let source: Source
    var title: String {
        switch source { case .article: "保存网页"; case .ebook: "打开电子书"; case .pdf: "保存 PDF" }
    }
    var confirmation: String {
        switch source { case .article, .pdf: "保存"; case .ebook: "打开" }
    }
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
    @State private var ebookDraft: EbookImportDraft
    @FocusState private var titleFocused: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private var draft: BrowserArticleDraft? { if case .article(let draft) = request.source { draft } else { nil } }
    private var file: BrowserEbookFile? {
        switch request.source { case .ebook(let file), .pdf(let file): file; case .article: nil }
    }
    private var selectedFolderID: String? { file == nil ? folderID : ebookDraft.folderID }
    private var importTitle: String { file == nil ? title : ebookDraft.title }
    private var folder: CatalogLibrary? { workspace.writableFolders.first { $0.id == selectedFolderID } }
    private var folderSelection: Binding<String?> {
        Binding(get: { selectedFolderID }, set: { value in
            if file == nil { folderID = value }
            else { ebookDraft.takeFolder(); ebookDraft.folderID = value }
        })
    }
    private var limit: Int? {
        guard let folder else { return nil }
        switch folder.language { case "en", "fr": return 30000; case "zh": return 5000; default: return 10000 }
    }
    private var contentTooLong: Bool { limit.map { content.utf16.count > $0 } ?? false }
    private var valid: Bool {
        folder != nil && !importTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && importTitle.count <= 512 &&
        (file != nil || !fullText || !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !contentTooLong)
    }
    init(request: BrowserImportRequest, workspace: BrowserWorkspaceModel, imported: @escaping (CatalogText, Bool) -> Void) {
        self.request = request; self.workspace = workspace; self.imported = imported
        let filename: String
        switch request.source { case .ebook(let file), .pdf(let file): filename = file.name; case .article: filename = "" }
        _ebookDraft = State(initialValue: EbookImportDraft(filename: filename))
        switch request.source {
        case .article(let draft): _title = State(initialValue: draft.title); _content = State(initialValue: draft.content)
        case .ebook(let file), .pdf(let file): _title = State(initialValue: (file.name as NSString).deletingPathExtension); _content = State(initialValue: "")
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
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(spacing: 6) {
                                Text("名称").interfaceFont(13, style: .footnote).foregroundStyle(.secondary)
                                EbookAutofillCue(state: ebookDraft.titleAutofill)
                            }
                            TextField("名称", text: Binding(get: { ebookDraft.title }, set: { value in
                                ebookDraft.takeTitle(); ebookDraft.title = value
                            }), axis: .vertical)
                                .editorialFont(17, relativeTo: .body, language: folder?.preview.language ?? "English")
                                .multilineTextAlignment(.leading).lineLimit(1...6).tint(.blue)
                                .fixedSize(horizontal: false, vertical: true)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .focused($titleFocused).id(ebookDraft.titleRevision).transition(.opacity)
                                .accessibilityHint("可随时修改名称")
                                .accessibilityIdentifier("ebook-import-title")
                            Text(file.name).interfaceFont(13, style: .footnote).foregroundStyle(.secondary)
                                .lineLimit(2).accessibilityIdentifier("ebook-import-filename")
                        }.padding(.vertical, 4)
                    } else { TextField("标题", text: $title, axis: .vertical).tint(.blue).lineLimit(1...3) }
                    Button {
                        if file != nil { ebookDraft.takeFolder() }
                        path.append(.folder)
                    } label: {
                        HStack {
                            if dynamicTypeSize.isAccessibilitySize {
                                VStack(alignment: .leading, spacing: 8) {
                                    destinationLabel
                                    destinationName
                                }
                                Spacer()
                            } else {
                                destinationLabel
                                Spacer()
                                destinationName
                            }
                            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
                        }
                    }.foregroundStyle(.primary)
                        .accessibilityHint(file != nil && ebookDraft.folderAutofill != nil ? "可随时选择其他文件夹" : "选择文件夹")
                    if draft != nil { Toggle("本网站总是存于此文件夹", isOn: $remember).disabled(folder == nil) }
                }
                if file == nil && fullText {
                    Section {
                        ArticleMarkdownPreview(content: content, language: folder?.preview.language ?? "English")
                        Button("编辑全文", systemImage: "pencil") { path.append(.content) }
                        if contentTooLong, let limit { Text("全文共 \(content.utf16.count) 字符，超过此文件夹的 \(limit) 字符上限。请编辑后重试。").foregroundStyle(.secondary) }
                        if content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { Text("未能提取正文。可以存为链接，或手动编辑全文。").foregroundStyle(.secondary) }
                    } header: {
                        sectionHeading("全文预览")
                    }
                }
                if let error { Section { Text(error).foregroundStyle(.secondary).accessibilityAddTraits(.updatesFrequently) } }
            }
            .disabled(busy)
            .navigationTitle(request.title).navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) }
                if path.isEmpty {
                    ToolbarItem(placement: .confirmationAction) {
                        Button { confirmImport() } label: {
                            if busy { ProgressView() } else { Text(file == nil && fullText ? "导入" : request.confirmation) }
                        }.disabled(!valid || busy || uncertain || sync?.online == false)
                            .accessibilityIdentifier("browser-import-submit")
                    }
                }
            }
            .navigationDestination(for: ImportStep.self) { step in
                switch step {
                case .folder: BrowserFolderPicker(workspace: workspace, selection: folderSelection)
                case .content:
                    ArticleEditorPage(content: $content, language: folder?.preview.language ?? "English")
                }
            }
            .interactiveDismissDisabled(busy)
        }
            .onChange(of: titleFocused) { if titleFocused { ebookDraft.takeTitle() } }
            .onDisappear { ebookDraft.stop() }
            .task(id: request.id) {
                if let file {
                    let metadata = await EbookImportMetadata.read(file)
                    guard !Task.isCancelled else { return }
                    await ebookDraft.fill(metadata: metadata, reduceMotion: reduceMotion) { field in
                        let value = try await workspace.client.suggestEbookImport(requestID: request.id.uuidString, field: field,
                            filename: file.name, title: metadata.title, author: metadata.author, language: metadata.language,
                            sample: metadata.sample)
                        if field == "folder", !workspace.writableFolders.contains(where: { $0.id == value && !$0.archived }) { return nil }
                        return value
                    }
                    return
                }
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
        .leximorySheetStyle().presentationDetents([.large])
    }
    private var destinationLabel: some View {
        HStack(spacing: 6) {
            Label("文件夹", systemImage: "folder")
            if file != nil { EbookAutofillCue(state: ebookDraft.folderAutofill) }
        }
    }
    private var destinationName: some View {
        Group {
            if let folder {
                Text(folder.name).id(folder.id).transition(.opacity)
                    .editorialFont(17, relativeTo: .body, language: folder.preview.language)
                    .foregroundStyle(.primary)
            } else { Text("选择文件夹").foregroundStyle(.secondary) }
        }.lineLimit(dynamicTypeSize.isAccessibilitySize ? 2 : 1)
    }
    private func sectionHeading(_ title: String) -> some View {
        LeximorySectionHeader(title)
    }
    private func confirmImport() {
        Task { await submit() }
    }
    private func submit() async {
        guard valid, let folder, !busy, !uncertain else { return }
        if file != nil { ebookDraft.stop() }
        titleFocused = false
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
            if let file { text = try await workspace.client.uploadEbook(libraryID: folder.id, title: importTitle.trimmingCharacters(in: .whitespacesAndNewlines), filename: file.name, data: file.data) }
            else if fullText {
                text = try await workspace.client.importArticle(libraryID: folder.id, title: title, content: content, annotate: true, onlyComments: false, generateTitle: false, requestID: requestID)
            } else if let draft {
                text = try await workspace.client.createBookmark(libraryID: folder.id, url: draft.url.absoluteString, requestID: requestID, title: title)
            } else { return }
            imported(text, file == nil && fullText); dismiss()
        } catch {
            if let failure = MobileClient.cause(of: error) as? MobileFailure {
                uncertain = importStarted && file != nil && failure.error.code == "service_unavailable"
                self.error = uncertain ? "未能确认导入结果，请先查看我的书签，避免重复导入。" : importStarted && fullText && failure.error.retryable ? "导入尚未完成，请重试。" : failure.error.message
            } else {
                uncertain = importStarted && file != nil
                self.error = uncertain ? "未能确认导入结果，请先查看我的书签，避免重复导入。" : !importStarted ? "网站文件夹设置未能保存，请重试。" : fullText ? "导入尚未完成，请重试。" : "链接未能保存，请重试。"
            }
        }
    }
}
