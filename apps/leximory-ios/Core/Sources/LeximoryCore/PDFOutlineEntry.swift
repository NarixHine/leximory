import Foundation

public struct PDFOutlineEntry: Codable, Equatable, Sendable {
    public let title: String
    public let page: Int
    public let depth: Int
    public init(title: String, page: Int, depth: Int = 0) {
        self.title = title; self.page = page; self.depth = depth
    }
}

extension Notification.Name {
    public static let pdfOutlineUsageChanged = Notification.Name("Leximory.pdfOutlineUsageChanged")
}

public struct SavedPDFOutline: Sendable {
    public let data: Data
    public let revision: String
    public init(data: Data, revision: String) { self.data = data; self.revision = revision }
}
