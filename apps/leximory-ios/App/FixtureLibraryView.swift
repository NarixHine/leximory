import SwiftUI
import LeximoryCore

private enum BrowserDestination: Hashable {
    case library(FixtureLibrary)
    case article(FixtureArticle)
}

struct FixtureLibraryView: View {
    let playback: PlaybackController
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var path: [BrowserDestination] = []
    @State private var visibility: NavigationSplitViewVisibility = .all

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
                    LibraryGallery(selectedID: library?.id) { path = [.library($0)] }
                        .navigationSplitViewColumnWidth(min: 300, ideal: 340, max: 400)
                } detail: {
                    NavigationStack(path: detailPath) {
                        if let library {
                            TextGallery(library: library) { path = [.library(library), .article($0)] }
                                .navigationDestination(for: BrowserDestination.self) { destination($0) }
                        } else {
                            LibraryInvitation()
                        }
                    }
                }
                .navigationSplitViewStyle(.balanced)
            } else {
                NavigationStack(path: $path) {
                    LibraryGallery(selectedID: nil) { path.append(.library($0)) }
                        .navigationDestination(for: BrowserDestination.self) { destination($0) }
                }
            }
        }
        .onChange(of: path) { _, _ in
            playback.leaveReader(unless: readerID)
            if sizeClass == .regular { visibility = readerID == nil ? .all : .detailOnly }
        }
        .onChange(of: sizeClass) { _, size in
            if size == .regular { visibility = readerID == nil ? .all : .detailOnly }
        }
    }
    @ViewBuilder private func destination(_ destination: BrowserDestination) -> some View {
        switch destination {
        case .library(let library):
            TextGallery(library: library) { path.append(.article($0)) }
        case .article(let article): ReaderScreen(article: article, playback: playback)
        }
    }
}
