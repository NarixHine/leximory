import SwiftUI

struct PDFOutlineControls: View {
    let model: PDFOutlineModel?
    let readOnly: Bool
    let account: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) {
                    generationButton.fixedSize(horizontal: true, vertical: false)
                    Spacer(minLength: 0)
                    historyButtons.fixedSize(horizontal: true, vertical: false)
                }
                VStack(alignment: .leading, spacing: 6) {
                    generationButton
                    historyButtons
                }
            }
            if let model {
                if let error = model.error {
                    Text(error).foregroundStyle(.secondary)
                } else if !model.busy, let reason = model.unavailableReason {
                    Text(reason).foregroundStyle(.secondary)
                }
                if model.exhausted {
                    Button("账号设置", action: account)
                        .frame(minHeight: 44).contentShape(Rectangle())
                        .accessibilityHint("查看额度和订阅计划")
                }
            } else {
                Text("暂时无法生成目录。").foregroundStyle(.secondary)
            }
        }
        .interfaceFont(15, style: .subheadline)
        .buttonStyle(.glass)
        .buttonBorderShape(.capsule)
        .controlSize(.regular)
        .tint(.primary)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
        .task { await model?.refreshAllowance() }
    }

    private var generationButton: some View {
        Button {
            model?.start()
        } label: {
            HStack(spacing: 8) {
                if model?.busy == true { ProgressView().controlSize(.small).accessibilityHidden(true) }
                Text(model?.busy == true ? (model?.generating == true ? "正在生成目录" : "正在保存目录") : "AI 生成目录")
            }
            .frame(minHeight: 28)
        }
        .frame(minHeight: 44).contentShape(Rectangle())
        .disabled(readOnly || model?.canGenerate != true)
        .accessibilityIdentifier("pdf-outline-generate")
        .accessibilityHint("每次生成消耗 1 额度。生成时可关闭目录继续阅读。")
    }

    @ViewBuilder private var historyButtons: some View {
        if let model, model.canUndo || model.canRedo {
            HStack(spacing: 8) {
                Button("撤销") { model.start(.undo) }
                    .frame(minWidth: 44, minHeight: 44).contentShape(Rectangle())
                    .disabled(readOnly || !model.canRestore || !model.canUndo)
                    .accessibilityHint("恢复上一次目录，不消耗额度")
                Button("重做") { model.start(.redo) }
                    .frame(minWidth: 44, minHeight: 44).contentShape(Rectangle())
                    .disabled(readOnly || !model.canRestore || !model.canRedo)
                    .accessibilityHint("重新应用生成的目录，不消耗额度")
            }
        }
    }
}
