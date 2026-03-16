---
title: 深入理解 Async/Await
date: 2024-02-20
tags: ["JavaScript", "异步编程", "前端"]
category: 技术
cover: https://picsum.photos/seed/async/800/400
---

# 深入理解 Async/Await

JavaScript 的异步编程一直是开发者需要掌握的重要概念。从回调函数到 Promise，再到 Async/Await，异步编程的写法越来越优雅。

## 异步编程的演进

### 1. 回调函数时代

```javascript
getData(function(a) {
  getMoreData(a, function(b) {
    getMoreData(b, function(c) {
      console.log(c);
    });
  });
});
```

这就是著名的"回调地狱"（Callback Hell）。

### 2. Promise 时代

```javascript
getData()
  .then(a => getMoreData(a))
  .then(b => getMoreData(b))
  .then(c => console.log(c))
  .catch(error => console.error(error));
```

Promise 解决了回调地狱的问题，但链式调用在复杂场景下仍然不够直观。

### 3. Async/Await 时代

```javascript
async function fetchData() {
  try {
    const a = await getData();
    const b = await getMoreData(a);
    const c = await getMoreData(b);
    console.log(c);
  } catch (error) {
    console.error(error);
  }
}
```

代码看起来像同步的，但执行是异步的！

## Async/Await 基础

### async 函数

```javascript
async function myFunction() {
  return "Hello";
}

// 等价于
function myFunction() {
  return Promise.resolve("Hello");
}
```

`async` 函数总是返回一个 Promise。

### await 关键字

```javascript
async function getUser() {
  const response = await fetch('/api/user');
  const user = await response.json();
  return user;
}
```

`await` 只能在 `async` 函数内部使用，它会暂停函数执行，直到 Promise 完成。

## 实际应用

### 并行执行

```javascript
async function fetchMultiple() {
  // 顺序执行（慢）
  const user = await fetchUser();
  const posts = await fetchPosts();
  const comments = await fetchComments();

  // 并行执行（快）
  const [user, posts, comments] = await Promise.all([
    fetchUser(),
    fetchPosts(),
    fetchComments()
  ]);
}
```

### 错误处理

```javascript
async function fetchData() {
  try {
    const data = await fetch('/api/data');
    return data;
  } catch (error) {
    console.error('获取数据失败:', error);
    throw error;
  }
}

// 或者使用 .catch()
fetchData().catch(error => {
  console.error('处理错误:', error);
});
```

## 常见陷阱

### 1. 忘记 await

```javascript
async function badExample() {
  const user = fetchUser(); // 忘记 await
  console.log(user); // 输出: Promise {<pending>}
}
```

### 2. 在普通函数中使用 await

```javascript
function regularFunction() {
  const data = await fetchData(); // ❌ Syntax Error
}
```

### 3. 不必要的 async

```javascript
// 不需要 async
async function getNumber() {
  return 42;
}

// 直接返回
function getNumber() {
  return Promise.resolve(42);
}
```

## 最佳实践

1. **始终处理错误** - 使用 try/catch 或 .catch()
2. **并行执行独立请求** - 使用 Promise.all()
3. **避免不必要的 async** - 如果函数不执行异步操作，不需要 async
4. **使用工具函数** - 封装常用的异步操作

## 总结

Async/Await 让异步代码更易读、更易维护。它是现代 JavaScript 异步编程的标准方式。

掌握它，你的代码质量会有质的提升！
