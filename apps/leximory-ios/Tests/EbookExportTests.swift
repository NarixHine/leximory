import CoreTransferable
import Foundation
import Testing
import UniformTypeIdentifiers
@testable import Leximory

struct EbookExportTests {
    @Test(arguments: [EbookExport.Format.epub, .pdf])
    func exportsOriginalFileBytesWithMatchingTypeAndFilename(format: EbookExport.Format) async throws {
        let source = try #require(Bundle.main.url(forResource: "reader-fixture", withExtension: format.rawValue))
        let bytes = try Data(contentsOf: source)
        let file = EbookExport(data: bytes, format: format, title: "A river journey")
        let type: UTType = format == .pdf ? .pdf : .epub
        #expect(file.exportedContentTypes() == [type])
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = try await file.export(to: directory, contentType: type)
        #expect(url.lastPathComponent == "A river journey.\(format.rawValue)")
        #expect(try Data(contentsOf: url) == bytes)
    }

    @Test(arguments: [
        ("River pages.PDF", "River pages.pdf"),
        ("  ../河流\\笔记:一\n  ", "河流 笔记 一.pdf"),
        (" /.. ", "电子书.pdf"),
    ])
    func usesSafeReadableFilenames(title: String, expected: String) {
        #expect(EbookExport(data: Data(), format: .pdf, title: title).filename == expected)
    }
}
