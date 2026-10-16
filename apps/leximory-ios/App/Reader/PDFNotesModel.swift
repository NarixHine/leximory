import SwiftUI
import PencilKit
import LeximoryCore

@MainActor @Observable final class PDFNotesModel {
    let document: PDFNoteDocument
    let store: PDFNotesStore
    private let book: LocalEbook
    private weak var sync: NativeSync?
    private(set) var drawing = false
    private(set) var preparing = false
    private(set) var revision = 0
    private(set) var localError = false
    private(set) var loadError = false
    private(set) var problems: [PDFNoteRecord] = []
    var showsProblems = false
    @ObservationIgnored private var working: [Int: PDFPageDrawing] = [:]
    @ObservationIgnored private var debounce: Task<Void, Never>?
    @ObservationIgnored private var writes: Task<Void, Never>?

    init(book: LocalEbook, store: PDFNotesStore, sync: NativeSync?) {
        self.book = book; self.store = store; self.sync = sync
        document = PDFNoteDocument(textID: book.descriptor.text.id, pdfVersion: book.descriptor.pdfSourceVersion ?? "")
    }
    func toggleDrawing() async {
        if drawing { drawing = false; flush(); return }
        guard !preparing else { return }
        preparing = true
        defer { preparing = false }
        do {
            try await store.retain(book)
            localError = false; drawing = true
        } catch { localError = true; showsProblems = true }
    }
    func deactivate() { drawing = false; flush(); if sync?.activePDF == document { sync?.activePDF = nil } }
    func run() async {
        let updates = await store.updates()
        sync?.activePDF = document; sync?.scheduleNotes()
        await refreshProblems()
        for await key in updates {
            guard !Task.isCancelled else { return }
            if key.document == document { revision += 1; await refreshProblem(key) }
        }
    }
    func page(_ index: Int) async throws -> PDFPageDrawing? {
        if let note = working[index] { return note }
        return try await store.record(for: PDFNoteKey(document: document, pageIndex: index))?.note
    }
    @discardableResult func capture(page: Int, data: Data, size: CGSize) -> PDFPageDrawing {
        let note = PDFPageDrawing(pageIndex: page, drawing: data, canvasWidth: size.width, canvasHeight: size.height)
        working[page] = note
        debounce?.cancel()
        debounce = Task { [weak self] in
            do { try await Task.sleep(for: .milliseconds(150)) } catch { return }
            self?.flush()
        }
        return note
    }
    @discardableResult func flush() -> Task<Void, Never>? {
        debounce?.cancel()
        guard !working.isEmpty else { return writes }
        let snapshot = working
        let previous = writes
        let task = Task { [self] in
            await previous?.value
            var failed = false
            for (page, note) in snapshot {
                guard working[page]?.revision == note.revision else { continue }
                do {
                    try await store.saveLocal(note, for: PDFNoteKey(document: document, pageIndex: page))
                    if working[page]?.revision == note.revision { working[page] = nil }
                } catch { failed = true; drawing = false; showsProblems = true }
            }
            if failed { localError = true }
            else if working.isEmpty { localError = false }
            sync?.scheduleNotes()
        }
        writes = task
        return task
    }
    private func refreshProblems() async {
        do {
            var found: [PDFNoteRecord] = []
            for key in try await store.keys() where key.document == document {
                guard let record = try await store.record(for: key) else { continue }
                switch record.state {
                case .conflict, .blocked: found.append(record)
                default: break
                }
            }
            problems = found.sorted { $0.key.pageIndex < $1.key.pageIndex }
        } catch { if !Task.isCancelled { loadError = true } }
    }
    private func refreshProblem(_ key: PDFNoteKey) async {
        do {
            let record = try await store.record(for: key)
            problems.removeAll { $0.key == key }
            if let record {
                switch record.state {
                case .conflict, .blocked: problems.append(record); problems.sort { $0.key.pageIndex < $1.key.pageIndex }
                default: break
                }
            }
        } catch { if !Task.isCancelled { loadError = true } }
    }
    func resolve(_ key: PDFNoteKey, keepingLocal: Bool) async {
        await flush()?.value
        do { try await store.resolve(key, keepingLocal: keepingLocal); revision += 1; sync?.scheduleNotes(); await refreshProblems() }
        catch { localError = true }
    }
    func retry(_ key: PDFNoteKey) async {
        do { try await store.retry(key); sync?.scheduleNotes() } catch { localError = true }
    }
    func retryLoading() { loadError = false; revision += 1 }
    func failedToLoad() { loadError = true; drawing = false; showsProblems = true }
}

struct PDFNotesProblems: View {
    let model: PDFNotesModel
    var body: some View {
        NavigationStack {
            List {
                if model.localError {
                    Section {
                        Text("笔记尚未保存，请腾出一些设备空间后重试。")
                        Button("重试保存") { model.flush() }
                    }
                }
                if model.loadError {
                    Section {
                        Text("笔记暂时无法打开，请重试。")
                        Button("重试打开") { model.retryLoading() }
                    }
                }
                ForEach(model.problems, id: \.key) { record in
                    Section("第\(record.key.pageIndex + 1)页") {
                        switch record.state {
                        case .conflict(let other):
                            Text("这页在另一台设备上也有修改。请选择要继续使用的版本。")
                            HStack(alignment: .top) {
                                preview(record.note, title: "本机")
                                preview(other, title: "另一台设备")
                            }
                            Button("使用本机版本") { Task { await model.resolve(record.key, keepingLocal: true) } }
                            Button("使用另一设备版本") { Task { await model.resolve(record.key, keepingLocal: false) } }
                        case .blocked(let problem):
                            Text(problem == .tooLarge ? "这页的笔记过多，暂时无法备份。请擦除不需要的笔迹后重试。"
                                 : problem == .accessDenied ? "已保留本机笔记。恢复这份电子书的访问权限后才能继续备份。"
                                 : "已保留本机笔记，暂时无法备份到账号。")
                            if problem == .tooLarge {
                                Button("继续编辑笔记") {
                                    model.showsProblems = false
                                    Task { await model.toggleDrawing() }
                                }
                            } else { Button("重试备份") { Task { await model.retry(record.key) } } }
                        default: EmptyView()
                        }
                    }
                }
            }
            .font(LeximoryTypography.interface(16))
            .navigationTitle("手写笔记").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { model.showsProblems = false } } }
        }
        .frame(minWidth: 320, idealHeight: 440)
        .presentationDetents([.medium, .large])
    }
    private func preview(_ note: PDFPageDrawing, title: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).foregroundStyle(.secondary)
            if let drawing = try? PKDrawing(data: note.drawing) {
                Image(uiImage: drawing.image(from: CGRect(x: 0, y: 0, width: note.canvasWidth, height: note.canvasHeight), scale: min(1, min(360 / note.canvasWidth, 200 / note.canvasHeight))))
                    .resizable().scaledToFit().frame(maxHeight: 200).background(.white)
            }
        }.frame(maxWidth: .infinity)
    }
}
