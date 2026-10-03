import SwiftUI
import LeximoryCore

@main
struct LeximoryApp: App {
    @State private var playback = PlaybackController()
    var body: some Scene {
        WindowGroup {
            FixtureLibraryView(playback: playback)
                .tint(LeximoryPalette.sage)
                .preferredColorScheme(previewColorScheme)
        }
    }
    private var previewColorScheme: ColorScheme? {
        #if DEBUG
        ProcessInfo.processInfo.arguments.contains("--dark-appearance") ? .dark : nil
        #else
        nil
        #endif
    }
}


struct FixtureArticle: Hashable, Identifiable {
    let id: TextID
    let title: String
    let subtitle: String
    let resource: String
    var topics: [String] = ["Language", "Reading"]
    var cover: CoverMotif = .leaf
    static let samples = [
        FixtureArticle(id: TextID(rawValue: "fixture-reader"), title: "The art of noticing", subtitle: "A multilingual reading walk", resource: "reader"),
        FixtureArticle(id: TextID(rawValue: "fixture-long"), title: "A longer walk", subtitle: "800 passages · Performance fixture", resource: "long-reader", topics: ["Reading", "Long form"], cover: .orbit)
    ]
    func document() throws -> ReadingDocument {
        guard let url = Bundle.main.url(forResource: resource, withExtension: "json") else { throw CocoaError(.fileNoSuchFile) }
        let document = try JSONDecoder().decode(ReadingDocument.self, from: Data(contentsOf: url))
        try document.validate()
        return document
    }
}

enum CoverMotif: String, Hashable { case leaf, bubbles, orbit, waves }

struct FixtureLibrary: Hashable, Identifiable {
    let id: LibraryID
    let name: String
    let language: String
    let symbol: String
    let articles: [FixtureArticle]

    static let samples = [
        FixtureLibrary(id: LibraryID(rawValue: "fixture-field-notes"), name: "Field notes", language: "English", symbol: "leaf", articles: [
            FixtureArticle.samples[0],
            FixtureArticle(id: TextID(rawValue: "fixture-forest"), title: "A quiet forest", subtitle: "Finding room to listen", resource: "forest", topics: ["Nature", "Attention"], cover: .bubbles),
            FixtureArticle.samples[1],
        ]),
        FixtureLibrary(id: LibraryID(rawValue: "fixture-japanese"), name: "ことばの庭", language: "Japanese", symbol: "sun.max", articles: [
            FixtureArticle(id: TextID(rawValue: "fixture-garden"), title: "ことばの庭", subtitle: "A garden of words", resource: "garden", topics: ["日本語", "日常"], cover: .waves),
        ]),
        FixtureLibrary(id: LibraryID(rawValue: "fixture-french"), name: "Carnet de voyage", language: "French", symbol: "globe.europe.africa", articles: [
            FixtureArticle(id: TextID(rawValue: "fixture-voyage"), title: "Le temps de regarder", subtitle: "Taking time to notice", resource: "voyage", topics: ["Voyage", "Langue"], cover: .orbit),
        ]),
        FixtureLibrary(id: LibraryID(rawValue: "fixture-chinese"), name: "字里行间", language: "Chinese", symbol: "moon", articles: [
            FixtureArticle(id: TextID(rawValue: "fixture-between"), title: "字里行间", subtitle: "Between the lines", resource: "between", topics: ["阅读", "生活"], cover: .bubbles),
        ]),
    ]
}
