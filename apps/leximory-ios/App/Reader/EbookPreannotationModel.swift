import SwiftUI
import LeximoryCore

struct PreparedEbookAnnotation: Hashable, Identifiable {
    let unit: EbookAnnotationUnit
    let unitID: String
    let annotation: EbookAnnotation
    var id: String { annotation.id }
}
struct EbookAnnotationSelection: Identifiable {
    let id = UUID()
    let prepared: PreparedEbookAnnotation
    let rect: CGRect
}

@MainActor @Observable final class EbookPreannotationModel {
    let textID: String
    let sourceVersion: String
    private(set) var enabled = true
    private(set) var revision = 0
    private(set) var units: [EbookAnnotationUnit] = []
    private var pages: [String: EbookAnnotationPage] = [:]
    private var failed = Set<String>()
    private var windowRevision = UUID()
    private var quotaBlocked = false
    private var loaded = Set<String>()
    private struct Preparation {
        let id: UUID
        let task: Task<Void, Never>
    }
    var online = true
    var active = true
    @ObservationIgnored private let client: MobileClient
    @ObservationIgnored private var preparations: [String: Preparation] = [:]
    @ObservationIgnored private var loading: Task<Void, Never>?

    init(textID: String, sourceVersion: String, client: MobileClient) {
        self.textID = textID; self.sourceVersion = sourceVersion; self.client = client
    }
    var annotations: [PreparedEbookAnnotation] {
        guard enabled else { return [] }
        return units.flatMap { unit in
            guard let page = pages[unit.id] else { return [PreparedEbookAnnotation]() }
            return page.annotations.map { PreparedEbookAnnotation(unit: unit, unitID: page.unitId, annotation: $0) }
        }
    }
    func restorePreference() async {
        enabled = await client.ebookPreannotationEnabled()
        revision += 1
    }
    func setEnabled(_ enabled: Bool) {
        self.enabled = enabled; revision += 1; failed.removeAll(); quotaBlocked = false
        Task { await client.setEbookPreannotationEnabled(enabled) }
        if enabled { units = [] } else { cancelPreparations(); loading?.cancel() }
    }
    func setWindow(_ values: [EbookAnnotationUnit]) {
        var ids = Set<String>()
        let window = values.filter { !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && ids.insert($0.id).inserted }
        guard enabled else { units = window; return }
        units = window; revision += 1
        for id in preparations.keys where !ids.contains(id) {
            preparations.removeValue(forKey: id)?.task.cancel()
        }
        let generation = UUID(); windowRevision = generation
        loading?.cancel()
        loading = Task {
            for unit in window where !loaded.contains(unit.id) {
                var cached = pages[unit.id]
                if cached == nil { cached = await client.cachedEbookAnnotations(textID: textID, version: sourceVersion, unit: unit) }
                guard !Task.isCancelled, windowRevision == generation else { return }
                if let cached, pages[unit.id] == nil { pages[unit.id] = cached; revision += 1 }
                loaded.insert(unit.id)
                start()
            }
            if pages.count > 80 { pages = pages.filter { ids.contains($0.key) }; loaded.formIntersection(ids) }
            start()
        }
    }
    func resume(online: Bool, active: Bool) {
        let recovering = (!self.online && online) || (!self.active && active)
        self.online = online; self.active = active
        if !active || !online { cancelPreparations(); return }
        if recovering { failed.removeAll(); quotaBlocked = false }
        start()
    }
    func stop() { active = false; cancelPreparations(); loading?.cancel() }
    private func cancelPreparations() {
        let pending = preparations.values
        preparations.removeAll()
        for preparation in pending { preparation.task.cancel() }
    }
    private func start() {
        guard enabled, active, online, !quotaBlocked else { return }
        for unit in units where preparations.count < 6 && loaded.contains(unit.id) &&
            pages[unit.id]?.complete != true && !failed.contains(unit.id) && preparations[unit.id] == nil {
            let runID = UUID()
            let task = Task {
                defer {
                    if preparations[unit.id]?.id == runID {
                        preparations[unit.id] = nil
                        start()
                    }
                }
                var completed = false
                for attempt in 0..<3 {
                    do {
                        for try await event in client.ebookAnnotations(textID: textID, version: sourceVersion, unit: unit) {
                            try Task.checkCancellation()
                            switch event {
                            case .annotation(let id, let annotation):
                                if pages[unit.id]?.unitId != id { pages[unit.id] = EbookAnnotationPage(unitId: id) }
                                if pages[unit.id]?.annotations.contains(where: { $0.id == annotation.id }) != true {
                                    pages[unit.id]?.annotations.append(annotation); revision += 1
                                }
                            case .complete(let id):
                                if pages[unit.id]?.unitId != id { pages[unit.id] = EbookAnnotationPage(unitId: id) }
                                pages[unit.id]?.complete = true; completed = true
                                NotificationCenter.default.post(name: .ebookPreannotationUsageChanged, object: nil)
                            case .failed(let detail): throw MobileFailure(error: detail)
                            }
                        }
                        guard completed else { throw URLError(.cannotParseResponse) }
                        break
                    } catch {
                        if Task.isCancelled { return }
                        let failure = MobileClient.cause(of: error) as? MobileFailure
                        if failure?.error.code == "quota_exceeded" {
                            quotaBlocked = true; return
                        }
                        if failure?.error.retryable != false, attempt < 2 {
                            do { try await Task.sleep(for: .seconds(attempt + 1)) } catch { return }
                            continue
                        }
                        failed.insert(unit.id)
                        break
                    }
                }
            }
            preparations[unit.id] = Preparation(id: runID, task: task)
        }
    }
}

extension Notification.Name {
    static let ebookPreannotationUsageChanged = Notification.Name("ebookPreannotationUsageChanged")
}

struct EbookPreannotationSheet: View {
    let model: EbookPreannotationModel?
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("预注释", isOn: Binding(get: { model?.enabled == true }, set: { model?.setEnabled($0) }))
                        .disabled(model == nil)
                        .accessibilityIdentifier("ebook-preannotation-enabled")
                } footer: {
                    Text(model == nil ? "登录并保存电子书后可开启" : "轻点带下划线的词语，查看释义")
                        .interfaceFont(13, style: .footnote)
                }
            }
            .navigationTitle("电子书预注释")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { LeximorySheetCloseButton { dismiss() } } }
        }
        .leximorySheetStyle()
        .presentationSizing(.form)
    }
}
