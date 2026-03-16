---
title: TypeScript 最佳实践
date: 2024-03-10
tags: ["TypeScript", "前端", "JavaScript"]
category: 技术
cover: https://picsum.photos/seed/typescript/800/400
---

# TypeScript 最佳实践

TypeScript 是 JavaScript 的超集，添加了静态类型检查。它可以帮助我们在开发阶段发现错误，提高代码质量和可维护性。

## 为什么使用 TypeScript？

- **类型安全**：在编译时捕获错误
- **智能提示**：更好的 IDE 支持
- **重构友好**：安全的代码重构
- **文档化**：类型即文档

## 基础类型

```typescript
// 基本类型
let name: string = "Alice";
let age: number = 25;
let isActive: boolean = true;

// 数组
let numbers: number[] = [1, 2, 3];
let names: Array<string> = ["Alice", "Bob"];

// 对象
interface Person {
  name: string;
  age: number;
  email?: string; // 可选属性
}

const person: Person = {
  name: "Alice",
  age: 25
};
```

## 高级类型

### 联合类型和交叉类型

```typescript
// 联合类型
type ID = string | number;

// 交叉类型
interface Employee {
  name: string;
  employeeId: number;
}

interface Manager {
  department: string;
}

type ManagerEmployee = Employee & Manager;
```

### 泛型

```typescript
function identity<T>(arg: T): T {
  return arg;
}

// 使用
let output = identity<string>("myString");
```

## 最佳实践

### 1. 启用严格模式

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

### 2. 使用接口定义对象形状

```typescript
// 好的做法
interface User {
  id: number;
  name: string;
  email: string;
}

// 避免使用 any
function processUser(user: any) { /* ... */ } // ❌
function processUser(user: User) { /* ... */ } // ✅
```

### 3. 使用类型推断

```typescript
// TypeScript 可以推断类型
let message = "Hello"; // 推断为 string

// 不需要显式声明
let message: string = "Hello"; // 冗余
```

### 4. 使用枚举或常量对象

```typescript
// 使用常量对象替代枚举
const Status = {
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected'
} as const;

type Status = typeof Status[keyof typeof Status];
```

## 在 React 中使用 TypeScript

```typescript
import React, { useState } from 'react';

interface Props {
  title: string;
  onClick?: () => void;
}

const MyComponent: React.FC<Props> = ({ title, onClick }) => {
  const [count, setCount] = useState<number>(0);

  return (
    <div onClick={onClick}>
      <h1>{title}</h1>
      <p>Count: {count}</p>
    </div>
  );
};
```

## 总结

TypeScript 是现代 JavaScript 开发的必备工具。通过遵循这些最佳实践，你可以写出更安全、更易维护的代码。

记住：**类型是开发时的工具，不会增加运行时开销**。
