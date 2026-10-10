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
    var loadingLibraries = false
    var libraryError: String? = nil
    @State private var recent: [String: FixtureArticle] = [:]
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var path: [BrowserDestination] = []
    @Environment(\.librarySectionSelection) private var sectionSelection

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
                NavigationStack(path: detailPath) {
                    HStack(spacing: 0) {
                        VStack(spacing: 0) {
                            if let sectionSelection {
                                LibrarySectionPicker(selection: sectionSelection)
                                    .padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 8)
                            }
                            gallery(selectedID: library?.id)
                        }.frame(width: 320)
                            .accessibilityIdentifier("library-sidebar")
                        Divider().overlay(LeximoryPalette.border)
                        Group {
                            if let library {
                                textGallery(library: library) { path = [.library(library), .article($0)] }
                            } else {
                                LeximoryUnavailableView("选择文库", systemImage: "books.vertical", message: "开始阅读文库里的文章和电子书吧！")
                                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                            }
                        }.frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                    .background(LeximoryPalette.paper)
                    .toolbar(.hidden, for: .navigationBar)
                    .navigationDestination(for: BrowserDestination.self) { destination($0) }
                }
            } else {
                NavigationStack(path: $path) {
                    gallery(selectedID: nil)
                        .navigationDestination(for: BrowserDestination.self) { destination($0) }
                }
            }
        }
        .toolbar(readerID == nil ? .visible : .hidden, for: .tabBar)
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
        }
    }
    private func gallery(selectedID: LibraryID?) -> some View {
        LibraryGallery(libraries: libraries, sampleMode: client == nil, refresh: refresh, archive: archive,
            recentlyOpened: recent, openRecent: { library, article in path = [.library(library), .article(article)] },
            selectedID: selectedID, open: { path = [.library($0)] })
            .overlay {
                if loadingLibraries && libraries.isEmpty {
                    ReadingLoadingIndicator("正在打开文库……")
                        .frame(maxWidth: .infinity, maxHeight: .infinity).background(LeximoryPalette.paper)
                } else if let libraryError {
                    LeximoryUnavailableView("暂时无法打开文库", systemImage: "wifi.exclamationmark", message: libraryError) {
                        Button("重试") { Task { await refresh?() } }
                    }.background(LeximoryPalette.paper)
                }
            }
    }
    @ViewBuilder private func textGallery(library: FixtureLibrary, open: @escaping (FixtureArticle) -> Void) -> some View {
        if let client { RemoteTextGallery(library: library, client: client, open: open).id(library.id) }
        else { TextGallery(library: library, showsNavigationBar: sizeClass != .regular, open: open).id(library.id) }
    }
    @ViewBuilder private func destination(_ destination: BrowserDestination) -> some View {
        switch destination {
        case .library(let library):
            textGallery(library: library) { path.append(.article($0)) }
        case .article(let article):
            if article.format == "bookmark", let client {
                TextBrowserScreen(client: client, bookmarkID: article.id.rawValue, initialURL: article.bookmarkURL,
                    close: { if case .article = path.last { path.removeLast() } })
            } else if article.format == "ebook" {
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
