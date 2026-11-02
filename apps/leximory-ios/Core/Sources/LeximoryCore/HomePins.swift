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
        switch self { case .webpage(let url, _): "url/" + url; case .document(let text): "text/" + text.id }
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
    private var seeded = false
    public init() {}

    public var visible: [HomePin] {
        var result = records
        for (id, change) in pending { result[id] = change.pin }
        return result.values.filter { $0.deletedAt == nil }.sorted {
            $0.sortOrder == $1.sortOrder ? $0.id < $1.id : $0.sortOrder < $1.sortOrder
        }
    }
    public mutating func stage(_ pin: HomePin, deleted: Bool = false) {
        pending[pin.id] = HomePinMutation(id: pin.id, title: pin.title, destination: pin.destination,
            faviconURL: pin.faviconURL, sortOrder: pin.sortOrder, revision: UUID().uuidString.lowercased(),
            expectedRevision: records[pin.id]?.revision, deleted: deleted)
    }
    public mutating func seed(_ local: [HomePin]) {
        guard !seeded else { return }
        seeded = true
        for pin in local where records[pin.id] == nil && pending[pin.id] == nil {
            guard !records.values.contains(where: { $0.destination.identity == pin.destination.identity }) else { continue }
            stage(pin)
        }
    }
    public mutating func receive(_ pin: HomePin) {
        records[pin.id] = pin
        guard var change = pending[pin.id] else { return }
        if pin.revision == change.revision || pin.deletedAt != nil {
            pending.removeValue(forKey: pin.id)
        } else {
            change.expectedRevision = pin.revision
            pending[pin.id] = change
        }
    }
}
