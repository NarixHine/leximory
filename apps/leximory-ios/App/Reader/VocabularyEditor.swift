import SwiftUI
import UIKit
import LeximoryCore

struct VocabularyEditor: View {
    @Environment(\.nativeSync) private var sync
    @Bindable var model: VocabularyEditModel
    let language: String
    var failure: String? = nil
    let submit: () -> Void
    let cancel: () -> Void
    @FocusState private var focusedField: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Group {
                let fields = model.draft
                field("词条", value: binding(\.lemma), lines: 1...3)
                field("释义", value: binding(\.definition), lines: 3...12)
                if fields.etymology != nil { field("语源", value: optionalBinding(\.etymology), lines: 2...8) }
                if fields.cognates != nil { field("同源词", value: optionalBinding(\.cognates), lines: 2...8) }
                HStack(spacing: 12) {
                    Button {
                        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                        focusedField = nil
                        submit()
                    } label: {
                        Group {
                            if model.saving { ProgressView().tint(LeximoryPalette.paper) }
                            else { Image(systemName: "checkmark.circle").font(.system(size: 22)) }
                        }.frame(width: 48, height: 48).foregroundStyle(LeximoryPalette.paper)
                            .background(LeximoryPalette.sage, in: Circle())
                    }.buttonStyle(.plain).disabled(model.saving || !fields.isValid || sync?.online == false).accessibilityLabel("保存修改")
                    Button("取消", systemImage: "xmark.circle", action: cancel)
                        .labelStyle(.iconOnly).frame(width: 44, height: 44).disabled(model.saving)
                }
            }
            if let error = failure ?? model.error { Text(error).font(LeximoryTypography.interface(14)).foregroundStyle(LeximoryPalette.muted) }
        }.disabled(model.saving)
    }

    private func binding(_ key: WritableKeyPath<VocabularyFields, String>) -> Binding<String> {
        Binding(get: { model.draft[keyPath: key] }, set: { model.draft[keyPath: key] = $0 })
    }
    private func optionalBinding(_ key: WritableKeyPath<VocabularyFields, String?>) -> Binding<String> {
        Binding(get: { model.draft[keyPath: key] ?? "" }, set: { model.draft[keyPath: key] = $0 })
    }
    private func field(_ label: String, value: Binding<String>, lines: ClosedRange<Int>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(LeximoryTypography.interface(15)).foregroundStyle(LeximoryPalette.illustration)
            Group {
                if label == "词条" { TextField(label, text: value) }
                else { TextField(label, text: value, axis: .vertical).lineLimit(lines) }
            }
                .focused($focusedField, equals: label)
                .submitLabel(label == "词条" ? .done : .return)
                .onSubmit { if label == "词条" { focusedField = nil } }
                .font(LeximoryTypography.prose(18, language: language)).lineSpacing(4)
                .padding(12).background(LeximoryPalette.paper, in: RoundedRectangle(cornerRadius: 16))
                .accessibilityIdentifier("edit-\(label)")
        }
    }
}
