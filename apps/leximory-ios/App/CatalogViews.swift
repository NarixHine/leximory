import SwiftUI
import LeximoryCore

struct LibraryGallery: View {
    var libraries: [FixtureLibrary] = FixtureLibrary.samples
    var sampleMode = true
    var refresh: (() async -> Void)? = nil
    var archive: ((FixtureLibrary, Bool) async throws -> Void)? = nil
    var recentlyOpened: [String: FixtureArticle] = [:]
    var openRecent: ((FixtureLibrary, FixtureArticle) -> Void)? = nil
    @State private var archiving: Set<LibraryID> = []
    @State private var archiveError: String?
    let selectedID: LibraryID?
    let open: (FixtureLibrary) -> Void
    @Environment(\.dynamicTypeSize) private var typeSize

    private var active: [FixtureLibrary] { libraries.filter { !$0.isCompact } }
    private var compact: [FixtureLibrary] { libraries.filter(\.isCompact).sorted { $0.shadow && !$1.shadow } }

    var body: some View {
        GeometryReader { geometry in
            let columns = geometry.size.width >= 380 && !typeSize.isAccessibilitySize ? 2 : 1
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    VStack(alignment: .leading, spacing: 5) {
                        HStack(spacing: 6) {
                            Image(systemName: "books.vertical").accessibilityHidden(true)
                            Text("MY LIBRARIES").font(.custom("SpaceMono-Regular", size: 12, relativeTo: .caption)).tracking(1.2)
                        }.foregroundStyle(LeximoryPalette.illustration)
                        Text("我的文库")
                            .font(.custom("LXGWWenKaiScreen", size: 30, relativeTo: .largeTitle))
                            .foregroundStyle(LeximoryPalette.ink).accessibilityAddTraits(.isHeader)
                    }.padding(.horizontal, 14).padding(.top, 18)
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14, alignment: .top), count: columns), alignment: .leading, spacing: 16) {
                        ForEach(active) { library in
                            VStack(spacing: 0) {
                                Button { open(library) } label: {
                                    LibraryCard(library: library, selected: library.id == selectedID, titleSize: columns == 2 && geometry.size.width < 600 ? 24 : 30)
                                }.buttonStyle(CatalogPressStyle())
                                    .accessibilityIdentifier("library-\(library.id.rawValue)")
                                    .accessibilityLabel("\(library.name)，\(library.localizedLanguage)")
                                    .accessibilityAddTraits(library.id == selectedID ? .isSelected : [])
                                HStack(spacing: 0) {
                                    if let recent = recentlyOpened[library.id.rawValue] {
                                        Button { openRecent?(library, recent) } label: {
                                            HStack(spacing: 5) {
                                                Image(systemName: "clock").font(.custom("Raleway-Regular", size: 14))
                                                Text(recent.title).font(LeximoryTypography.interface(12)).lineLimit(1)
                                            }.foregroundStyle(LeximoryPalette.illustration)
                                        }.buttonStyle(.plain).frame(minHeight: 44)
                                            .accessibilityLabel("最近打开：\(recent.title)")
                                            .accessibilityIdentifier("recent-\(library.id.rawValue)")
                                    }
                                    Spacer(minLength: 0)
                                    if archive != nil { archiveButton(library, archived: true) }
                                }.padding(.horizontal, 20).padding(.bottom, 6)
                            }.background(LeximoryPalette.shell, in: RoundedRectangle(cornerRadius: LeximoryLayout.cardRadius))
                        }
                    }
                    if !compact.isEmpty {
                        VStack(alignment: .leading, spacing: 14) {
                            HStack(spacing: 12) {
                                Rectangle().fill(LeximoryPalette.border).frame(width: 18, height: 0.5)
                                Text("已归档").font(LeximoryTypography.interface(14)).accessibilityAddTraits(.isHeader)
                                Rectangle().fill(LeximoryPalette.border).frame(height: 0.5)
                            }.foregroundStyle(LeximoryPalette.secondaryLabel).padding(.top, 14)
                            CatalogFlowLayout(spacing: 8) {
                                ForEach(compact) { library in
                                    HStack(spacing: 2) {
                                        Button { open(library) } label: {
                                            Text(library.name).font(LeximoryTypography.interface(14)).foregroundStyle(LeximoryPalette.muted)
                                                .padding(.leading, 15).padding(.trailing, 8).padding(.vertical, 12)
                                        }.buttonStyle(CatalogPressStyle())
                                            .accessibilityIdentifier("library-\(library.id.rawValue)")
                                            .accessibilityLabel("\(library.name)，已归档")
                                        if archive != nil && !library.shadow { archiveButton(library, archived: false).padding(.trailing, 4) }
                                    }.background(library.id == selectedID ? LeximoryPalette.cover : LeximoryPalette.shell, in: Capsule())
                                }
                            }
                        }
                    }
                }
                .frame(maxWidth: 760, alignment: .leading)
                .padding(.horizontal, LeximoryLayout.pageInset).padding(.bottom, 32)
                .frame(maxWidth: .infinity)
            }.refreshable { await refresh?() }
                .background(LeximoryPalette.paper)
        }
        .alert("暂时无法归档", isPresented: Binding(get: { archiveError != nil }, set: { if !$0 { archiveError = nil } })) {
            Button("完成", role: .cancel) { archiveError = nil }
        } message: { Text(archiveError ?? "") }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .navigationBar)
    }
    private func archiveButton(_ library: FixtureLibrary, archived: Bool) -> some View {
        Button {
            archiving.insert(library.id)
            Task {
                defer { archiving.remove(library.id) }
                do { try await archive?(library, archived) }
                catch { archiveError = "请检查网络后重试。" }
            }
        } label: {
            Group {
                if archiving.contains(library.id) { ProgressView().controlSize(.small) }
                else { Image(systemName: archived ? "archivebox" : "tray.and.arrow.up").font(.custom("Raleway-Regular", size: 15)) }
            }.frame(width: 44, height: 44)
        }.buttonStyle(.plain).foregroundStyle(LeximoryPalette.sage).disabled(archiving.contains(library.id))
            .accessibilityLabel(archived ? "归档 \(library.name)" : "取消归档 \(library.name)")
            .accessibilityIdentifier("archive-\(library.id.rawValue)")
    }

}

private struct LibraryCard: View {
    let library: FixtureLibrary
    let selected: Bool
    let titleSize: CGFloat
    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(library.localizedLanguage).font(LeximoryTypography.interface(14, semibold: true, style: .subheadline))
                .foregroundStyle(LeximoryPalette.illustration)
            Text(library.name).editorialFont(titleSize, language: library.language == "Japanese" ? "Japanese" : "English")
                .foregroundStyle(LeximoryPalette.ink).lineSpacing(1)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 20).padding(.top, 20).padding(.bottom, LeximoryLayout.cardTitleBottom)
        .frame(maxWidth: .infinity, minHeight: 104, alignment: .topLeading)
        .background(LeximoryPalette.cover, in: RoundedRectangle(cornerRadius: LeximoryLayout.innerCardRadius))
        .padding(.horizontal, LeximoryLayout.cardInset).padding(.top, LeximoryLayout.cardInset).padding(.bottom, 6)
        .background(LeximoryPalette.shell, in: RoundedRectangle(cornerRadius: LeximoryLayout.cardRadius))
        .overlay {
            if selected { RoundedRectangle(cornerRadius: LeximoryLayout.cardRadius).strokeBorder(LeximoryPalette.sage, lineWidth: 1.5) }
        }
        .contentShape(RoundedRectangle(cornerRadius: LeximoryLayout.cardRadius))
    }
}

struct TextGallery: View {
    let library: FixtureLibrary
    let open: (FixtureArticle) -> Void
    @Environment(\.dynamicTypeSize) private var typeSize
    var body: some View {
        GeometryReader { geometry in
            let wide = geometry.size.width >= 640 && !typeSize.isAccessibilitySize
            let railCount = geometry.size.width > geometry.size.height ? 5 : 3
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    Text(library.name).editorialFont(24, language: library.language)
                        .tracking(-0.4).fixedSize(horizontal: false, vertical: true)
                        .foregroundStyle(LeximoryPalette.ink).accessibilityAddTraits(.isHeader)
                    if wide, let first = library.articles.first {
                        HStack(alignment: .top, spacing: 32) {
                            articleCard(first, hero: true).frame(maxWidth: .infinity)
                            LazyVStack(spacing: 24) {
                                ForEach(Array(library.articles.dropFirst().prefix(railCount))) { compactCard($0) }
                            }.accessibilityIdentifier("texts-supporting-rail").frame(width: min(350, (geometry.size.width - 80) * 0.43))
                        }
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 210), spacing: 24)], spacing: 28) {
                            ForEach(Array(library.articles.dropFirst(railCount + 1))) { articleCard($0) }
                        }
                    } else {
                        LazyVStack(spacing: 24) {
                            ForEach(library.articles) { compactCard($0) }
                        }.frame(maxWidth: 420)
                    }
                }
                .padding(.horizontal, 24).padding(.top, 22).padding(.bottom, 32)
                .frame(maxWidth: 1088).frame(maxWidth: .infinity)
            }.background(LeximoryPalette.paper)
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .accessibilityIdentifier("texts-\(library.id.rawValue)")
    }
    private func articleCard(_ article: FixtureArticle, hero: Bool = false) -> some View {
        Button { open(article) } label: {
            VStack(spacing: hero ? 24 : 12) {
                CoverArt(motif: article.cover, identity: article.id.rawValue, animated: true, emoji: article.coverEmoji, background: .newspaper)
                    .aspectRatio(4.0 / 3, contentMode: .fit)
                VStack(spacing: 8) {
                    Text(article.title).editorialFont(hero ? 36 : 24, language: library.language)
                        .tracking(-0.4).lineSpacing(1).foregroundStyle(LeximoryPalette.ink)
                        .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                    TopicLabels(topics: article.topics, centered: true)
                }
            }.frame(maxWidth: .infinity).contentShape(Rectangle())
        }.buttonStyle(CatalogPressStyle())
            .accessibilityIdentifier("text-\(article.id.rawValue)")
            .accessibilityLabel(article.title)
    }
    private func compactCard(_ article: FixtureArticle) -> some View {
        Button { open(article) } label: {
            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(article.title).editorialFont(20, language: library.language)
                        .tracking(-0.3).lineSpacing(1).foregroundStyle(LeximoryPalette.ink)
                        .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                    TopicLabels(topics: article.topics)
                }.frame(maxWidth: .infinity, alignment: .leading)
                CoverArt(motif: article.cover, identity: article.id.rawValue, animated: true, emoji: article.coverEmoji, background: .newspaper).frame(width: 88, height: 88)
            }.contentShape(Rectangle())
        }.buttonStyle(CatalogPressStyle())
            .accessibilityIdentifier("text-\(article.id.rawValue)").accessibilityLabel(article.title)
    }
}

private struct TopicLabels: View {
    let topics: [String]
    var centered = false
    var body: some View {
        CatalogFlowLayout(spacing: 6, centered: centered) {
            ForEach(Array(topics.prefix(3)), id: \.self) { text in
                Text(text).font(.custom("LXGWWenKaiScreen", size: 12, relativeTo: .caption))
                    .foregroundStyle(LeximoryPalette.muted)
                    .padding(.horizontal, 9).padding(.vertical, 4)
                    .overlay { Capsule().strokeBorder(LeximoryPalette.secondaryBorder, lineWidth: 1) }
            }
        }
    }
}

struct CatalogFlowLayout: Layout {
    var spacing: CGFloat
    var centered = false
    private func rows(width: CGFloat, subviews: Subviews) -> [[Int]] {
        var rows: [[Int]] = [[]]; var used: CGFloat = 0
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(ProposedViewSize(width: width, height: nil))
            if used + size.width > width && !rows[rows.count - 1].isEmpty { rows.append([]); used = 0 }
            rows[rows.count - 1].append(index); used += size.width + spacing
        }
        return rows
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 760
        let heights = rows(width: width, subviews: subviews).map { row in
            row.map { subviews[$0].sizeThatFits(ProposedViewSize(width: width, height: nil)).height }.max() ?? 0
        }
        return CGSize(width: width, height: heights.reduce(0, +) + CGFloat(max(0, heights.count - 1)) * spacing)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in rows(width: bounds.width, subviews: subviews) {
            let sizes = row.map { subviews[$0].sizeThatFits(ProposedViewSize(width: bounds.width, height: nil)) }
            let width = sizes.reduce(0) { $0 + $1.width } + CGFloat(max(0, row.count - 1)) * spacing
            var x = bounds.minX + (centered ? max(0, (bounds.width - width) / 2) : 0)
            for (index, size) in zip(row, sizes) {
                subviews[index].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += (sizes.map(\.height).max() ?? 0) + spacing
        }
    }
}

private struct CatalogPressStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.opacity(configuration.isPressed ? 0.78 : 1)
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.98 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.16), value: configuration.isPressed)
    }
}
