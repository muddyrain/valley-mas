# Node.js 开发者 Go 语言入门指南 (面向 Valley MAS 项目)

如果你已经熟悉 Node.js (Express, TypeORM, JWT)，那么理解这个项目的 Go 后端会非常快。Go 的核心哲学是 **显式 (Explicit)** 和 **简洁 (Simple)**。

---

## 1. 核心概念对比 (Node.js vs Go)

| 特性          | Node.js (JavaScript)              | Go                       | 说明                                           |
| :------------ | :-------------------------------- | :----------------------- | :--------------------------------------------- |
| **异步/并发** | Event Loop + Promises/Async-Await | Goroutines + Channels    | Go 使用轻量级线程 (协程)，不需要回调。         |
| **包管理**    | `package.json` / `node_modules`   | `go.mod` / `go.sum`      | Go 模块直接编译进二进制，没有 `node_modules`。 |
| **类型检查**  | TypeScript (Runtime is JS)        | 静态编译 (Static Typing) | Go 是强类型语言，必须显式定义结构。            |
| **错误处理**  | `try...catch`                     | `if err != nil`          | Go 显式返回错误，强制开发者处理。              |
| **框架**      | Express / Koa / NestJS            | **Gin** (本项目使用)     | 本项目的 `gin-gonic/gin` 非常像 Express。      |
| **数据库**    | TypeORM / Sequelize / Prisma      | **GORM** (本项目使用)    | 本项目使用 GORM，语法非常直观。                |

---

## 2. 本项目结构解析 (Valley MAS Server)

项目目录在 `server/` 下：

- `main.go`: **程序入口**。像 Node 项目里的 `app.js` 或 `index.ts`。负责初始化配置、数据库、日志和启动服务。
- `go.mod`: **依赖定义**。对应 `package.json`。
- `internal/`: 存放业务逻辑。Go 社区推荐将不公开的代码放在这里。
  - `config/`: 配置加载 (类似加载 `.env` 或 `config.js`)。
  - `database/`: 数据库初始化 (GORM 设置)。
  - `router/`: 路由定义 (对应 Express 的 `routes/`)。
  - `utils/`: 工具类 (如生成 ID、文件处理)。
- `docs/`: Swagger 文档定义。

---

## 3. 你需要掌握的关键 Go 语法

### 3.1 变量与结构 (Structs)

Go 没有 `class`，只有 `struct`。它定义了数据的形状。

```go
// 对应 TS 的 interface 或 class
type User struct {
    ID       uint   `json:"id"`       // `json:"id"` 是标签，控制序列化后的名称
    Username string `json:"username"`
}
```

### 3.2 显式错误处理 (Explicit Errors)

这是 Go 最明显的特征。几乎每个函数都会多返回一个 `error`。

```go
// Node.js:
// const data = await someAsyncFunc(); // 必须 try-catch

// Go:
data, err := someFunc()
if err != nil {
    // 显式处理错误，像处理普通变量一样
    log.Fatalf("出错了: %v", err)
}
```

### 3.3 指针 (Pointers)

你经常会看到 `*` (取值) 和 `&` (取地址)。

- 在 Node 中，对象是引用传递，基础类型是值传递。
- 在 Go 中，你可以显式控制：传值 (Copy) 还是传引用 (Pointer)。
- **提示**: 大多数时候直接看代码，看到 `obj.Field` 就可以，Go 会自动处理解引用。

---

## 4. 本项目使用的主要库 (你已经可以上手了!)

### 4.1 Gin (Web 框架)

如果你会 Express，看这个代码会觉得很亲切：

```go
// server/internal/router/router.go (示例)
r := gin.Default()
r.GET("/ping", func(c *gin.Context) {
    c.JSON(200, gin.H{
        "message": "pong",
    })
})
```

### 4.2 GORM (数据库 ORM)

类似 Sequelize。你可以通过结构体操作数据库。

```go
// server/internal/database/db.go (示例)
var user User
db.First(&user, 1) // 查询 ID 为 1 的用户
```

### 4.3 依赖管理: go.mod & go.sum

- `go.mod`: 类似 `package.json`。定义了项目名称 (`module valley-server`) 和所有直接依赖。
- `go.sum`: 类似 `package-lock.json` 或 `pnpm-lock.yaml`。记录了依赖的精确版本和哈希值，确保构建一致性。
- **常用命令**:
  - `go mod tidy`: 自动清理/添加缺失的依赖 (对应 `npm prune` + `npm install`)。
  - `go get <package_url>`: 添加新依赖 (对应 `npm install <package>`)。

### 4.4 热更新辅助: Air

项目根目录下的 `.air.toml` 表明项目整合了 [Air](https://github.com/air-verse/air)。

- **安装方式**: `go install github.com/air-verse/air@latest`
- **运行**: 直接在 `server/` 目录下输入 `air`。它会监控文件变动并自动编译重启 (极大地提升开发体验，像 `nodemon` 或 Vite 的 HMR)。

---

## 5. 如何运行和调试？ (快速上手)

1.  **准备环境**: 确保安装了 Go 1.25+。
2.  **安装 Air**: `go install github.com/air-verse/air@latest` (强烈建议安装)。
3.  **安装依赖**: 在 `server/` 目录下运行 `go mod tidy`。
4.  **配置环境**: 复制 `.env.example` 为 `.env` 并根据需要修改数据库、密钥等配置。
5.  **启动开发模式**: 运行 `air`。
6.  **基础运行**: 如果不想用 Air，直接运行 `go run main.go`。

---

## 总结建议

作为 Node.js 开发者，你可以先把 Go 当作一个 **没有 `try...catch` 且强制要求类型的 TypeScript**。

- 多看 `internal/router` 了解 API 是如何定义的。
- 多看 `internal/database` 了解数据是怎么存取的。
- 不要纠结复杂的并发 (Concurrency)，本项目前期大多是顺序执行。

如果你有具体的问题 (比如“这段代码里的 `defer` 是什么意思？”)，随时问我！
