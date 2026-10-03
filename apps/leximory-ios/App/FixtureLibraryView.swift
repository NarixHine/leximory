import SwiftUI
import LeximoryCore

private enum BrowserDestination: Hashable {
    case library(FixtureLibrary)
    case article(FixtureArticle)
}

struct FixtureLibraryView: View {
    let playback: PlaybackController
    var libraries: [FixtureLibrary] = FixtureLibrary.samples
    var client: MobileClient? = nil
    var openDocument: RemoteDocument? = nil
    var refresh: (() async -> Void)? = nil
    var archive: ((FixtureLibrary, Bool) async throws -> Void)? = nil
    var recentNamespace = "fixtures"
    @State private var recent: [String: FixtureArticle] = [:]
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var path: [BrowserDestination] = []
    @State private var visibility: NavigationSplitViewVisibility = .detailOnly

    private var library: FixtureLibrary? {
        guard case .library(let library) = path.first else { return nil }
        return library
    }
    private var readerID: TextID? {
        guard case .article(let article) = path.last else { return nil }
        return article.id
    }
    private var detailPath: Binding<[BrowserDestination]> {
        Binding(get: { Array(path.dropFirst()) }, set: { path = Array(path.prefix(1)) + $0 })
    }

    var body: some View {
        Group {
            if sizeClass == .regular {
                NavigationSplitView(columnVisibility: $visibility) {
                    gallery(selectedID: library?.id)
                        .navigationSplitViewColumnWidth(min: 300, ideal: 340, max: 400)
                } detail: {
                    NavigationStack(path: detailPath) {
                        if let library {
                            textGallery(library: library) { path = [.library(library), .article($0)] }
                                .navigationDestination(for: BrowserDestination.self) { destination($0) }
                        } else {
                            gallery(selectedID: nil)
                        }
                    }
                }
                .navigationSplitViewStyle(.balanced)
            } else {
                NavigationStack(path: $path) {
                    gallery(selectedID: nil)
                        .navigationDestination(for: BrowserDestination.self) { destination($0) }
                }
            }
        }
        .onChange(of: openDocument?.text.id, initial: true) { _, _ in
            if let openDocument { path = [.library(openDocument.library.preview), .article(openDocument.text.preview)] }
        }
        .task(id: recentNamespace) {
            if let data = UserDefaults.standard.data(forKey: "recent-access.\(recentNamespace)") {
                recent = (try? JSONDecoder().decode([String: FixtureArticle].self, from: data)) ?? [:]
            }
        }
        .onChange(of: path) { _, _ in
            if let library, case .article(let article) = path.last {
                recent[library.id.rawValue] = article
                if let data = try? JSONEncoder().encode(recent) { UserDefaults.standard.set(data, forKey: "recent-access.\(recentNamespace)") }
            }
            playback.leaveReader(unless: readerID)
            if sizeClass == .regular { visibility = library != nil && readerID == nil ? .all : .detailOnly }
        }
        .onChange(of: sizeClass) { _, size in
            if size == .regular { visibility = library != nil && readerID == nil ? .all : .detailOnly }
        }
    }
    private func gallery(selectedID: LibraryID?) -> LibraryGallery {
        LibraryGallery(libraries: libraries, sampleMode: client == nil, refresh: refresh, archive: archive,
            recentlyOpened: recent, openRecent: { library, article in path = [.library(library), .article(article)] },
            selectedID: selectedID, open: { path = [.library($0)] })
    }
    @ViewBuilder private func textGallery(library: FixtureLibrary, open: @escaping (FixtureArticle) -> Void) -> some View {
        if let client { RemoteTextGallery(library: library, client: client, open: open) }
        else { TextGallery(library: library, open: open) }
    }
    @ViewBuilder private func destination(_ destination: BrowserDestination) -> some View {
        switch destination {
        case .library(let library):
            textGallery(library: library) { path.append(.article($0)) }
        case .article(let article):
            if article.format == "ebook" {
                EbookScreen(article: article, client: client, language: library?.language ?? "English")
            } else if let client {
                ReaderScreen(article: article, playback: playback, language: library?.language ?? "English", client: client, loadDocument: { id in
                    if let openDocument, openDocument.text.id == id.rawValue, let document = openDocument.document { return document }
                    return try await client.document(textID: id.rawValue)
                })
            } else { ReaderScreen(article: article, playback: playback, language: library?.language ?? "English") }
        }
    }
}
