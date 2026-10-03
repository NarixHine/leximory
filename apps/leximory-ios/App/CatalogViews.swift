import SwiftUI
import LeximoryCore

struct LibraryGallery: View {
    let selectedID: LibraryID?
    let open: (FixtureLibrary) -> Void
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var showingAbout = false

    var body: some View {
        GeometryReader { geometry in
            let columns = geometry.size.width >= 360 && !typeSize.isAccessibilitySize ? 2 : 1
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    VStack(alignment: .leading, spacing: 10) {
                        CatalogEyebrow(text: "YOUR COLLECTION", symbol: "books.vertical")
                        Text("My libraries")
                            .font(LeximoryPalette.editorial(43, relativeTo: .largeTitle))
                            .lineSpacing(-3).accessibilityAddTraits(.isHeader)
                    }
                    .padding(.top, 16)
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14, alignment: .top), count: columns), alignment: .leading, spacing: 14) {
                        ForEach(FixtureLibrary.samples) { library in
                            Button { open(library) } label: {
                                LibraryCard(library: library, selected: library.id == selectedID)
                            }
                            .buttonStyle(CatalogPressStyle())
                            .accessibilityIdentifier("library-\(library.id.rawValue)")
                            .accessibilityLabel("\(library.name), \(library.language), \(library.articles.count) texts")
                            .accessibilityAddTraits(library.id == selectedID ? .isSelected : [])
                        }
                    }
                    Text("Sample libraries · Local preview")
                        .font(.caption).foregroundStyle(LeximoryPalette.muted)
                        .padding(.top, 4)
                }
                .frame(maxWidth: 760, alignment: .leading)
                .padding(.horizontal, 22).padding(.bottom, 32)
                .frame(maxWidth: .infinity)
            }
            .background(LeximoryPalette.paper)
        }
        .navigationTitle("Leximory").navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("About this preview", systemImage: "info.circle") { showingAbout = true }
            }
        }
        .sheet(isPresented: $showingAbout) { CatalogAbout() }
    }
}

private struct LibraryCard: View {
    let library: FixtureLibrary
    let selected: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 18) {
                Text(library.language).font(.subheadline.weight(.medium))
                    .foregroundStyle(LeximoryPalette.muted)
                VStack(alignment: .leading, spacing: 10) {
                    Image(systemName: library.symbol).font(.system(size: 24, weight: .light))
                        .foregroundStyle(LeximoryPalette.sage).accessibilityHidden(true)
                    Text(library.name).font(LeximoryPalette.editorial(29, language: library.language))
                        .foregroundStyle(LeximoryPalette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .padding(18).frame(maxWidth: .infinity, minHeight: 162, alignment: .leading)
            .background(LeximoryPalette.cover, in: RoundedRectangle(cornerRadius: 25))
            .padding(8)
            HStack {
                Text("\(library.articles.count) \(library.articles.count == 1 ? "text" : "texts")")
                Spacer()
                Image(systemName: selected ? "checkmark" : "arrow.up.right")
            }
            .font(.caption.weight(.medium)).foregroundStyle(LeximoryPalette.muted)
            .padding(.horizontal, 22).padding(.top, 4).padding(.bottom, 17)
        }
        .background(LeximoryPalette.shell, in: RoundedRectangle(cornerRadius: 33))
        .overlay {
            if selected { RoundedRectangle(cornerRadius: 33).strokeBorder(LeximoryPalette.sage, lineWidth: 1.5) }
        }
        .contentShape(RoundedRectangle(cornerRadius: 33))
    }
}

struct TextGallery: View {
    let library: FixtureLibrary
    let open: (FixtureArticle) -> Void
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(alignment: .leading, spacing: 30) {
                    VStack(alignment: .leading, spacing: 9) {
                        CatalogEyebrow(text: "\(library.language.uppercased()) · \(library.articles.count) \(library.articles.count == 1 ? "TEXT" : "TEXTS")", symbol: library.symbol)
                        Text(library.name).font(LeximoryPalette.editorial(44, relativeTo: .largeTitle, language: library.language))
                            .foregroundStyle(LeximoryPalette.ink).accessibilityAddTraits(.isHeader)
                    }
                    .padding(.top, 12)
                    if let first = library.articles.first {
                        if geometry.size.width >= 640 && !typeSize.isAccessibilitySize {
                            HStack(alignment: .top, spacing: 36) {
                                featured(first).frame(maxWidth: .infinity)
                                remaining.frame(width: geometry.size.width * 0.36)
                            }
                        } else {
                            featured(first)
                            remaining
                        }
                    }
                }
                .frame(maxWidth: 1040, alignment: .leading)
                .padding(.horizontal, 24).padding(.bottom, 32)
                .frame(maxWidth: .infinity)
            }
            .background(LeximoryPalette.paper)
        }
        .navigationTitle("Texts").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("texts-\(library.id.rawValue)")
    }
    private func featured(_ article: FixtureArticle) -> some View {
        Button { open(article) } label: {
            VStack(alignment: .leading, spacing: 17) {
                CoverArt(motif: article.cover).aspectRatio(1.55, contentMode: .fit)
                Text(article.title).font(LeximoryPalette.editorial(36, language: library.language))
                    .foregroundStyle(LeximoryPalette.ink).multilineTextAlignment(.leading)
                Text(article.subtitle).font(.subheadline).foregroundStyle(LeximoryPalette.muted)
                TopicLabels(topics: article.topics)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(CatalogPressStyle())
        .accessibilityIdentifier("text-\(article.id.rawValue)")
        .accessibilityLabel("\(article.title), \(article.subtitle)")
    }
    private var remaining: some View {
        VStack(alignment: .leading, spacing: 26) {
            ForEach(Array(library.articles.dropFirst())) { article in
                Button { open(article) } label: {
                    HStack(alignment: .center, spacing: 18) {
                        VStack(alignment: .leading, spacing: 9) {
                            Text(article.title).font(LeximoryPalette.editorial(27, language: library.language))
                                .foregroundStyle(LeximoryPalette.ink).multilineTextAlignment(.leading)
                            TopicLabels(topics: article.topics)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        CoverArt(motif: article.cover).frame(width: 88, height: 96)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(CatalogPressStyle())
                .accessibilityIdentifier("text-\(article.id.rawValue)")
                .accessibilityLabel("\(article.title), \(article.subtitle)")
            }
        }
    }
}

private struct TopicLabels: View {
    let topics: [String]
    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 7) { ForEach(topics, id: \.self) { topic($0) } }
            VStack(alignment: .leading, spacing: 7) { ForEach(topics, id: \.self) { topic($0) } }
        }
    }
    private func topic(_ text: String) -> some View {
        Text(text).font(.caption).foregroundStyle(LeximoryPalette.muted)
            .padding(.horizontal, 10).padding(.vertical, 5)
            .overlay { Capsule().strokeBorder(LeximoryPalette.illustration.opacity(0.4), lineWidth: 1) }
    }
}

private struct CatalogEyebrow: View {
    let text: String
    let symbol: String
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: symbol).font(.system(size: 13, weight: .light)).accessibilityHidden(true)
            Text(text).font(.system(.caption2, design: .monospaced)).tracking(1.4)
        }.foregroundStyle(LeximoryPalette.muted)
    }
}

private struct CatalogPressStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.78 : 1)
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.98 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.16), value: configuration.isPressed)
    }
}

struct LibraryInvitation: View {
    var body: some View {
        VStack(spacing: 24) {
            CoverArt(motif: .leaf).frame(width: 220, height: 180)
            Text("Open a library.\nStay for a while.")
                .font(LeximoryPalette.editorial(42, relativeTo: .largeTitle)).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(LeximoryPalette.paper)
    }
}

private struct CatalogAbout: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                Text("A place for your words.").font(LeximoryPalette.editorial(36))
                Text("These sample libraries let you explore the native reading experience. Your account and personal libraries aren't connected yet.")
                    .foregroundStyle(LeximoryPalette.muted)
                Text("Library → Texts → Reader").font(.subheadline.weight(.medium))
            }
            .padding(28).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(LeximoryPalette.paper)
            .navigationTitle("Leximory preview").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
    }
}
