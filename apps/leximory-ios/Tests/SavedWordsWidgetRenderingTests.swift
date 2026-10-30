import SwiftUI
import Testing
import WidgetKit
@testable import Leximory

@MainActor struct SavedWordsWidgetRenderingTests {
    @Test(arguments: [DynamicTypeSize.large, .xxxLarge])
    func exportDesignPreviews(typeSize: DynamicTypeSize) throws {
        for dark in [false, true] {
            let preview = VStack(alignment: .leading, spacing: 24) {
                HStack(alignment: .top, spacing: 24) {
                    widget(.systemSmall, width: 170, height: 170)
                    widget(.systemMedium, width: 364, height: 170)
                }
            }
            .padding(32)
            .background(Color(uiColor: .systemGroupedBackground))
            .environment(\.colorScheme, dark ? .dark : .light)
            .environment(\.dynamicTypeSize, typeSize)
            let renderer = ImageRenderer(content: preview)
            renderer.scale = 2
            let data = try #require(renderer.uiImage?.pngData())
            Attachment.record(data, named: "widget-\(dark ? "dark" : "light")-\(typeSize).png")
        }
    }

    @Test func narrowAccessibilityLayoutsRender() throws {
        for typeSize in [DynamicTypeSize.large, .accessibility3] {
            let preview = VStack(spacing: 24) {
                widget(.systemMedium, width: 320, height: 155)
            }
            .padding(24).background(LeximoryPalette.shell)
            .environment(\.dynamicTypeSize, typeSize)
            let renderer = ImageRenderer(content: preview)
            renderer.scale = 2
            Attachment.record(try #require(renderer.uiImage?.pngData()), named: "widget-narrow-\(typeSize).png")
        }
    }

    @Test func emptyStatesRenderWithoutInventingActivity() throws {
        let preview = HStack(spacing: 24) {
            widget(.systemSmall, width: 170, height: 170, snapshot: nil)
            widget(.systemSmall, width: 170, height: 170, snapshot: SavedWordsSnapshot(activity: [], endingOn: "2026-10-30"))
        }
        .padding(32)
        .background(LeximoryPalette.paper)
        let renderer = ImageRenderer(content: preview)
        renderer.scale = 2
        Attachment.record(try #require(renderer.uiImage?.pngData()), named: "widget-empty.png")
    }

    private func widget(_ family: WidgetFamily, width: CGFloat, height: CGFloat, snapshot: SavedWordsSnapshot? = .sample()) -> some View {
        SavedWordsWidgetView(snapshot: snapshot, family: family)
            .frame(width: width, height: height)
            .background { LeximoryWidgetMesh() }
            .clipShape(.rect(cornerRadius: 24))
    }
}
