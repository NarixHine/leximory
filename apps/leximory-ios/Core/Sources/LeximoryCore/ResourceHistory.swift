import Foundation

public struct ResourceHistory<Resource> {
    public private(set) var entries: [Resource]
    public private(set) var index = 0
    public var current: Resource { entries[index] }
    public var canGoBack: Bool { index > 0 }
    public var canGoForward: Bool { index + 1 < entries.count }

    public init(home: Resource) { entries = [home] }
    public mutating func visit(_ resource: Resource) {
        entries.removeSubrange((index + 1)..<entries.count)
        entries.append(resource)
        index = entries.count - 1
    }
    @discardableResult public mutating func go(_ distance: Int) -> Bool {
        let destination = index + distance
        guard entries.indices.contains(destination) else { return false }
        index = destination
        return true
    }
    public mutating func replaceCurrent(_ resource: Resource) { entries[index] = resource }
    public mutating func transform(_ update: (Resource) -> Resource) {
        entries = entries.map(update)
    }
    public mutating func removeAll(where shouldRemove: (Resource) -> Bool) {
        let remaining = entries.enumerated().filter { !shouldRemove($0.element) }
        guard !remaining.isEmpty else { return }
        index = remaining.lastIndex(where: { $0.offset <= index }) ?? 0
        entries = remaining.map(\.element)
    }
    public mutating func reset(to home: Resource) { entries = [home]; index = 0 }
}
