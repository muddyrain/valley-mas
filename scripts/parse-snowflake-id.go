package main

import (
	"fmt"
	"time"

	"github.com/bwmarrin/snowflake"
)

func main() {
	// 你的实际 ID
	id := int64(2028025683447386112)
	sfID := snowflake.ID(id)

	// 提取时间戳（毫秒）
	timestamp := sfID.Time()
	actualTime := time.UnixMilli(timestamp)

	// 提取节点 ID
	nodeID := sfID.Node()

	// 提取序列号
	step := sfID.Step()

	fmt.Println("=== Snowflake ID 解析 ===")
	fmt.Printf("原始 ID: %d\n", id)
	fmt.Printf("生成时间: %s\n", actualTime.Format("2006-01-02 15:04:05.000"))
	fmt.Printf("节点 ID: %d\n", nodeID)
	fmt.Printf("序列号: %d\n", step)
	fmt.Println()

	// 解析多个连续 ID
	fmt.Println("=== 连续 ID 对比 ===")
	ids := []int64{
		2028025683447386112,
		2028025683447386113,
		2028025683447386114,
		2028025683447386115,
		2028025683447386116,
	}

	for i, rawID := range ids {
		sfID := snowflake.ID(rawID)
		fmt.Printf("[%d] ID: %d, 时间: %s, 序列: %d\n",
			i+1,
			rawID,
			time.UnixMilli(sfID.Time()).Format("15:04:05.000"),
			sfID.Step(),
		)
	}
}
