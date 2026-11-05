import Foundation

public enum PDFNotesError: Error { case invalidDrawing }

public struct PDFNoteDocument: Codable, Hashable, Sendable {
    public let textID: String
    public let pdfVersion: String
    public init(textID: String, pdfVersion: String) { self.textID = textID; self.pdfVersion = pdfVersion }
}

public struct PDFNoteKey: Codable, Hashable, Sendable {
    public let document: PDFNoteDocument
    public let pageIndex: Int
    public init(document: PDFNoteDocument, pageIndex: Int) { self.document = document; self.pageIndex = pageIndex }
}

public struct PDFPageDrawing: Codable, Equatable, Sendable {
    public let pageIndex: Int
    public let drawing: Data
    public let canvasWidth: Double
    public let canvasHeight: Double
    public let formatVersion: Int
    public let revision: UUID
    enum CodingKeys: String, CodingKey { case pageIndex, drawing = "drawingBase64", canvasWidth, canvasHeight, formatVersion, revision }
    public init(pageIndex: Int, drawing: Data, canvasWidth: Double, canvasHeight: Double, revision: UUID = UUID(), formatVersion: Int = 1) {
        self.pageIndex = pageIndex; self.drawing = drawing; self.canvasWidth = canvasWidth
        self.canvasHeight = canvasHeight; self.revision = revision; self.formatVersion = formatVersion
    }
    public var isSupported: Bool {
        (0..<100000).contains(pageIndex) && !drawing.isEmpty && formatVersion == 1
        && canvasWidth.isFinite && canvasHeight.isFinite
        && canvasWidth > 0 && canvasWidth <= 100000 && canvasHeight > 0 && canvasHeight <= 100000
    }
}

public struct PDFNotePage: Codable, Sendable {
    public let notes: [PDFPageDrawing]
    public let nextCursor: Int?
}

public struct PDFNoteUpload: Codable, Equatable, Sendable {
    public let key: PDFNoteKey
    public let note: PDFPageDrawing
    public let baseRevision: UUID?
}

public enum PDFNoteProblem: String, Codable, Sendable {
    case accessDenied, tooLarge, cannotUpload
}

public enum PDFNoteState: Codable, Equatable, Sendable {
    case clean
    case dirty
    case uploading(PDFNoteUpload)
    case conflict(PDFPageDrawing)
    case blocked(PDFNoteProblem)
}

public struct PDFNoteRecord: Codable, Equatable, Sendable {
    public let key: PDFNoteKey
    public var note: PDFPageDrawing
    public var remoteRevision: UUID?
    public var state: PDFNoteState
}

public protocol PDFNotesRemote: Sendable {
    func pdfNotes(textID: String, pdfVersion: String, after: Int?) async throws -> PDFNotePage
    func savePDFNote(_ upload: PDFNoteUpload) async throws -> PDFPageDrawing
}
