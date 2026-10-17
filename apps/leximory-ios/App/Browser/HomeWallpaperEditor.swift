import SwiftUI
import PhotosUI

struct HomeWallpaperEditor: View {
    let store: HomeWallpaperStore
    @State private var appearance: HomeWallpaperAppearance
    @State private var selection: PhotosPickerItem?
    @State private var importing = false
    @State private var error: String?
    @Environment(\.dismiss) private var dismiss

    init(store: HomeWallpaperStore, appearance: HomeWallpaperAppearance) {
        self.store = store
        _appearance = State(initialValue: appearance)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    Picker("外观", selection: $appearance) {
                        ForEach(HomeWallpaperAppearance.allCases) { Text($0.title).tag($0) }
                    }.pickerStyle(.segmented).disabled(importing)
                        .accessibilityIdentifier("wallpaper-appearance")

                    preview

                    VStack(spacing: 12) {
                        photoPicker

                        if let error {
                            Text(error).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                                .accessibilityIdentifier("wallpaper-error")
                        }

                        Button("恢复默认") {
                            do { try store.remove(appearance); error = nil }
                            catch { self.error = "暂时无法恢复默认，请重试。" }
                        }.disabled(store[appearance] == nil || importing || !store.loaded)
                            .frame(minHeight: 44).tint(.primary)
                            .accessibilityIdentifier("wallpaper-reset")
                    }
                }.padding(24).frame(maxWidth: 400).frame(maxWidth: .infinity)
            }
            .scrollBounceBehavior(.basedOnSize)
            .font(LeximoryTypography.interface(17, style: .body))
            .navigationTitle("主页壁纸").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }.disabled(importing).accessibilityIdentifier("wallpaper-done")
                }
            }
        }
        .interactiveDismissDisabled(importing)
        .task { await store.load() }
        .task(id: selection) {
            guard let selection else { return }
            let target = appearance
            importing = true; error = nil
            defer { importing = false }
            do {
                guard let data = try await selection.loadTransferable(type: Data.self) else {
                    throw CocoaError(.fileReadCorruptFile)
                }
                try await store.set(data, for: target)
            } catch is CancellationError {
            } catch {
                self.error = "这张照片暂时无法使用，请重试或选择其他照片。"
            }
            self.selection = nil
        }
        .onChange(of: appearance) { error = nil }
    }

    private var photoPicker: some View {
        let title = store[appearance] == nil ? "选择照片" : "更换照片"
        let busy = importing
        return PhotosPicker(selection: $selection, matching: .images, preferredItemEncoding: .current) {
            Label(title, systemImage: "photo")
                .frame(maxWidth: .infinity, minHeight: 44)
                .overlay(alignment: .trailing) { if busy { ProgressView().padding(.trailing, 12) } }
        }.buttonStyle(.borderedProminent).tint(LeximoryPalette.sage)
            .disabled(importing || !store.loaded)
            .accessibilityIdentifier("wallpaper-choose-photo")
    }

    private var preview: some View {
        HomeWallpaperSurface(wallpaper: store[appearance]) {
            BrowserHomeView(compact: false, recent: [], browse: {}, paste: {}, recentWebpages: [],
                openWebpage: { _ in }, bookmarks: {}, ebook: {}, account: {}, resume: { _ in })
                .frame(width: 360, height: 560)
        }
        .environment(\.colorScheme, appearance.colorScheme)
        .environment(\.browserChromeHeight, 0)
        .clipShape(RoundedRectangle(cornerRadius: 32))
        .overlay { RoundedRectangle(cornerRadius: 32).strokeBorder(.primary.opacity(0.1), lineWidth: 1) }
        .scaleEffect(0.6)
        .frame(width: 216, height: 336)
        .allowsHitTesting(false)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(appearance.title)模式主页预览")
        .accessibilityValue(store[appearance] == nil ? "默认" : "自选照片")
        .accessibilityIdentifier("wallpaper-preview")
    }
}
