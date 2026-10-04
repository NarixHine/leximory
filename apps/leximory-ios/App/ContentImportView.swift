import SwiftUI
import UniformTypeIdentifiers
import LeximoryCore

struct ContentImportView: View {
    let library: FixtureLibrary
    let client: MobileClient
    let imported: (CatalogText) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var kind = 2
    @State private var url = ""
    @State private var extracted = false
    @State private var title = ""
    @State private var content = ""
    @State private var onlyComments = false
    @State private var generateTitle = false
    @State private var choosingFile = false
    @State private var ebook: ImportedFile?
    @State private var busy = false
    @State private var error: String?
    @State private var uncertain = false
    @FocusState private var focusedField: String?
    private struct ImportedFile { let name: String; let data: Data }
    private var lengthLimit: Int {
        switch library.language { case "English", "French": 30000; case "Chinese": 5000; default: 10000 }
    }
    private var isText: Bool { kind == 0 || (kind == 2 && extracted) }
    private var valid: Bool {
        if kind == 2 && !extracted { return URL(string: url).map { ["http", "https"].contains($0.scheme?.lowercased() ?? "") && $0.host != nil } ?? false }
        return !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && title.count <= 512 &&
        (kind != 1 ? !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && content.utf16.count <= lengthLimit : ebook != nil)
    }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Picker("导入方式", selection: $kind) {
                        Text("网址导入外刊").tag(2)
                        Text("手动录入").tag(0)
                        Text("上传电子书").tag(1)
                    }.pickerStyle(.segmented).disabled(busy || uncertain)
                    if kind == 2 {
                        TextField("https://www.theatlantic.com/", text: $url)
                            .focused($focusedField, equals: "网址").submitLabel(.go)
                            .onSubmit { focusedField = nil; if !extracted { Task { await submit(annotate: true) } } }
                            .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                            .font(LeximoryTypography.interface(17)).padding(16)
                            .background(LeximoryPalette.paper, in: RoundedRectangle(cornerRadius: 18))
                            .accessibilityLabel("网址")
                            .onChange(of: url) { extracted = false }
                    }
                    if kind != 2 || extracted { input("标题", text: $title, lines: 1...3) }
                    if isText {
                        input("文本", text: $content, lines: 8...20)
                        if content.utf16.count > lengthLimit {
                            Text("文本长度超过 \(lengthLimit) 字符").font(LeximoryTypography.interface(14)).foregroundStyle(LeximoryPalette.muted)
                        }
                        Button("选择文件", systemImage: "doc.badge.plus") { choosingFile = true }
                            .foregroundStyle(LeximoryPalette.sage)
                        Text("AI 注解可能含有错误").font(LeximoryTypography.interface(13)).foregroundStyle(LeximoryPalette.muted)
                        if library.language != "Chinese" { Toggle("仅生成词摘", isOn: $onlyComments) }
                        Toggle("AI 生成标题", isOn: $generateTitle)
                    } else if kind == 1 {
                        Button { choosingFile = true } label: {
                            VStack(spacing: 14) {
                                Image(systemName: "doc.badge.arrow.up").font(.system(size: 32, weight: .light))
                                Text(ebook?.name ?? "上传电子书").font(LeximoryTypography.interface(17)).multilineTextAlignment(.center)
                                if let ebook { Text(ByteCountFormatter.string(fromByteCount: Int64(ebook.data.count), countStyle: .file)).font(LeximoryTypography.interface(13)) }
                            }.foregroundStyle(LeximoryPalette.sage).frame(maxWidth: .infinity, minHeight: 180)
                                .background(LeximoryPalette.cover, in: RoundedRectangle(cornerRadius: 28))
                        }.buttonStyle(.plain).accessibilityLabel("选择 EPUB 或 PDF")
                    }
                    if let error { Text(error).font(LeximoryTypography.interface(14)).foregroundStyle(LeximoryPalette.muted) }
                    HStack(spacing: 16) {
                        if isText {
                            Button("保存") { Task { await submit(annotate: false) } }
                                .frame(minWidth: 44, minHeight: 48).contentShape(Rectangle())
                                .foregroundStyle(LeximoryPalette.sage)
                        }
                        Button { Task { await submit(annotate: kind != 1) } } label: {
                            HStack(spacing: 8) {
                                if busy { ProgressView().tint(LeximoryPalette.paper) }
                                else { Image(systemName: kind == 1 ? "arrow.up.doc" : "airplane") }
                                Text(busy ? (kind != 1 ? "导入中……" : "上传中……") : (isText ? "生成" : "导入"))
                            }.frame(maxWidth: .infinity, minHeight: 48)
                                .foregroundStyle(LeximoryPalette.paper).background(LeximoryPalette.ink, in: Capsule())
                        }.buttonStyle(.plain).accessibilityIdentifier("content-import-submit")
                    }.disabled(!valid || busy || uncertain)
                }.padding(24).frame(maxWidth: 580).frame(maxWidth: .infinity)
                    .disabled(busy || uncertain)
            }.scrollDismissesKeyboard(.interactively).background(LeximoryPalette.shell)
                .navigationTitle("创建文章").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("取消", role: .cancel) { dismiss() }.buttonStyle(.plain)
                            .foregroundStyle(LeximoryPalette.muted).disabled(busy)
                    }.sharedBackgroundVisibility(.hidden)
                }
                .interactiveDismissDisabled(busy)
                .fileImporter(isPresented: $choosingFile, allowedContentTypes: kind != 1 ? [.plainText, UTType(filenameExtension: "md") ?? .plainText] : [.epub, .pdf]) { result in
                    Task { await readFile(result) }
                }
        }.tint(LeximoryPalette.sage).presentationDetents([.large])
    }
    private func input(_ label: String, text: Binding<String>, lines: ClosedRange<Int>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label).font(LeximoryTypography.interface(15)).foregroundStyle(LeximoryPalette.illustration)
            TextField(label, text: text, axis: .vertical).lineLimit(lines).focused($focusedField, equals: label).accessibilityLabel(label).accessibilityIdentifier("import-\(label)").font(LeximoryTypography.prose(18, language: library.language))
                .padding(14).background(LeximoryPalette.paper, in: RoundedRectangle(cornerRadius: 18))
        }
    }
    private func readFile(_ result: Result<URL, Error>) async {
        do {
            let url = try result.get()
            let isArticle = kind != 1
            let loaded = try await Task.detached {
                let access = url.startAccessingSecurityScopedResource()
                defer { if access { url.stopAccessingSecurityScopedResource() } }
                let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                guard size > 0, size <= 4_718_592 else { throw ImportError.message("发生错误，文件需小于 4.5MB") }
                let data = try Data(contentsOf: url)
                guard data.count <= 4_718_592 else { throw ImportError.message("发生错误，文件需小于 4.5MB") }
                return data
            }.value
            if isArticle {
                guard let text = String(data: loaded, encoding: .utf8) ?? String(data: loaded, encoding: .utf16) else { throw ImportError.message("不支持的文本编码") }
                content = text
            } else { ebook = ImportedFile(name: url.lastPathComponent, data: loaded) }
            if title.isEmpty { title = url.deletingPathExtension().lastPathComponent }
            error = nil
        } catch {
            if (error as NSError).code != NSUserCancelledError { self.error = (error as? ImportError)?.description ?? "无法读取文件，请重试。" }
        }
    }
    private func submit(annotate: Bool) async {
        guard valid, !busy, !uncertain else { return }
        focusedField = nil
        busy = true; error = nil
        defer { busy = false }
        do {
            let text: CatalogText
            if kind == 2 && !extracted {
                let preview = try await client.extractArticle(libraryID: library.id.rawValue, url: url)
                title = preview.title; content = preview.content; extracted = true
                return
            }
            if kind != 1 {
                text = try await client.importArticle(libraryID: library.id.rawValue, title: title, content: content,
                    annotate: annotate, onlyComments: onlyComments, generateTitle: generateTitle)
            } else {
                guard let ebook else { return }
                text = try await client.uploadEbook(libraryID: library.id.rawValue, title: title, filename: ebook.name, data: ebook.data)
            }
            imported(text); dismiss()
        } catch {
            if let failure = MobileClient.cause(of: error) as? MobileFailure {
                uncertain = !(kind == 2 && !extracted) && failure.error.code == "service_unavailable"
                self.error = uncertain ? "未能确认导入结果，请先查看文库，避免重复导入。" : failure.error.message
            }
            else if kind == 2 && !extracted { self.error = "文章解析失败，请手动录入" }
            else { uncertain = true; self.error = "未能确认导入结果，请先查看文库，避免重复导入。" }
        }
    }
    private enum ImportError: Error { case message(String)
        var description: String { switch self { case .message(let text): text } }
    }
}
