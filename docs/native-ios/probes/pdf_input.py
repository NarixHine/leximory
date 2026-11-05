"""Read-only LLDB probes for the installed saved-PDF reader."""

import lldb


def _evaluate(target, expression):
    options = lldb.SBExpressionOptions()
    options.SetLanguage(lldb.eLanguageTypeObjC_plus_plus)
    options.SetIgnoreBreakpoints(True)
    return target.EvaluateExpression(expression, options)


def state(debugger, command, result, internal_dict):
    target = debugger.GetSelectedTarget()
    _evaluate(target, '@import UIKit; @import PDFKit; @import PencilKit;')
    value = _evaluate(target, '''({
      NSMutableArray *views = [NSMutableArray array];
      for (UIWindowScene *scene in [[UIApplication sharedApplication] connectedScenes]) {
        if ([scene isKindOfClass:[UIWindowScene class]]) { [views addObjectsFromArray:[scene windows]]; }
      }
      NSMutableArray *readers = [NSMutableArray array];
      NSMutableArray *overlays = [NSMutableArray array];
      NSMutableArray *canvases = [NSMutableArray array];
      for (NSUInteger i=0; i<[views count]; i++) {
        UIView *v = (UIView *)[views objectAtIndex:i];
        [views addObjectsFromArray:[v subviews]];
        if ([v isKindOfClass:[PDFView class]]) {
          PDFView *pdf = (PDFView *)v;
          [readers addObject:@{ @"class":NSStringFromClass([v class]), @"markup":@([pdf isInMarkupMode]),
            @"selectionLength":@([[[pdf currentSelection] string] length]) }];
        }
        if ([NSStringFromClass([v class]) containsString:@"PDFDrawingOverlay"]) {
          [overlays addObject:@{ @"interactive":@([v isUserInteractionEnabled]),
            @"frame":NSStringFromCGRect([v frame]) }];
        }
        if ([v isKindOfClass:[PKCanvasView class]]) {
          PKCanvasView *canvas = (PKCanvasView *)v;
          [canvases addObject:@{ @"interactive":@([canvas isUserInteractionEnabled]),
            @"drawingEnabled":@([canvas isDrawingEnabled]), @"drawingPolicy":@([canvas drawingPolicy]) }];
        }
      }
      @{ @"os":[[NSProcessInfo processInfo] operatingSystemVersionString],
         @"idiom":@([[UIDevice currentDevice] userInterfaceIdiom]),
         @"readers":readers, @"overlays":overlays, @"canvases":canvases };
    })''')
    if value.GetError().Fail():
        result.SetError(str(value.GetError()))
    else:
        result.AppendMessage(value.GetObjectDescription())


def trace_touch(frame, breakpoint_location, internal_dict):
    address = frame.FindVariable('touch').GetValueAsUnsigned()
    if not address:
        return False
    target = frame.GetThread().GetProcess().GetTarget()
    view = f'[(UITouch *){address} view]'
    parents = []
    for _ in range(4):
        parents.append(f'NSStringFromClass([{view} class]) ?: @"none"')
        view = f'[{view} superview]'
    expression = '@{ @"type":@([(UITouch *)' + str(address) + ' type]), @"recipientAndParents":@[' + ','.join(parents) + '] }'
    value = _evaluate(target, expression)
    print('PDF touch: ' + (value.GetObjectDescription() or str(value.GetError())))
    return False


def trace(debugger, command, result, internal_dict):
    target = debugger.GetSelectedTarget()
    _evaluate(target, '@import UIKit;')
    breakpoint = target.BreakpointCreateByRegex(r'EbookGestures\.gestureRecognizer\(.*shouldReceive')
    breakpoint.SetScriptCallbackFunction(__name__ + '.trace_touch')
    result.AppendMessage(f'Touch-routing breakpoint {breakpoint.GetID()}, {breakpoint.GetNumLocations()} locations. Delete this breakpoint after capture.')


def __lldb_init_module(debugger, internal_dict):
    debugger.HandleCommand('command script add -f pdf_input.state pdf-input-state')
    debugger.HandleCommand('command script add -f pdf_input.trace pdf-input-trace')
