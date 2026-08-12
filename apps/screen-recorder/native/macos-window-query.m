#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>
#import <ScreenCaptureKit/ScreenCaptureKit.h>

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

static NSString *CaptureError(NSString *message) {
  NSString *singleLine = [[message ?: @"未知错误" componentsSeparatedByCharactersInSet:
      [NSCharacterSet newlineCharacterSet]] componentsJoinedByString:@" "];
  return [@"error:" stringByAppendingString:singleLine];
}

static NSString *EncodePng(CGImageRef image) {
  NSMutableData *data = [NSMutableData data];
  CGImageDestinationRef destination = CGImageDestinationCreateWithData(
      (__bridge CFMutableDataRef)data, CFSTR("public.png"), 1, NULL);
  if (destination == NULL) return CaptureError(@"无法创建 PNG 编码器");
  CGImageDestinationAddImage(destination, image, NULL);
  BOOL encoded = CGImageDestinationFinalize(destination);
  CFRelease(destination);
  if (!encoded || data.length == 0) return CaptureError(@"无法编码长截图帧");
  return [data base64EncodedStringWithOptions:0];
}

static NSSet<NSNumber *> *ParseWindowIds(const char *value) {
  NSString *text = [NSString stringWithUTF8String:value ?: ""];
  NSMutableSet<NSNumber *> *ids = [NSMutableSet set];
  for (NSString *part in [text componentsSeparatedByString:@","]) {
    NSScanner *scanner = [NSScanner scannerWithString:part];
    unsigned long long parsed = 0;
    if (part.length > 0 && [scanner scanUnsignedLongLong:&parsed] && scanner.isAtEnd) {
      [ids addObject:@((CGWindowID)parsed)];
    }
  }
  return ids;
}

static SCContentFilter *CreateCaptureFilter(CGDirectDisplayID displayId,
                                             NSSet<NSNumber *> *excludedWindowIds,
                                             NSString **errorMessage) {
  __block SCContentFilter *filter = nil;
  __block NSString *failure = nil;
  dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
  [SCShareableContent
      getShareableContentExcludingDesktopWindows:NO
                             onScreenWindowsOnly:YES
                               completionHandler:^(SCShareableContent *content, NSError *error) {
    if (error != nil || content == nil) {
      failure = CaptureError(error.localizedDescription ?: @"无法读取屏幕内容");
      dispatch_semaphore_signal(semaphore);
      return;
    }

    SCDisplay *targetDisplay = nil;
    for (SCDisplay *display in content.displays) {
      if (display.displayID == displayId) {
        targetDisplay = display;
        break;
      }
    }
    if (targetDisplay == nil) {
      failure = CaptureError(@"无法读取目标显示器");
      dispatch_semaphore_signal(semaphore);
      return;
    }

    NSMutableArray<SCWindow *> *excludedWindows = [NSMutableArray array];
    for (SCWindow *window in content.windows) {
      if ([excludedWindowIds containsObject:@(window.windowID)]) {
        [excludedWindows addObject:window];
      }
    }
    filter = [[SCContentFilter alloc] initWithDisplay:targetDisplay
                                      excludingWindows:excludedWindows];
    dispatch_semaphore_signal(semaphore);
  }];

  if (dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, 4 * NSEC_PER_SEC)) != 0) {
    failure = CaptureError(@"初始化长截图捕获超时");
  }
  if (errorMessage != NULL) *errorMessage = failure;
  return filter;
}

static NSString *CaptureSelection(SCContentFilter *filter,
                                  SCStreamConfiguration *configuration) {
  __block NSString *response = nil;
  dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
  [SCScreenshotManager captureImageWithFilter:filter
                                configuration:configuration
                            completionHandler:^(CGImageRef image, NSError *error) {
    response = error != nil || image == NULL
                   ? CaptureError(error.localizedDescription ?: @"无法捕获长截图帧")
                   : EncodePng(image);
    dispatch_semaphore_signal(semaphore);
  }];
  if (dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, 4 * NSEC_PER_SEC)) != 0) {
    return CaptureError(@"长截图帧捕获超时");
  }
  return response ?: CaptureError(@"长截图帧捕获失败");
}

int main(int argc, const char *argv[]) {
  BOOL captureMode = argc == 10 && strcmp(argv[1], "capture") == 0;
  CGDirectDisplayID displayId = captureMode ? (CGDirectDisplayID)strtoull(argv[2], NULL, 10) : 0;
  NSSet<NSNumber *> *excludedWindowIds = captureMode ? ParseWindowIds(argv[3]) : [NSSet set];
  CGRect sourceRect = captureMode
                          ? CGRectMake(strtod(argv[4], NULL), strtod(argv[5], NULL),
                                       strtod(argv[6], NULL), strtod(argv[7], NULL))
                          : CGRectZero;
  size_t pixelWidth = captureMode ? (size_t)strtoull(argv[8], NULL, 10) : 0;
  size_t pixelHeight = captureMode ? (size_t)strtoull(argv[9], NULL, 10) : 0;
  SCContentFilter *captureFilter = nil;
  SCStreamConfiguration *captureConfiguration = nil;
  NSString *captureSetupError = nil;
  if (captureMode) {
    if (@available(macOS 14.0, *)) {
      captureFilter = CreateCaptureFilter(displayId, excludedWindowIds, &captureSetupError);
      if (captureFilter != nil) {
        captureConfiguration = [[SCStreamConfiguration alloc] init];
        captureConfiguration.sourceRect = sourceRect;
        captureConfiguration.width = pixelWidth;
        captureConfiguration.height = pixelHeight;
        captureConfiguration.showsCursor = NO;
      }
    } else {
      captureSetupError = CaptureError(@"长截图需要 macOS 14 或更高版本");
    }
  }
  char command[64];
  while (fgets(command, sizeof(command), stdin) != NULL) {
    if (strncmp(command, "query", 5) != 0) continue;
    @autoreleasepool {
      if (captureMode) {
        NSString *response = captureSetupError ?: CaptureSelection(captureFilter,
                                                                   captureConfiguration);
        NSData *data = [response dataUsingEncoding:NSUTF8StringEncoding];
        fwrite(data.bytes, 1, data.length, stdout);
        fputc('\n', stdout);
        fflush(stdout);
        continue;
      }
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
