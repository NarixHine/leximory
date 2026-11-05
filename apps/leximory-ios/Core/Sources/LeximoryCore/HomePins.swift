import Foundation

public enum HomePinDestination: Codable, Equatable, Sendable {
    case webpage(url: String, bookmarkId: String?)
    case document(text: CatalogText)

    private enum Keys: String, CodingKey { case kind, url, bookmarkId, text }
    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        switch try c.decode(String.self, forKey: .kind) {
        case "webpage": self = .webpage(url: try c.decode(String.self, forKey: .url), bookmarkId: try c.decodeIfPresent(String.self, forKey: .bookmarkId))
        case "document": self = .document(text: try c.decode(CatalogText.self, forKey: .text))
        default: throw DecodingError.dataCorruptedError(forKey: .kind, in: c, debugDescription: "Unknown pin destination")
        }
    }
    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: Keys.self)
        switch self {
        case .webpage(let url, let bookmarkId):
            try c.encode("webpage", forKey: .kind); try c.encode(url, forKey: .url)
            try c.encodeIfPresent(bookmarkId, forKey: .bookmarkId)
        case .document(let text): try c.encode("document", forKey: .kind); try c.encode(text, forKey: .text)
        }
    }
    public var identity: String {
        switch self { case .webpage(let url, _): "url/" + Self.normalizedURL(url); case .document(let text): "text/" + text.id }
    }
    private static func normalizedURL(_ value: String) -> String {
        guard var url = URLComponents(string: value) else { return value }
        url.scheme = url.scheme?.lowercased(); url.host = url.host?.lowercased()
        if url.path.isEmpty { url.path = "/" }
        if url.scheme == "https" && url.port == 443 || url.scheme == "http" && url.port == 80 { url.port = nil }
        return url.string ?? value
    }

}

public struct HomePin: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var title: String
    public var destination: HomePinDestination
    public var faviconURL: String?
    public var sortOrder: Int
    public var revision: String
    public var deletedAt: String?
    public var updatedAt: String
    public init(id: String, title: String, destination: HomePinDestination, faviconURL: String?, sortOrder: Int, revision: String = UUID().uuidString.lowercased(), deletedAt: String? = nil, updatedAt: String = "") {
        self.id = id; self.title = title; self.destination = destination; self.faviconURL = faviconURL
        self.sortOrder = sortOrder; self.revision = revision; self.deletedAt = deletedAt; self.updatedAt = updatedAt
    }
}

public struct HomePinMutation: Codable, Equatable, Sendable {
    public var id: String
    public var title: String
    public var destination: HomePinDestination
    public var faviconURL: String?
    public var sortOrder: Int
    public var revision: String
    public var expectedRevision: String?
    public var deleted: Bool
    private enum CodingKeys: String, CodingKey { case id, title, destination, faviconURL, sortOrder, revision, expectedRevision, deleted }
    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id); try c.encode(title, forKey: .title)
        try c.encode(destination, forKey: .destination); try c.encode(faviconURL, forKey: .faviconURL)
        try c.encode(sortOrder, forKey: .sortOrder); try c.encode(revision, forKey: .revision)
        try c.encode(expectedRevision, forKey: .expectedRevision); try c.encode(deleted, forKey: .deleted)
    }
    public var pin: HomePin {
        HomePin(id: id, title: title, destination: destination, faviconURL: faviconURL, sortOrder: sortOrder, revision: revision, deletedAt: deleted ? "pending" : nil)
    }
}

public struct HomePinSyncState: Codable, Sendable {
    public private(set) var records: [String: HomePin] = [:]
    public private(set) var pending: [String: HomePinMutation] = [:]
    private var bases: [String: HomePin] = [:]
    private var imports: Set<String> = []
    private var seeded = false
    public init() {}

    private enum CodingKeys: String, CodingKey { case records, pending, bases, imports, seeded }
    public init(from decoder: any Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        records = try values.decodeIfPresent([String: HomePin].self, forKey: .records) ?? [:]
        pending = try values.decodeIfPresent([String: HomePinMutation].self, forKey: .pending) ?? [:]
        bases = try values.decodeIfPresent([String: HomePin].self, forKey: .bases) ?? records.filter { pending[$0.key] != nil }
        imports = try values.decodeIfPresent(Set<String>.self, forKey: .imports) ?? []
        seeded = try values.decodeIfPresent(Bool.self, forKey: .seeded) ?? false
    }
    private static func date(_ value: String) -> Date {
        (try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(value))
            ?? (try? Date.ISO8601FormatStyle().parse(value)) ?? .distantPast
    }
    private func latestDeletion(for identity: String) -> HomePin? {
        records.values.filter { $0.destination.identity == identity && $0.deletedAt != nil }
            .max { Self.date($0.deletedAt ?? "") < Self.date($1.deletedAt ?? "") }
    }
    private func survivesDeletion(_ pin: HomePin) -> Bool {
        guard let deleted = latestDeletion(for: pin.destination.identity) else { return true }
        return Self.date(pin.updatedAt) > Self.date(deleted.deletedAt ?? "")
    }
    public var visible: [HomePin] {
        var result = records
        for (id, change) in pending { result[id] = change.pin }
        let removals = pending.values.filter(\.deleted)
        let candidates = result.values.filter { pin in
            pin.deletedAt == nil && !removals.contains(where: { removal in
                removal.destination.identity == pin.destination.identity
                    && bases[pin.id]?.revision != removal.revision
            }) && (pending[pin.id] != nil || survivesDeletion(pin))
        }.sorted {
            let left = records[$0.id] == nil, right = records[$1.id] == nil
            return left == right ? $0.id < $1.id : !left
        }
        var seen: Set<String> = []
        return candidates.filter { seen.insert($0.destination.identity).inserted }.sorted {
            $0.sortOrder == $1.sortOrder ? $0.id < $1.id : $0.sortOrder < $1.sortOrder
        }
    }
    private mutating func enqueue(_ pin: HomePin, deleted: Bool) {
        if pending[pin.id] == nil {
            bases[pin.id] = records[pin.id]
                ?? pending.values.first(where: { $0.deleted && $0.destination.identity == pin.destination.identity })?.pin
                ?? latestDeletion(for: pin.destination.identity)
        }
        pending[pin.id] = HomePinMutation(id: pin.id, title: pin.title, destination: pin.destination,
            faviconURL: pin.faviconURL, sortOrder: pin.sortOrder, revision: UUID().uuidString.lowercased(),
            expectedRevision: records[pin.id]?.revision, deleted: deleted)
    }
    public mutating func stage(_ pin: HomePin, deleted: Bool = false) {
        let identity = pin.destination.identity
        let aliases = Set(records.values.filter { $0.deletedAt == nil && pending[$0.id]?.deleted != true && $0.destination.identity == identity && survivesDeletion($0) }.map(\.id))
            .union(pending.values.filter { $0.destination.identity == identity && (deleted || !$0.deleted) }.map(\.id))
        let targets = aliases.isEmpty ? [pin.id] : Array(aliases.union(deleted || records[pin.id] != nil || pending[pin.id] != nil ? [pin.id] : []))
        for id in targets {
            var value = pin; value.id = id
            imports.remove(id)
            enqueue(value, deleted: deleted)
        }
    }
    public mutating func seed(_ local: [HomePin]) {
        guard !seeded else { return }
        seeded = true
        importPins(local)
    }
    public mutating func importPins(_ local: [HomePin]) {
        var order = (visible.map(\.sortOrder).max() ?? -1) + 1
        for pin in local {
            guard records[pin.id] == nil, pending[pin.id] == nil,
                  !records.values.contains(where: { $0.destination.identity == pin.destination.identity }),
                  !pending.values.contains(where: { $0.destination.identity == pin.destination.identity }) else { continue }
            var value = pin
            value.sortOrder = order; order += 1
            enqueue(value, deleted: false); imports.insert(value.id)
        }
    }
    private mutating func clear(_ id: String) {
        pending.removeValue(forKey: id); bases.removeValue(forKey: id)
        imports.remove(id)
    }
    public mutating func receive(_ pin: HomePin) { receive([pin]) }
    public mutating func receive(_ pins: [HomePin]) {
        for pin in pins {
            // Tombstones are permanent for an ID, even if an older save acknowledgement arrives late.
            if records[pin.id]?.deletedAt != nil && pin.deletedAt == nil { continue }
            if let old = records[pin.id], Self.date(old.updatedAt) > Self.date(pin.updatedAt), pin.deletedAt == nil { continue }
            records[pin.id] = pin
            guard var change = pending[pin.id] else { continue }
            if pin.revision == change.revision || pin.deletedAt != nil || (imports.contains(pin.id) && change.expectedRevision == nil) {
                clear(pin.id); continue
            }
            if !change.deleted, let base = bases[pin.id], base.id == pin.id {
                if change.title == base.title { change.title = pin.title }
                if change.destination == base.destination { change.destination = pin.destination }
                if change.faviconURL == base.faviconURL { change.faviconURL = pin.faviconURL }
                if change.sortOrder == base.sortOrder { change.sortOrder = pin.sortOrder }
            }
            change.expectedRevision = pin.revision
            bases[pin.id] = pin; pending[pin.id] = change
        }
        for change in Array(pending.values) where !change.deleted {
            let identity = change.destination.identity
            if let deleted = latestDeletion(for: identity) {
                let base = bases[change.id]
                let known = base?.revision == deleted.revision || (base?.deletedAt != nil
                    && Self.date(base?.deletedAt ?? "") >= Self.date(deleted.deletedAt ?? ""))
                if !known, !(records[change.id].map { survivesDeletion($0) } ?? false) { clear(change.id); continue }
            }
            guard change.expectedRevision == nil,
                  let existing = records.values.filter({ $0.id != change.id && $0.deletedAt == nil && $0.destination.identity == identity && survivesDeletion($0) })
                    .min(by: { $0.id < $1.id }) else { continue }
            let imported = imports.contains(change.id)
            clear(change.id)
            if !imported {
                var value = existing
                value.title = change.title; value.faviconURL = change.faviconURL ?? existing.faviconURL
                // An existing local edit of the canonical pin is newer than this queued creation.
                if pending[existing.id] == nil { enqueue(value, deleted: false) }
            }
        }
        let arrivals = pending.values.filter { imports.contains($0.id) && $0.expectedRevision == nil && !$0.deleted }
            .sorted { $0.sortOrder == $1.sortOrder ? $0.id < $1.id : $0.sortOrder < $1.sortOrder }
        let existingOrders = records.values.filter { $0.deletedAt == nil && survivesDeletion($0) }.map(\.sortOrder)
            + pending.values.filter { !imports.contains($0.id) && !$0.deleted }.map(\.sortOrder)
        var order = (existingOrders.max() ?? -1) + 1
        for arrival in arrivals {
            var change = arrival; change.sortOrder = order; pending[change.id] = change; order += 1
        }
    }
}
