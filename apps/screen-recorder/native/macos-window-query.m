#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>

static NSString *ReadString(NSDictionary *window, CFStringRef key) {
  id value = window[(__bridge NSString *)key];
  return [value isKindOfClass:[NSString class]] ? value : @"";
}

static NSArray *ReadVisibleWindows(void) {
  CFArrayRef windowList = CGWindowListCopyWindowInfo(
      kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
      kCGNullWindowID);
  if (windowList == NULL) return @[];

  NSArray *windows = CFBridgingRelease(windowList);
  NSMutableArray *rows = [NSMutableArray arrayWithCapacity:windows.count];
  CGWindowLevel normalWindowLevel = CGWindowLevelForKey(kCGNormalWindowLevelKey);
  CGWindowLevel mainMenuWindowLevel = CGWindowLevelForKey(kCGMainMenuWindowLevelKey);
  CGWindowLevel statusWindowLevel = CGWindowLevelForKey(kCGStatusWindowLevelKey);
  for (NSDictionary *window in windows) {
    NSNumber *layer = window[(__bridge NSString *)kCGWindowLayer];
    NSNumber *alpha = window[(__bridge NSString *)kCGWindowAlpha];
    NSNumber *windowNumber = window[(__bridge NSString *)kCGWindowNumber];
    NSNumber *processId = window[(__bridge NSString *)kCGWindowOwnerPID];
    NSDictionary *bounds = window[(__bridge NSString *)kCGWindowBounds];
    if (![layer isKindOfClass:[NSNumber class]] ||
        ![alpha isKindOfClass:[NSNumber class]] || alpha.doubleValue <= 0 ||
        ![windowNumber isKindOfClass:[NSNumber class]] ||
        ![processId isKindOfClass:[NSNumber class]] ||
        ![bounds isKindOfClass:[NSDictionary class]]) {
      continue;
    }

    NSInteger windowLayer = layer.integerValue;
    BOOL isSystemUI = windowLayer == mainMenuWindowLevel || windowLayer == statusWindowLevel;
    if (windowLayer != normalWindowLevel && !isSystemUI) continue;

    CGRect rect = CGRectZero;
    CGFloat minimumSize = isSystemUI ? 8 : 16;
    if (!CGRectMakeWithDictionaryRepresentation((__bridge CFDictionaryRef)bounds, &rect) ||
        rect.size.width < minimumSize || rect.size.height < minimumSize) {
      continue;
    }

    NSString *owner = ReadString(window, kCGWindowOwnerName);
    NSString *title = ReadString(window, kCGWindowName);
    if (title.length == 0) title = owner;
    if (title.length == 0) continue;

    [rows addObject:@{
      @"id" : windowNumber.stringValue,
      @"title" : title,
      @"processId" : processId,
      @"kind" : isSystemUI ? @"system-ui" : @"window",
      @"x" : @(rect.origin.x),
      @"y" : @(rect.origin.y),
      @"width" : @(rect.size.width),
      @"height" : @(rect.size.height),
    }];
  }
  return rows;
}

int main(void) {
  char command[64];
  while (fgets(command, sizeof(command), stdin) != NULL) {
    if (strncmp(command, "query", 5) != 0) continue;
    @autoreleasepool {
      NSData *data = [NSJSONSerialization dataWithJSONObject:ReadVisibleWindows()
                                                     options:0
                                                       error:nil];
      if (data == nil) data = [@"[]" dataUsingEncoding:NSUTF8StringEncoding];
      fwrite(data.bytes, 1, data.length, stdout);
      fputc('\n', stdout);
      fflush(stdout);
    }
  }
  return 0;
}
