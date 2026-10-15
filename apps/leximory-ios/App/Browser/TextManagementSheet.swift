import SwiftUI
import UniformTypeIdentifiers
import LeximoryCore

private enum TextManagementDestination: Hashable { case content }
private struct EditableTopic: Identifiable {
    let id = UUID()
    var value: String
}
private enum TextSaveIssue {
    case failed, conflict, fileChanged
    var message: String {
        switch self {
        case .failed: "修改未能保存。"
        case .conflict: "文章已更新，请重新载入。"
        case .fileChanged: "文件已更新，请重新载入后继续编辑。"
        }
    }
    var requiresReload: Bool {
        switch self { case .failed: false; case .conflict, .fileChanged: true }
    }
}

struct TextManagementSheet: View {
    let text: CatalogText
    let workspace: BrowserWorkspaceModel
    let playback: PlaybackController
    @Environment(\.dismiss) private var dismiss
    @Environment(\.nativeSync) private var sync
    @State private var path: [TextManagementDestination] = []
    @State private var source: EditableText?
    @State private var draft: TextEdit?
    @State private var topics: [EditableTopic] = []
    @FocusState private var focusedTopic: UUID?
    @State private var busy = false
    @State private var loading = true
    @State private var saveIssue: TextSaveIssue?
    @State private var fileError: String?
    @State private var removalFailed = false
    @State private var confirmingReload = false
    @State private var choosingFile = false
    @State private var file: BrowserEbookFile?
    @State private var confirmingDelete = false
    @State private var confirmingFileRemoval = false
    @State private var confirmingReplacement = false
    private var unavailable: Bool { busy || sync?.online == false }
    private var valid: Bool {
        guard let draft else { return false }
        return emojiValid && !draft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && draft.title.utf16.count <= 512
            && topics.count <= 32 && topics.allSatisfy { !$0.value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && $0.value.utf16.count <= 128 }
    }
    private var emojiValid: Bool {
        guard let value = draft?.emoji else { return true }
        return value.count == 1 && value.unicodeScalars.contains {
            $0.properties.isEmojiPresentation || ($0.properties.isEmoji && $0.value > 127) || $0.value == 0x20E3
        }
    }
    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if let source, draft != nil {
                    Form {
                        Section {
                            TextField("标题", text: draftBinding(\.title), axis: .vertical).lineLimit(1...4)
                                .accessibilityIdentifier("text-edit-title")
                            TextField("封面表情", text: Binding(get: { draft?.emoji ?? "" }, set: { draft?.emoji = $0.isEmpty ? nil : $0 }))
                        } footer: {
                            if !emojiValid { Text("封面请选择一个表情，或留空。") }
                        }
                        topicSection
                        if source.text.format == "article" {
                            Section {
                                NavigationLink(value: TextManagementDestination.content) { Label("编辑全文", systemImage: "pencil") }
                                    .disabled(!source.contentEditable || unavailable)
                            }
                        }
                        if source.text.format == "ebook" { ebookSection }
                        Section {
                            Button(source.text.format == "ebook" ? "删除电子书" : "删除文章", role: .destructive) { confirmingDelete = true }
                                .disabled(unavailable).accessibilityIdentifier("text-delete")
                        } footer: {
                            if removalFailed { Text("删除未能完成，请重试。").accessibilityAddTraits(.updatesFrequently) }
                        }
                    }.disabled(busy).scrollDismissesKeyboard(.interactively)
                } else if loading {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    LeximoryUnavailableView("暂时无法编辑", systemImage: "pencil") {
                        Button("重试") { Task { await load() } }.disabled(unavailable)
                    }
                }
            }
            .font(LeximoryTypography.interface(17))
            .navigationTitle("编辑").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if path.isEmpty {
                    ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) }
                    ToolbarItem(placement: .confirmationAction) {
                        Button { Task { await save() } } label: {
                            if busy { ProgressView() } else { Text("保存") }
                        }.disabled(!valid || source == nil || unavailable || saveIssue?.requiresReload == true)
                            .accessibilityIdentifier("text-edit-save")
                    }
                }
            }
            .safeAreaInset(edge: .top, spacing: 0) {
                if path.isEmpty, let saveIssue { saveFeedback(saveIssue) }
            }
            .navigationDestination(for: TextManagementDestination.self) { _ in
                ArticleEditorPage(content: draftBinding(\.content), language: language)
            }
            .task { await load() }
            .fileImporter(isPresented: $choosingFile, allowedContentTypes: [.epub, .pdf]) { result in
                Task {
                    do {
                        file = try await BrowserEbookFile.read(result.get())
                        fileError = nil; confirmingReplacement = true
                    } catch {
                        if (error as? CocoaError)?.code != .userCancelled { fileError = "请选择不超过 4.5 MB 的 EPUB 或 PDF。" }
                    }
                }
            }
            .confirmationDialog("替换电子书？", isPresented: $confirmingReplacement, titleVisibility: .visible) {
                Button("替换", role: .destructive) { Task { await changeFile(removing: false) } }
                Button("取消", role: .cancel) { file = nil }
            } message: { Text("阅读位置将重置，荧光笔摘录会保留。") }
            .confirmationDialog("移除电子书文件？", isPresented: $confirmingFileRemoval, titleVisibility: .visible) {
                Button("移除文件", role: .destructive) { Task { await changeFile(removing: true) } }
                Button("取消", role: .cancel) {}
            } message: { Text("标题、正文和荧光笔摘录会保留。") }
            .confirmationDialog("舍弃当前修改？", isPresented: $confirmingReload, titleVisibility: .visible) {
                Button("重新载入", role: .destructive) {
                    source = nil; draft = nil; saveIssue = nil
                    Task { await load() }
                }
                Button("取消", role: .cancel) {}
            } message: { Text("当前未保存的修改会丢失。") }
            .confirmationDialog(source?.text.format == "ebook" ? "删除电子书？" : "删除文章？", isPresented: $confirmingDelete, titleVisibility: .visible) {
                Button("删除", role: .destructive) { Task { await remove() } }
                Button("取消", role: .cancel) {}
            } message: { Text("删除后无法恢复，已存词汇会保留。") }
            .interactiveDismissDisabled(busy || !path.isEmpty)
        }.tint(.primary)
    }
    private var topicSection: some View {
        Section("主题") {
            ForEach($topics) { $topic in
                HStack {
                    TextField("主题名称", text: $topic.value)
                        .lineLimit(1)
                        .focused($focusedTopic, equals: topic.id).submitLabel(.done)
                        .onSubmit { focusedTopic = nil }
                        .accessibilityIdentifier("text-topic-field")
                    Button("移除主题", systemImage: "minus.circle.fill", role: .destructive) {
                        if focusedTopic == topic.id { focusedTopic = nil }
                        topics.removeAll { $0.id == topic.id }
                    }.labelStyle(.iconOnly).buttonStyle(.borderless).frame(width: 44)
                        .accessibilityLabel("移除主题：\(topic.value)")
                }
            }
            Button("添加主题", systemImage: "plus") {
                let topic = EditableTopic(value: "")
                topics.append(topic); focusedTopic = topic.id
            }.disabled(topics.count >= 32 || topics.contains { $0.value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty })
                .accessibilityIdentifier("text-topic-add")
        }
    }
    private var ebookSection: some View {
        Section {
            Button("替换电子书", systemImage: "doc.badge.arrow.up") { choosingFile = true }
                .disabled(unavailable).accessibilityIdentifier("text-replace-ebook")
            if let file { Text(file.name).foregroundStyle(.secondary) }
            Button("移除电子书文件", role: .destructive) { confirmingFileRemoval = true }.disabled(unavailable)
        } footer: {
            if let fileError { Text(fileError).accessibilityAddTraits(.updatesFrequently) }
        }
    }
    private func saveFeedback(_ issue: TextSaveIssue) -> some View {
        HStack(alignment: .center, spacing: 16) {
            Label(issue.message, systemImage: "exclamationmark.circle")
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            Button(issue.requiresReload ? "重新载入" : "重试") {
                if issue.requiresReload { confirmingReload = true }
                else { Task { await save() } }
            }.disabled(unavailable).buttonStyle(.bordered).controlSize(.small)
                .lineLimit(1).fixedSize()
        }.font(LeximoryTypography.interface(14))
            .padding(.horizontal, 20).padding(.vertical, 12).background(.regularMaterial)
            .accessibilityIdentifier("text-save-feedback").accessibilityAddTraits(.updatesFrequently)
    }
    private var language: String {
        workspace.documents[text.id]?.library.preview.language ?? workspace.libraries.first { $0.id == text.libraryId }?.preview.language ?? "English"
    }
    private func draftBinding(_ key: WritableKeyPath<TextEdit, String>) -> Binding<String> {
        Binding(get: { draft?[keyPath: key] ?? "" }, set: { draft?[keyPath: key] = $0 })
    }
    private func load() async {
        guard source == nil else { return }
        loading = true
        defer { loading = false }
        do {
            let value = try await workspace.client.editableText(id: text.id)
            try Task.checkCancellation()
            source = value; draft = TextEdit(value)
            if draft?.emoji == "" { draft?.emoji = nil }
            topics = value.text.topics.map { EditableTopic(value: $0) }
        } catch { }
    }
    private func save() async {
        guard !unavailable, valid, let source, var fields = draft else { return }
        fields.title = fields.title.trimmingCharacters(in: .whitespacesAndNewlines)
        fields.topics = topics.map { $0.value.trimmingCharacters(in: .whitespacesAndNewlines) }
        busy = true; saveIssue = nil
        defer { busy = false }
        do {
            let updated = try await workspace.client.editText(id: text.id, revision: source.revision, fields: fields)
            let changedContent = fields.content != source.content
            if changedContent { playback.stop() }
            await workspace.contentChanged(updated, reloadReader: changedContent)
            dismiss()
        } catch {
            saveIssue = (MobileClient.cause(of: error) as? MobileFailure)?.error.code == "stale_revision" ? .conflict : .failed
        }
    }
    private func changeFile(removing: Bool) async {
        guard !unavailable, source?.text.format == "ebook", removing || file != nil else { return }
        busy = true; fileError = nil
        let saver = workspace.ebookTextID == text.id ? workspace.ebookReader?.positionSaver : nil
        await saver?.suspend()
        defer { busy = false; saver?.resume() }
        do {
            let updated: CatalogText
            if removing { updated = try await workspace.client.removeEbook(id: text.id) }
            else if let file { updated = try await workspace.client.replaceEbook(id: text.id, filename: file.name, data: file.data) }
            else { return }
            playback.stop()
            await workspace.contentChanged(updated)
            do {
                let refreshed = try await workspace.client.editableText(id: text.id)
                if let source, TextEdit(refreshed) != TextEdit(source) { saveIssue = .conflict }
                else { source = refreshed }
            } catch { saveIssue = .fileChanged }
            file = nil
        } catch { fileError = removing ? "文件未能移除，请重试。" : "文件未能替换，请重试。" }
    }
    private func remove() async {
        guard !unavailable else { return }
        busy = true; removalFailed = false
        defer { busy = false }
        do {
            try await workspace.client.removeText(text)
            playback.stop(); workspace.contentRemoved(text); dismiss()
        } catch { removalFailed = true }
    }
}
