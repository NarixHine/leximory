import SwiftUI
import LeximoryCore

struct BrowserPreferencesView: View {
    let client: MobileClient
    let domain: String
    let bookmarkMode: Bool
    let selectedLibraryID: String?
    let selected: (String?) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var libraries: [CatalogLibrary] = []
    @State private var rules: [BrowserRule] = []
    @State private var choice: String?
    @State private var remember = true
    @State private var busy = true
    @State private var loaded = false
    @State private var error: String?
    var body: some View {
        NavigationStack {
            Form {
                if !bookmarkMode {
                    Section {
                        Picker("收藏至", selection: $choice) {
                            Text("自动").tag(String?.none)
                            ForEach(libraries) { library in
                                Text(library.name + " · " + library.preview.localizedLanguage).tag(Optional(library.id))
                            }
                        }
                        Toggle("以后此网站都存这里", isOn: $remember).disabled(choice == nil)
                    } header: { Text(domain) }
                }
                if !rules.isEmpty {
                    Section("已设置的网站") {
                        ForEach(rules) { rule in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(rule.domain)
                                Text(libraries.first(where: { $0.id == rule.libraryId })?.name ?? "文库已不可用")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            .swipeActions {
                                Button("删除", role: .destructive) { Task { await remove(rule) } }.disabled(busy)
                            }
                        }
                    }
                }
                if busy { ProgressView() }
                if let error { Text(error).foregroundStyle(.secondary) }
            }
            .navigationTitle("词汇收藏设置").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { Task { await save() } }.disabled(busy || !loaded)
                }
            }
            .task { await load() }
        }
    }
    private func load() async {
        busy = true
        defer { busy = false }
        do {
            async let allLibraries = client.allLibraries()
            async let allRules = client.browserRules()
            libraries = try await allLibraries.filter(\.owned)
            rules = try await allRules
            choice = selectedLibraryID ?? rules.first(where: { $0.domain == domain })?.libraryId
            if !libraries.contains(where: { $0.id == choice }) { choice = nil }
            loaded = true
        } catch { self.error = "设置未能加载，请重新打开。" }
    }
    private func save() async {
        busy = true; error = nil
        defer { busy = false }
        do {
            if !bookmarkMode {
                if remember || choice == nil { try await client.setBrowserRule(domain: domain, libraryID: choice) }
                selected(choice)
            }
            dismiss()
        } catch { self.error = "设置未能保存，请重试。" }
    }
    private func remove(_ rule: BrowserRule) async {
        busy = true; error = nil
        defer { busy = false }
        do {
            try await client.setBrowserRule(domain: rule.domain, libraryID: nil)
            rules.removeAll { $0.domain == rule.domain }
            if rule.domain == domain { choice = nil; selected(nil) }
        } catch { self.error = "设置未能删除，请重试。" }
    }
}

struct BrowserBookmarkSheet: View {
    let client: MobileClient
    let url: String
    @Environment(\.dismiss) private var dismiss
    @State private var libraries: [CatalogLibrary] = []
    @State private var busy = false
    @State private var loading = true
    @State private var error: String?
    @State private var requestID = UUID().uuidString
    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(libraries) { library in
                        Button {
                            Task {
                                busy = true; error = nil
                                defer { busy = false }
                                do {
                                    _ = try await client.createBookmark(libraryID: library.id, url: url, requestID: requestID)
                                    dismiss()
                                } catch { self.error = "书签未能保存，请重试。" }
                            }
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(library.name)
                                Text(library.preview.localizedLanguage).font(.caption).foregroundStyle(.secondary)
                            }
                        }.foregroundStyle(.primary).disabled(busy)
                    }
                    if libraries.isEmpty && !loading { Text("请先创建一个文库。").foregroundStyle(.secondary) }
                } header: { Text("选择文库") }
                if loading || busy { ProgressView() }
                if let error { Text(error).foregroundStyle(.secondary) }
            }.navigationTitle("存为书签").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) } }
                .interactiveDismissDisabled(busy)
                .task {
                    defer { loading = false }
                    do { libraries = try await client.allLibraries().filter { $0.owned && !$0.shadow } }
                    catch { self.error = "文库未能加载，请重新打开。" }
                }
        }
    }
}
