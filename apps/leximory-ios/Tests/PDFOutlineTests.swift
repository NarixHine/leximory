import Testing
import PDFKit
import UIKit
import SwiftUI
@testable import LeximoryCore
@testable import Leximory

@MainActor struct PDFOutlineTests {
    private static func fixture(outline: Bool = true, title: String = "Original") -> Data {
        let first = "BT /F1 18 Tf 20 540 Td (Chapter one. A river.) Tj ET"
        let second = "BT /F1 18 Tf 20 540 Td (Chapter two. The garden.) Tj ET"
        var objects = [
            "<< /Type /Catalog /Pages 2 0 R \(outline ? "/Outlines 9 0 R" : "") >>",
            "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 600] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R /Annots [8 0 R] >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 600] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
            "<< /Length \(first.utf8.count) >>\nstream\n\(first)\nendstream",
            "<< /Length \(second.utf8.count) >>\nstream\n\(second)\nendstream",
            "<< /Type /Annot /Subtype /Text /Rect [30 100 110 130] /Contents (Keep this annotation) >>",
        ]
        if outline {
            objects.append("<< /Type /Outlines /First 10 0 R /Last 10 0 R /Count 1 >>")
            objects.append("<< /Title (\(title)) /Parent 9 0 R /Dest [3 0 R /XYZ 20 540 null] >>")
        }
        var output = "%PDF-1.7\n", offsets = [Int]()
        for (index, object) in objects.enumerated() {
            offsets.append(output.utf8.count); output += "\(index + 1) 0 obj\n\(object)\nendobj\n"
        }
        let xref = output.utf8.count
        output += "xref\n0 \(objects.count + 1)\n0000000000 65535 f \n"
        for offset in offsets { output += String(format: "%010d 00000 n \n", offset) }
        output += "trailer\n<< /Size \(objects.count + 1) /Root 1 0 R >>\nstartxref\n\(xref)\n%%EOF\n"
        return Data(output.utf8)
    }
    @Test(arguments: [false, true]) func replacementSurvivesReopeningAndExportWithContentAndAnnotations(outline: Bool) async throws {
        let original = Self.fixture(outline: outline), service = Service(), model = service.model(Self.fixture(outline: outline))
        let (reader, live) = try attach(model, data: original)
        reader.format = "pdf"
        reader.location = "2"
        await model.refreshAllowance(); await model.start()?.value
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString + ".pdf")
        defer { try? FileManager.default.removeItem(at: root) }
        let file = try #require(reader.export(title: "River pages"))
        #expect(file.data == model.savedData)
        try file.data.write(to: root)
        let exported = try #require(PDFDocument(url: root)), before = try #require(PDFDocument(data: original))
        #expect(exported.pageCount == 2)
        #expect(exported.string == before.string)
        #expect(exported.page(at: 0)?.annotations.first?.contents == "Keep this annotation")
        #expect(exported.outlineRoot?.numberOfChildren == 1)
        #expect(exported.outlineRoot?.child(at: 0)?.label == "Generated 1")
        #expect(live.outlineRoot?.child(at: 0)?.label == "Generated 1")
        #expect(reader.location == "2")
    }
    @Test func unusableResultsAreRejected() throws {
        for entries: [PDFOutlineEntry] in [[], [.init(title: " ", page: 1)], [.init(title: "Bad", page: 3)], [.init(title: "Bad", page: 1, depth: 1)], [.init(title: "Two", page: 2), .init(title: "One", page: 1)]] {
            #expect(throws: (any Error).self) { try PDFOutlineModel.validate(entries: entries, pageCount: 2) }
        }
    }
    @MainActor private final class Service {
        var generated = 0, saves = 0, used = 0
        var failGeneration = false, failSave = false, loseResponse = false
        var usageFails = false
        var receipts: [UUID: String] = [:]
        var requests: [UUID] = []
        var published: Data?
        var gate: CheckedContinuation<Void, Never>?
        var pause = false
        func model(_ bytes: Data, id: String = "book") -> PDFOutlineModel {
            PDFOutlineModel(textID: id, data: bytes, revision: nil, writable: true,
                generate: { _, _ in
                    self.generated += 1
                    if self.pause { await withCheckedContinuation { self.gate = $0 } }
                    if self.failGeneration { throw URLError(.badServerResponse) }
                    return [.init(title: "Generated \(self.generated)", page: 1)]
                }, save: { data, request, generation, _ in
                    self.saves += 1; self.requests.append(request)
                    if self.failSave { throw URLError(.cannotWriteToFile) }
                    if let revision = self.receipts[request] { return SavedPDFOutline(data: try #require(self.published), revision: revision) }
                    if generation != nil && self.used >= 2 { throw MobileFailure(error: .init(code: "quota_exceeded", message: "Exhausted", retryable: false)) }
                    let published = generation == nil ? data : PDFOutlineTests.fixture(title: "Generated \(self.generated)")
                    self.published = published
                    if generation != nil { self.used += 1 }
                    let revision = request.uuidString; self.receipts[request] = revision
                    if self.loseResponse { self.loseResponse = false; throw URLError(.networkConnectionLost) }
                    return SavedPDFOutline(data: published, revision: revision)
                }, usage: {
                    if self.usageFails { throw URLError(.networkConnectionLost) }
                    return Account.Allowance(used: Double(self.used), limit: 2, resetsIn: 300)
                })
        }
    }
    private func attach(_ model: PDFOutlineModel, data: Data) throws -> (EbookReaderState, PDFDocument) {
        let reader = EbookReaderState(), document = try #require(PDFDocument(data: data))
        reader.pdfOutline = model; model.attach(document, reader: reader)
        return (reader, document)
    }
    @Test func failuresAndLostResponsesRetryWithoutRegeneratingOrChargingTwice() async throws {
        let data = Self.fixture(), service = Service(), model = service.model(data)
        let (reader, document) = try attach(model, data: data)
        await model.refreshAllowance()
        service.failGeneration = true
        await model.start()?.value
        #expect(service.saves == 0)
        #expect(service.used == 0)
        #expect(document.outlineRoot?.child(at: 0)?.label == "Original")
        service.failGeneration = false; service.failSave = true
        await model.start()?.value
        #expect(service.used == 0)
        #expect(model.canGenerate)
        #expect(model.error == "目录未能保存，请再试一次。")
        #expect(model.savedData == data)
        #expect(model.canUndo == false)
        service.failSave = false; service.loseResponse = true
        await model.start()?.value
        #expect(model.error != nil)
        #expect(reader.chapters.first?.title == "Original")
        await model.start()?.value
        #expect(service.generated == 2)
        #expect(Set(service.requests).count == 1)
        #expect(service.used == 1)
        #expect(reader.chapters.first?.title == "Generated 2")
        #expect(model.error == nil)
    }
    @Test func originalGenerateButtonRecoversAnAlreadyChargedPublicationWhenQuotaIsExhausted() async throws {
        let data = Self.fixture(), service = Service()
        service.used = 1
        let model = service.model(data)
        let (reader, _) = try attach(model, data: data)
        await model.refreshAllowance()
        service.loseResponse = true
        await model.start()?.value
        await model.refreshAllowance()
        #expect(model.exhausted)
        #expect(model.error != nil)
        #expect(model.canGenerate)
        await model.start()?.value
        #expect(model.error == nil)
        #expect(service.generated == 1)
        #expect(service.used == 2)
        #expect(reader.chapters.first?.title == "Generated 1")
        #expect(model.canGenerate == false)
    }

    @Test func originalGenerateButtonRetriesAnUnfinishedUndoWithoutGeneratingAgain() async throws {
        let data = Self.fixture(), service = Service(), model = service.model(data)
        let (reader, _) = try attach(model, data: data)
        await model.refreshAllowance()
        await model.start()?.value
        service.failSave = true
        await model.start(.undo)?.value
        #expect(model.canGenerate)
        #expect(reader.chapters.first?.title == "Generated 1")
        service.failSave = false
        await model.start()?.value
        #expect(model.error == nil)
        #expect(reader.chapters.first?.title == "Original")
        #expect(service.generated == 1)
        #expect(service.used == 1)
    }

    @Test func undoRedoAndNewUndoPointPersistWithoutAIOrQuota() async throws {
        let data = Self.fixture(), service = Service(), model = service.model(data)
        let (reader, document) = try attach(model, data: data)
        reader.bookmarks = [EbookBookmark(id: 1, quote: "river", chapter: "Original", location: "1")]
        await model.refreshAllowance(); await model.start()?.value
        await model.start(.undo)?.value
        #expect(document.outlineRoot?.child(at: 0)?.label == "Original")
        #expect(model.savedData == data)
        #expect(model.canRedo)
        await model.start(.redo)?.value
        #expect(reader.chapters.first?.title == "Generated 1")
        await model.start()?.value
        await model.start(.undo)?.value
        #expect(reader.chapters.first?.title == "Generated 1")
        #expect(service.generated == 2)
        #expect(service.used == 2)
        #expect(model.exhausted)
        #expect(model.canGenerate == false)
        #expect(reader.bookmarks.count == 1)
        #expect(service.published == model.savedData)
        #expect(PDFDocument(data: model.savedData)?.pageCount == 2)
    }
    @Test func dismissalAndDocumentSwitchCannotCancelOrChangeAnotherReader() async throws {
        let data = Self.fixture(), service = Service(), model = service.model(data)
        let (reader, document) = try attach(model, data: data)
        await model.refreshAllowance(); service.pause = true
        let task = model.start()
        while service.gate == nil { await Task.yield() }
        #expect(model.busy)
        #expect(model.start() == nil)
        reader.location = "2"
        let otherService = Service(), other = otherService.model(data, id: "other")
        reader.pdfOutline = other
        let otherDocument = try #require(PDFDocument(data: data)); other.attach(otherDocument, reader: reader)
        service.gate?.resume(); await task?.value
        #expect(reader.location == "2")
        #expect(reader.pdfOutline === other)
        #expect(reader.chapters.first?.title == "Original")
        #expect(document.outlineRoot?.child(at: 0)?.label == "Generated 1")
        #expect(otherDocument.outlineRoot?.child(at: 0)?.label == "Original")
        #expect(service.used == 1)
    }
    @Test func quotaRejectionStillExplainsExhaustionWhenUsageRefreshFails() async throws {
        let data = Self.fixture(), service = Service(), model = service.model(data)
        let (_, document) = try attach(model, data: data)
        await model.refreshAllowance()
        service.used = 2; service.usageFails = true
        await model.start()?.value
        #expect(service.used == 2)
        #expect(model.exhausted)
        #expect(model.canGenerate == false)
        #expect(model.error == "本期词点额度已用完。")
        #expect(document.outlineRoot?.child(at: 0)?.label == "Original")
    }

    @Test func applyingAnOutlineKeepsPDFKitPageZoomAndLiveAnnotations() async throws {
        let data = Self.fixture(), service = Service(), model = service.model(data)
        let (reader, document) = try attach(model, data: data)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.windows.first { $0.isKeyWindow }
        let window = UIWindow(windowScene: scene)
        let controller = UIViewController()
        let pdf = PDFView(frame: CGRect(x: 0, y: 0, width: 390, height: 600))
        pdf.displayMode = .singlePageContinuous; pdf.document = document
        controller.view.addSubview(pdf); window.rootViewController = controller; window.makeKeyAndVisible()
        defer { window.isHidden = true; window.rootViewController = nil; previous?.makeKey() }
        controller.view.layoutIfNeeded(); pdf.layoutIfNeeded()
        let page = try #require(document.page(at: 1))
        pdf.go(to: page); pdf.autoScales = false; pdf.scaleFactor = 1.75
        let current = pdf.currentPage, zoom = pdf.scaleFactor
        let annotation = PDFAnnotation(bounds: CGRect(x: 20, y: 150, width: 40, height: 20), forType: .highlight, withProperties: nil)
        page.addAnnotation(annotation)
        reader.location = "2"
        await model.refreshAllowance(); await model.start()?.value
        #expect(pdf.document === document)
        #expect(pdf.currentPage === current)
        #expect(pdf.scaleFactor == zoom)
        #expect(reader.location == "2")
        #expect(page.annotations.contains { $0 === annotation })
        #expect(document.outlineRoot?.child(at: 0)?.label == "Generated 1")
    }

    @Test func readOnlyAndExhaustionKeepGenerationDisabledButPermitFreeUndo() async throws {
        let data = Self.fixture(), service = Service(), model = service.model(data)
        let (_, document) = try attach(model, data: data)
        #expect(model.canGenerate == false)
        #expect(model.start() == nil)
        await model.refreshAllowance()
        model.writable = false
        #expect(model.start() == nil)
        model.writable = true; model.online = false
        #expect(model.start() == nil)
        model.online = true; service.used = 2; await model.refreshAllowance()
        #expect(model.start() == nil)
        #expect(service.generated == 0)
        #expect(document.outlineRoot?.child(at: 0)?.label == "Original")
    }
}
