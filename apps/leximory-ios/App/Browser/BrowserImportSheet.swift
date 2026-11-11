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

private enum ImportStep: Hashable { case folder }

private enum ImportFailure {
    case save(message: String, retryable: Bool), editor, uncertain
    var dismissal: String { if case .save(_, false) = self { "好" } else { "取消" } }
    var message: String {
        switch self {
        case .save(let message, _): message
        case .editor: "正文暂时无法读取。请重新打开正文后再试，已输入的内容会保留。"
        case .uncertain: "请先查看我的书签，确认电子书是否已导入。"
        }
    }
}

struct BrowserImportSheet: View {
    let request: BrowserImportRequest
    @Bindable var workspace: BrowserWorkspaceModel
    let imported: (CatalogText, Bool) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.nativeSync) private var sync
    @State private var title: String
    @State private var editor = ArticleEditorController()
    @State private var content: String
    @State private var folderID: String?
    @State private var fullText = true
    @State private var remember = false
    @State private var initialRuleFolderID: String?
    @State private var busy = false
    @State private var uncertain = false
    @State private var failure: ImportFailure?
    @State private var extractionFailed: Bool
    @State private var extracting = false
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
    private var failureTitle: String {
        if case .editor = failure { return "未能读取正文" }
        if case .uncertain = failure { return "未能确认导入结果" }
        switch request.source { case .article: return "未能保存网页"; case .ebook: return "未能导入电子书"; case .pdf: return "未能保存 PDF" }
    }
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
        case .article(let draft):
            _title = State(initialValue: draft.title); _content = State(initialValue: draft.content)
            _extractionFailed = State(initialValue: draft.extractionFailed)
        case .ebook(let file), .pdf(let file):
            _title = State(initialValue: (file.name as NSString).deletingPathExtension); _content = State(initialValue: "")
            _extractionFailed = State(initialValue: false)
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
                        if extractionFailed {
                            ContentUnavailableView {
                                Label("未能提取正文", systemImage: "doc.text.magnifyingglass")
                            } description: {
                                Text("请重试，或选择存为链接书签。")
                            } actions: {
                                if extracting { ProgressView().accessibilityLabel("正在提取正文") }
                                else { Button("重试提取") { Task { await retryExtraction() } } }
                            }
                        } else if editor.failed {
                            ContentUnavailableView {
                                Label("未能打开正文", systemImage: "doc.text")
                            } actions: {
                                Button("重新打开正文") { editor = ArticleEditorController() }
                            }
                        } else {
                            ArticleEditorSurface(content: content, language: folder?.preview.language ?? "English", controller: editor, disabled: busy || extracting) { content = $0 }
                                .id(ObjectIdentifier(editor))
                                .frame(minHeight: 360, idealHeight: 480)
                                .listRowInsets(EdgeInsets())
                                .accessibilityIdentifier("browser-import-editor")
                        }
                    } header: {
                        sectionHeading("编辑全文")
                    } footer: {
                        if contentTooLong, let limit { Text("全文共 \(content.utf16.count) 字符，超过此文件夹的 \(limit) 字符上限。请缩短正文。") }
                        else if !extractionFailed && content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { Text("请输入正文，或选择存为链接书签。") }
                    }
                }
            }
            .disabled(busy || uncertain)
            .navigationTitle(request.title).navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) }
                if path.isEmpty {
                    ToolbarItem(placement: .confirmationAction) {
                        Button {
                            if uncertain { dismiss(); workspace.visit(.bookmarks) }
                            else { confirmImport() }
                        } label: {
                            if busy { ProgressView() } else { Text(uncertain ? "查看我的书签" : file == nil && fullText ? "导入" : request.confirmation) }
                        }.disabled(!uncertain && (!valid || busy || extracting || (file == nil && fullText && !editor.ready) || sync?.online == false))
                            .accessibilityIdentifier("browser-import-submit")
                    }
                }
            }
            .navigationDestination(for: ImportStep.self) { step in
                switch step {
                case .folder: BrowserFolderPicker(workspace: workspace, selection: folderSelection)
                }
            }
            .interactiveDismissDisabled(busy)
        }
            .onChange(of: titleFocused) { if titleFocused { ebookDraft.takeTitle() } }
            .onChange(of: content) { if !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { extractionFailed = false } }
            .alert(failureTitle, isPresented: Binding(get: { failure != nil }, set: { if !$0 { failure = nil } }), presenting: failure) { problem in
                switch problem {
                case .save(_, true): Button("重试") { confirmImport() }
                case .editor: Button("重新打开正文") { editor = ArticleEditorController() }
                case .uncertain: Button("查看我的书签") { dismiss(); workspace.visit(.bookmarks) }
                case .save(_, false): EmptyView()
                }
                Button(problem.dismissal, role: .cancel) { }
            } message: { problem in Text(problem.message) }
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
    private func retryExtraction() async {
        guard let draft, !extracting else { return }
        extracting = true
        defer { extracting = false }
        do {
            guard workspace.browser.url == draft.url else { return }
            let recovered = try await workspace.browser.extractArticle()
            guard !Task.isCancelled else { return }
            if title == draft.title { title = recovered.title }
            content = recovered.content
            extractionFailed = recovered.extractionFailed
            editor = ArticleEditorController()
        } catch { }
    }
    private func submit() async {
        guard valid, let folder, !busy, !uncertain else { return }
        if file != nil { ebookDraft.stop() }
        titleFocused = false
        busy = true; failure = nil
        defer { busy = false }
        if file == nil && fullText {
            do {
                editor.web?.endEditing(true)
                content = try await editor.markdown()
            } catch {
                failure = .editor
                return
            }
            guard valid else { return }
        }
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
                self.failure = uncertain ? .uncertain : .save(message: failure.error.message, retryable: failure.error.retryable)
            } else {
                uncertain = importStarted && file != nil
                failure = uncertain ? .uncertain : .save(message: !importStarted ? "网站文件夹设置未能保存，请重试。" : "请稍后重试。", retryable: true)
            }
        }
    }
}
