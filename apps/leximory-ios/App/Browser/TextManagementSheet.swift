import SwiftUI
import UniformTypeIdentifiers
import LeximoryCore

private enum TextManagementDestination: Hashable { case content }

struct TextManagementSheet: View {
    let text: CatalogText
    let workspace: BrowserWorkspaceModel
    let playback: PlaybackController
    @Environment(\.dismiss) private var dismiss
    @Environment(\.nativeSync) private var sync
    @State private var path: [TextManagementDestination] = []
    @State private var source: EditableText?
    @State private var draft: TextEdit?
    @State private var topics = ""
    @State private var busy = false
    @State private var loading = true
    @State private var error: String?
    @State private var needsReload = false
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
            && parsedTopics.count <= 32 && parsedTopics.allSatisfy { $0.utf16.count <= 128 }
    }
    private var emojiValid: Bool {
        guard let value = draft?.emoji else { return true }
        return value.count == 1 && value.unicodeScalars.contains {
            $0.properties.isEmojiPresentation || ($0.properties.isEmoji && $0.value > 127) || $0.value == 0x20E3
        }
    }
    private var parsedTopics: [String] {
        if let source, topics == source.text.topics.joined(separator: "，") { return source.text.topics }
        var seen = Set<String>()
        return topics.components(separatedBy: CharacterSet(charactersIn: ",，\n"))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty && seen.insert($0).inserted }
    }
    var body: some View {
        NavigationStack(path: $path) {
            Form {
                if let source, draft != nil {
                    Section {
                        TextField("标题", text: draftBinding(\.title), axis: .vertical).lineLimit(1...4)
                            .accessibilityIdentifier("text-edit-title")
                        TextField("主题", text: $topics, axis: .vertical).lineLimit(1...3)
                        TextField("封面表情", text: Binding(get: { draft?.emoji ?? "" }, set: { draft?.emoji = $0.isEmpty ? nil : $0 }))
                    } footer: {
                        if emojiValid { Text("多个主题用逗号分隔。") }
                        else { Text("封面请选择一个表情，或留空。") }
                    }
                    if source.text.format == "article" {
                        Section {
                            NavigationLink(value: TextManagementDestination.content) { Label("编辑全文", systemImage: "pencil") }
                                .disabled(!source.contentEditable || unavailable)
                        }
                    }
                    Section {
                        Button(source.text.format == "ebook" ? "替换电子书" : "添加电子书", systemImage: "doc.badge.arrow.up") { choosingFile = true }
                            .disabled(unavailable)
                        if let file { Text(file.name).foregroundStyle(.secondary) }
                        if source.text.format == "ebook" {
                            Button("移除电子书文件", role: .destructive) { confirmingFileRemoval = true }.disabled(unavailable)
                        }
                    }
                    Section {
                        Button(source.text.format == "ebook" ? "删除电子书" : "删除文章", role: .destructive) { confirmingDelete = true }.disabled(unavailable)
                            .accessibilityIdentifier("text-delete")
                    }
                } else if loading { ProgressView().frame(maxWidth: .infinity) }
                if let error {
                    Section {
                        Text(error).foregroundStyle(.secondary).accessibilityIdentifier("text-edit-error")
                        if source == nil { Button("重试") { Task { await load() } }.disabled(unavailable) }
                        if needsReload { Button("重新载入") { confirmingReload = true }.disabled(unavailable) }
                    }
                }
            }.font(LeximoryTypography.interface(17)).disabled(busy)
                .navigationTitle("编辑").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    if path.isEmpty {
                        ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) }
                        ToolbarItem(placement: .confirmationAction) {
                            Button { Task { await save() } } label: {
                                if busy { ProgressView() } else { Text("保存") }
                            }.disabled(!valid || source == nil || unavailable || needsReload).accessibilityIdentifier("text-edit-save")
                        }
                    }
                }
                .navigationDestination(for: TextManagementDestination.self) { _ in
                    ArticleEditorPage(content: draftBinding(\.content), language: language)
                }
                .task { await load() }
                .fileImporter(isPresented: $choosingFile, allowedContentTypes: [.epub, .pdf]) { result in
                    Task {
                        do {
                            let selected = try result.get()
                            file = try await BrowserEbookFile.read(selected)
                            error = nil; confirmingReplacement = true
                        } catch {
                            if (error as? CocoaError)?.code != .userCancelled { self.error = "请选择不超过 4.5 MB 的 EPUB 或 PDF。" }
                        }
                    }
                }
                .confirmationDialog(source?.text.format == "ebook" ? "替换电子书？" : "添加电子书？", isPresented: $confirmingReplacement, titleVisibility: .visible) {
                    Button(source?.text.format == "ebook" ? "替换" : "添加", role: source?.text.format == "ebook" ? .destructive : nil) { Task { await changeFile(removing: false) } }
                    Button("取消", role: .cancel) { file = nil }
                } message: { Text("阅读位置将重置，荧光笔摘录会保留。") }
                .confirmationDialog("移除电子书文件？", isPresented: $confirmingFileRemoval, titleVisibility: .visible) {
                    Button("移除文件", role: .destructive) { Task { await changeFile(removing: true) } }
                    Button("取消", role: .cancel) {}
                } message: { Text("标题、正文和荧光笔摘录会保留。") }
                .confirmationDialog("舍弃当前修改？", isPresented: $confirmingReload, titleVisibility: .visible) {
                    Button("重新载入", role: .destructive) {
                        source = nil; draft = nil; needsReload = false
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
    private var language: String {
        workspace.documents[text.id]?.library.preview.language ?? workspace.libraries.first { $0.id == text.libraryId }?.preview.language ?? "English"
    }
    private func draftBinding(_ key: WritableKeyPath<TextEdit, String>) -> Binding<String> {
        Binding(get: { draft?[keyPath: key] ?? "" }, set: { draft?[keyPath: key] = $0 })
    }
    private func load() async {
        guard source == nil else { return }
        loading = true; error = nil
        defer { loading = false }
        do {
            let value = try await workspace.client.editableText(id: text.id)
            try Task.checkCancellation()
            source = value; draft = TextEdit(value)
            if draft?.emoji == "" { draft?.emoji = nil }
            topics = value.text.topics.joined(separator: "，")
        } catch { if !Task.isCancelled { self.error = "暂时无法编辑，请稍后重试。" } }
    }
    private func save() async {
        guard !unavailable, valid, let source, var fields = draft else { return }
        fields.title = fields.title.trimmingCharacters(in: .whitespacesAndNewlines); fields.topics = parsedTopics
        busy = true; error = nil
        defer { busy = false }
        do {
            let updated = try await workspace.client.editText(id: text.id, revision: source.revision, fields: fields)
            let changedContent = fields.content != source.content
            if changedContent { playback.stop() }
            await workspace.contentChanged(updated, reloadReader: changedContent)
            dismiss()
        } catch {
            needsReload = (MobileClient.cause(of: error) as? MobileFailure)?.error.code == "stale_revision"
            self.error = needsReload ? "文章已更新，请重新载入。" : "修改未能保存，请重试。"
        }
    }
    private func changeFile(removing: Bool) async {
        guard !unavailable, removing || file != nil else { return }
        busy = true; error = nil
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
            // Keep metadata drafts when a file operation is performed in the same edit sheet.
            do {
                let refreshed = try await workspace.client.editableText(id: text.id)
                if let source, TextEdit(refreshed) != TextEdit(source) {
                    needsReload = true; self.error = "文章已更新，请重新载入。"
                } else { source = refreshed }
            } catch { needsReload = true; self.error = "文件已更新，请重新载入后继续编辑。" }
            file = nil
        } catch { self.error = removing ? "文件未能移除，请重试。" : "文件未能替换，请重试。" }
    }
    private func remove() async {
        guard !unavailable else { return }
        busy = true; error = nil
        defer { busy = false }
        do {
            try await workspace.client.removeText(text)
            playback.stop(); workspace.contentRemoved(text); dismiss()
        } catch { self.error = "删除未能完成，请重试。" }
    }
}
