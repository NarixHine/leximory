import CoreTransferable
import Foundation
import UniformTypeIdentifiers

struct EbookExport: Transferable {
    enum Format: String { case epub, pdf }
    let data: Data
    let format: Format
    let filename: String

    init(data: Data, format: Format, title: String) {
        self.data = data; self.format = format
        let separators = CharacterSet.controlCharacters.union(CharacterSet(charactersIn: "/\\:"))
        var name = title.components(separatedBy: separators).filter { !$0.isEmpty }.joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: ".")))
        if name.lowercased().hasSuffix(".\(format.rawValue)") { name.removeLast(format.rawValue.count + 1) }
        name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        while name.utf8.count > 200 { name.removeLast() }
        filename = "\(name.isEmpty ? "电子书" : name).\(format.rawValue)"
    }

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .epub) { $0.data }
            .exportingCondition { $0.format == .epub }
            .suggestedFileName { $0.filename }
        DataRepresentation(exportedContentType: .pdf) { $0.data }
            .exportingCondition { $0.format == .pdf }
            .suggestedFileName { $0.filename }
    }
}
