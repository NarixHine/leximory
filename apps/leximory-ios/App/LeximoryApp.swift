import SwiftUI
import LeximoryCore

@main
struct LeximoryApp: App {
    init() {
        let preferences = UserDefaults.standard
        if !preferences.bool(forKey: "ebook.typography.compact.v1") {
            if preferences.object(forKey: "ebook.prose.size") == nil || preferences.double(forKey: "ebook.prose.size") == 22 {
                preferences.set(18, forKey: "ebook.prose.size")
            }
            if preferences.object(forKey: "ebook.prose.leading") == nil || preferences.double(forKey: "ebook.prose.leading") == 1.8 {
                preferences.set(1.6, forKey: "ebook.prose.leading")
            }
            preferences.set(true, forKey: "ebook.typography.compact.v1")
        }
        let attributes: [NSAttributedString.Key: Any] = [.font: LeximoryTypography.interfaceUI(17, semibold: true)]
        UINavigationBar.appearance().titleTextAttributes = attributes
        UIBarButtonItem.appearance().setTitleTextAttributes([.font: LeximoryTypography.interfaceUI(16)], for: .normal)
        let tabs = UITabBarAppearance()
        for item in [tabs.stackedLayoutAppearance, tabs.inlineLayoutAppearance, tabs.compactInlineLayoutAppearance] {
            item.normal.iconColor = UIColor(LeximoryPalette.muted)
            item.selected.iconColor = UIColor(LeximoryPalette.sage)
            item.normal.titleTextAttributes = [.font: LeximoryTypography.interfaceUI(11), .foregroundColor: UIColor(LeximoryPalette.muted)]
            item.selected.titleTextAttributes = [.font: LeximoryTypography.interfaceUI(11, semibold: true), .foregroundColor: UIColor(LeximoryPalette.sage)]
        }
        UITabBar.appearance().standardAppearance = tabs
        UITabBar.appearance().scrollEdgeAppearance = tabs
        UITabBar.appearance().unselectedItemTintColor = UIColor(LeximoryPalette.muted)
    }
    @State private var playback = PlaybackController()
    var body: some Scene {
        WindowGroup {
            AppRootView(fixturePlayback: playback)
                .font(LeximoryTypography.interface(17))
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


struct FixtureArticle: Codable, Hashable, Identifiable {
    let id: TextID
    let title: String
    let subtitle: String
    let resource: String
    var topics: [String] = ["语言", "阅读"]
    var cover: CoverMotif = .leaf
    var coverEmoji: String? = nil
    var format = "article"
    static let samples = [
        FixtureArticle(id: TextID(rawValue: "fixture-reader"), title: "The art of noticing", subtitle: "在不同语言间漫步", resource: "reader"),
        FixtureArticle(id: TextID(rawValue: "fixture-long"), title: "A longer walk", subtitle: "800 段长文示例", resource: "long-reader", topics: ["阅读", "长文"], cover: .orbit)
    ]
    func document() throws -> ReadingDocument {
        guard let url = Bundle.main.url(forResource: resource, withExtension: "json") else { throw CocoaError(.fileNoSuchFile) }
        let document = try JSONDecoder().decode(ReadingDocument.self, from: Data(contentsOf: url))
        try document.validate()
        return document
    }
}

enum CoverMotif: String, Codable, Hashable { case leaf, bubbles, orbit, waves }

struct FixtureLibrary: Hashable, Identifiable {
    let id: LibraryID
    let name: String
    let language: String
    let articles: [FixtureArticle]
    var isRemote = false
    var archived = false
    var shadow = false

    var isCompact: Bool { archived || shadow }

    static let samples = [
        FixtureLibrary(id: LibraryID(rawValue: "fixture-field-notes"), name: "Field notes", language: "English", articles: [
            FixtureArticle.samples[0],
            FixtureArticle(id: TextID(rawValue: "fixture-forest"), title: "A quiet forest", subtitle: "听见林间的安静", resource: "forest", topics: ["自然", "观察"], cover: .bubbles),
            FixtureArticle.samples[1],
        ]),
        FixtureLibrary(id: LibraryID(rawValue: "fixture-japanese"), name: "ことばの庭", language: "Japanese", articles: [
            FixtureArticle(id: TextID(rawValue: "fixture-garden"), title: "ことばの庭", subtitle: "在词语的花园漫步", resource: "garden", topics: ["日本語", "日常"], cover: .waves),
        ]),
        FixtureLibrary(id: LibraryID(rawValue: "fixture-french"), name: "Carnet de voyage", language: "French", articles: [
            FixtureArticle(id: TextID(rawValue: "fixture-voyage"), title: "Le temps de regarder", subtitle: "慢下来，细细观察", resource: "voyage", topics: ["旅行", "语言"], cover: .orbit),
        ]),
        FixtureLibrary(id: LibraryID(rawValue: "fixture-chinese"), name: "字里行间", language: "Chinese", articles: [
            FixtureArticle(id: TextID(rawValue: "fixture-between"), title: "字里行间", subtitle: "字里行间的日常", resource: "between", topics: ["阅读", "生活"], cover: .bubbles),
        ]),
    ]
}

extension FixtureLibrary {
    var localizedLanguage: String {
        switch language {
        case "English": "英文"
        case "Japanese": "日文"
        case "French": "法文"
        case "Chinese": "文言文"
        default: language
        }
    }
}


extension FixtureLibrary {
    static let layoutSamples = [FixtureLibrary(id: LibraryID(rawValue: "fixture-layout"), name: "Field notes", language: "English", articles: (0..<9).map { index in
        FixtureArticle(id: TextID(rawValue: "fixture-layout-\(index)"), title: "Field notes \(index + 1)", subtitle: "", resource: "reader", topics: ["阅读"], cover: .bubbles)
    })]
    static let ebookSamples = [FixtureLibrary(id: LibraryID(rawValue: "fixture-ebooks"), name: "Ebooks", language: "English", articles: [
        FixtureArticle(id: TextID(rawValue: "fixture-epub"), title: "Reading fixture", subtitle: "", resource: "reader-fixture.epub", topics: [], coverEmoji: "📖", format: "ebook"),
        FixtureArticle(id: TextID(rawValue: "fixture-pdf"), title: "PDF fixture", subtitle: "", resource: "reader-fixture.pdf", topics: [], coverEmoji: "📖", format: "ebook"),
    ])]
}
