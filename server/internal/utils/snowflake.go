package utils

import (
	"math/rand"
	"sync"
	"time"

	"github.com/bwmarrin/snowflake"
)

var (
	node     *snowflake.Node
	nodeOnce sync.Once
	rng      = rand.New(rand.NewSource(time.Now().UnixNano()))
)

// InitSnowflake 初始化 Snowflake 节点
// nodeID: 节点ID，范围 0-1023，用于分布式环境区分不同机器
func InitSnowflake(nodeID int64) error {
	var err error
	nodeOnce.Do(func() {
		node, err = snowflake.NewNode(nodeID)
	})
	return err
}

// GenerateID 生成唯一ID
// 返回 int64 类型的 Snowflake ID
func GenerateID() int64 {
	if node == nil {
		// 如果未初始化，使用默认节点ID 1
		_ = InitSnowflake(1)
	}
	return node.Generate().Int64()
}

// GenerateIDString 生成唯一ID（字符串格式）
func GenerateIDString() string {
	if node == nil {
		_ = InitSnowflake(1)
	}
	return node.Generate().String()
}

// ParseID 解析 Snowflake ID，获取时间戳等信息
func ParseID(id int64) snowflake.ID {
	return snowflake.ID(id)
}

// GetTimestamp 从 ID 中提取时间戳（毫秒）
func GetTimestamp(id int64) int64 {
	sfID := snowflake.ID(id)
	return sfID.Time()
}

// GenerateRandomString 生成指定长度的随机字符串
// length: 字符串长度
func GenerateRandomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[rng.Intn(len(charset))]
	}
	return string(b)
}
