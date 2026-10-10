import SwiftUI

struct ArticleReadingHeader: View {
    let article: FixtureArticle
    let language: String
    var onTitleFrame: ((CGRect) -> Void)? = nil
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        ViewThatFits(in: .horizontal) {
            if !typeSize.isAccessibilitySize {
                HStack(alignment: .center, spacing: 0) {
                    titleAndTopics.padding(.horizontal, 32).padding(.vertical, 28)
                        .frame(width: 400, alignment: .leading)
                        .frame(maxHeight: .infinity)
                        .background(LeximoryPalette.shell)
                    artwork.frame(minWidth: 360, minHeight: 340)
                }.fixedSize(horizontal: false, vertical: true)
            }
            VStack(spacing: 16) {
                artwork.frame(height: 196)
                titleAndTopics.padding(.horizontal, 24)
            }
        }.padding(.bottom, 8).coordinateSpace(name: "article-header")
    }
    private var artwork: some View {
        CoverArt(motif: article.cover, identity: article.id.rawValue, animated: true,
                 emoji: article.coverEmoji, cornerRadius: 0)
    }
    private var titleAndTopics: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(article.title).editorialFont(sizeClass == .regular ? 32 : 28, relativeTo: .largeTitle, language: language)
                .tracking(-0.5).lineSpacing(0)
                .fixedSize(horizontal: false, vertical: true)
                .foregroundStyle(LeximoryPalette.ink).accessibilityAddTraits(.isHeader)
                .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("article-header")) } action: { onTitleFrame?($0) }
            CatalogFlowLayout(spacing: 10) {
                ForEach(Array(article.topics.prefix(3)), id: \.self) { topic in
                    Text(topic).editorialFont(14, relativeTo: .caption, language: "Chinese")
                        .foregroundStyle(LeximoryPalette.muted)
                }
            }
        }
    }
}
