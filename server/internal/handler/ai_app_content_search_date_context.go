package handler

import (
	"fmt"
	"time"
)

var chinaStandardTime = time.FixedZone("CST", 8*60*60)

func appendContentSearchDateContext(system string, toolNames []string, now time.Time) string {
	for _, toolName := range toolNames {
		if toolName != "content.search" {
			continue
		}
		return system + "\n\n" + fmt.Sprintf("当前中国标准时间（CST，UTC+08:00）为 %s。调用 content.search 前，必须将用户的相对日期或未写年份、月份的日期换算为明确的 YYYY-MM-DD 日期范围后再调用工具。", now.In(chinaStandardTime).Format("2006-01-02 15:04:05"))
	}
	return system
}
