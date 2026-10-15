import SwiftUI
import LeximoryCore

struct FolderEditorRequest: Identifiable {
    let id = UUID()
    var library: CatalogLibrary?
}

struct BrowserFoldersView: View {
    @Bindable var workspace: BrowserWorkspaceModel
    @Environment(\.nativeSync) private var sync
    @Environment(\.browserChromeHeight) private var chromeHeight
    @State private var archiveExpanded = false
    @State private var editor: FolderEditorRequest?
    private var folders: [CatalogLibrary] { workspace.libraries.filter { !$0.shadow } }
    var body: some View {
        List {
            Section {
                HStack {
                    Text("我的书签").editorialFont(30, relativeTo: .largeTitle)
                    Spacer()
                    Button("新建文件夹", systemImage: "folder.badge.plus") { editor = FolderEditorRequest() }
                        .labelStyle(.iconOnly).disabled(sync?.online == false)
                }.listRowBackground(Color.clear)
            }
            Group {
                if !workspace.recentTexts.isEmpty {
                    Section("继续阅读") {
                        ForEach(workspace.recentTexts.prefix(5)) { recent in BrowserResourceRow(text: recent) { Task { await workspace.open(recent) } } }
                    }
                }
                Section {
                    ForEach(folders.filter { !$0.archived }) { library in folder(library) }
                }
                if folders.contains(where: \.archived) {
                    Section {
                        DisclosureGroup("已归档", isExpanded: $archiveExpanded) {
                            ForEach(folders.filter(\.archived)) { library in folder(library) }
                        }.foregroundStyle(.secondary)
                    }
                }
                if folders.isEmpty && !workspace.loading { LeximoryUnavailableView("还没有书签", systemImage: "bookmark", message: "保存网页，或打开一本电子书。") }
            }
            if workspace.loading { ProgressView().frame(maxWidth: .infinity).listRowBackground(Color.clear) }
        }
        .listStyle(.insetGrouped)
        .animation(.default, value: workspace.expandedFolders)
        .scrollContentBackground(.hidden)
        .font(LeximoryTypography.interface(17))
        .frame(maxWidth: LeximoryLayout.libraryMeasure)
        .frame(maxWidth: .infinity)
        .background(LeximoryPalette.shell)
        .safeAreaPadding(.bottom, chromeHeight)
        .refreshable {
            await workspace.refresh(online: sync?.online != false)
            for folder in folders where workspace.expandedFolders.contains(folder.id) { await workspace.loadFolder(folder, online: sync?.online != false) }
        }
        .sheet(item: $editor) { request in
            FolderEditorSheet(client: workspace.client, library: request.library) { workspace.upsertFolder($0) }
        }
        .tint(.primary)
        .accessibilityIdentifier("browser-bookmarks")
    }
    private func folder(_ library: CatalogLibrary) -> some View {
        DisclosureGroup(isExpanded: Binding(get: { workspace.expandedFolders.contains(library.id) }, set: { expanded in
            if expanded { workspace.expandedFolders.insert(library.id) }
            else { workspace.expandedFolders.remove(library.id) }
        })) {
            BrowserFolderContents(workspace: workspace, library: library)
        } label: {
            BrowserFolderLabel(library: library).frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier("browser-folder-toggle-\(library.id)")
        }

        .contextMenu {
            if library.owned {
                Button("重新命名", systemImage: "pencil") { editor = FolderEditorRequest(library: library) }.disabled(sync?.online == false)
            }
            Button(library.archived ? "取消归档" : "归档", systemImage: "archivebox") { Task { await workspace.setArchived(library) } }.disabled(sync?.online == false)
        }
    }
}

private struct BrowserFolderContents: View {
    let workspace: BrowserWorkspaceModel
    let library: CatalogLibrary
    @Environment(\.nativeSync) private var sync
    @State private var loaded = false
    var body: some View {
        Group {
            if let texts = workspace.texts[library.id] {
                ForEach(texts) { text in BrowserResourceRow(text: text) { Task { await workspace.open(text) } }.padding(.leading, 16) }
                if texts.isEmpty { Text("还没有书签").foregroundStyle(.secondary).padding(.leading, 16) }
            } else if !loaded { ProgressView().padding(.leading, 16) }
            else { Button("重试") { Task { await workspace.loadFolder(library, online: sync?.online != false) } } }
        }
        .task(id: library.id) { await workspace.loadFolder(library, online: sync?.online != false); loaded = true }
    }
}

struct BrowserFolderLabel: View {
    let library: CatalogLibrary
    var body: some View {
        Label {
            VStack(alignment: .leading, spacing: 4) {
                Text(library.name).font(LeximoryTypography.interface(17)).foregroundStyle(.primary)
                Text(library.preview.localizedLanguage).font(LeximoryTypography.interface(13, style: .caption1)).foregroundStyle(.secondary)
            }
        } icon: { Image(systemName: "folder").foregroundStyle(.secondary) }
        .padding(.vertical, 4)
    }
}

struct BrowserResourceRow: View {
    let text: CatalogText
    let open: () -> Void
    var body: some View {
        Button(action: open) {
            Label {
                VStack(alignment: .leading, spacing: 4) {
                    Text(text.title).editorialFont(16, relativeTo: .body, language: nil).foregroundStyle(.primary).lineLimit(2)
                    if !text.topics.isEmpty {
                        HStack(spacing: 12) {
                            ForEach(Array(text.topics.prefix(2)), id: \.self) { topic in Text(topic) }
                        }.font(LeximoryTypography.interface(13, style: .caption1)).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
            } icon: {
                BrowserTextIcon(text: text).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .contentShape(Rectangle())
        }.buttonStyle(.plain).padding(.vertical, 4).accessibilityIdentifier("browser-resource-\(text.id)")
    }
}

struct BrowserFolderPicker: View {
    @Bindable var workspace: BrowserWorkspaceModel
    @Binding var selection: String?
    @Environment(\.dismiss) private var dismiss
    @State private var editor: FolderEditorRequest?
    @State private var archived = false
    @State private var expanded: Set<String> = []
    @Environment(\.nativeSync) private var sync
    var body: some View {
        List {
            Section { ForEach(workspace.writableFolders.filter { !$0.archived }) { library in row(library) } }
            if workspace.writableFolders.contains(where: \.archived) {
                Section { DisclosureGroup("已归档", isExpanded: $archived) { ForEach(workspace.writableFolders.filter(\.archived)) { library in row(library) } } }
            }
            Section { Button("新建文件夹", systemImage: "folder.badge.plus") { editor = FolderEditorRequest() }.disabled(sync?.online == false) }
        }
        .font(LeximoryTypography.interface(17))
        .navigationTitle("选择文件夹").navigationBarTitleDisplayMode(.inline)
        .sheet(item: $editor) { request in
            FolderEditorSheet(client: workspace.client, library: request.library) { library in
                workspace.upsertFolder(library); selection = library.id
            }
        }
        .tint(.primary)
    }
    private func row(_ library: CatalogLibrary) -> some View {
        DisclosureGroup(isExpanded: Binding(get: { expanded.contains(library.id) }, set: { value in
            if value { expanded.insert(library.id) } else { expanded.remove(library.id) }
        })) {
            ForEach(workspace.texts[library.id] ?? []) { text in
                Label { Text(text.title) } icon: { BrowserTextIcon(text: text) }
                    .font(LeximoryTypography.interface(15, style: .subheadline)).foregroundStyle(.secondary).padding(.leading, 16)
            }
        } label: {
            HStack {
                BrowserFolderLabel(library: library)
                Spacer()
                Button(selection == library.id ? "已选择" : "选择") { selection = library.id; dismiss() }
                    .buttonStyle(.borderless).foregroundStyle(.primary)
                    .accessibilityIdentifier("browser-select-folder-\(library.id)")
            }
        }.task(id: expanded.contains(library.id)) {
            if expanded.contains(library.id) { await workspace.loadFolder(library, online: sync?.online != false) }
        }
    }
}

struct FolderEditorSheet: View {
    let client: MobileClient
    var library: CatalogLibrary?
    let saved: (CatalogLibrary) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var language = "en"
    @State private var busy = false
    @State private var error: String?
    @State private var requestID = UUID().uuidString
    private let languages = [("en", "英语"), ("fr", "法语"), ("ja", "日语"), ("zh", "古汉语"), ("nl", "荷兰语")]
    var body: some View {
        NavigationStack {
            Form {
                TextField("名称", text: $name)
                if library == nil {
                    Picker("语言", selection: $language) { ForEach(languages, id: \.0) { code, label in Text(label).tag(code) } }
                }
                if let error { Text(error).foregroundStyle(.secondary) }
            }
            .navigationTitle(library == nil ? "新建文件夹" : "重新命名").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) }
                ToolbarItem(placement: .confirmationAction) {
                    Button { Task { await save() } } label: { if busy { ProgressView() } else { Text("完成") } }
                        .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || name.count > 128 || busy)
                }
            }
            .onAppear { if let library { name = library.name; language = library.language } }
            .interactiveDismissDisabled(busy)
        }.font(LeximoryTypography.interface(17)).presentationDetents([.medium]).tint(.primary)
    }
    private func save() async {
        busy = true; error = nil
        defer { busy = false }
        do {
            let result: CatalogLibrary
            if let library { result = try await client.renameFolder(libraryID: library.id, name: name) }
            else { result = try await client.createFolder(name: name, language: language, requestID: requestID) }
            saved(result); dismiss()
        } catch { self.error = "文件夹未能保存，请重试。" }
    }
}

struct BrowserTextIcon: View {
    let text: CatalogText
    var body: some View {
        Group {
            if let emoji = text.emoji, !emoji.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text(emoji).font(.custom("LeximoryNotoEmoji", size: 22, relativeTo: .body))
            } else {
                Image(systemName: text.format == "ebook" ? "book.closed" : text.format == "bookmark" ? "globe" : "doc.text")
            }
        }.frame(width: 26).accessibilityHidden(true)
    }
}
