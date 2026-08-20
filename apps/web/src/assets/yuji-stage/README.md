# Yuji stage assets

`yuji-inflated.glb` 是为雨迹首页原创绘制并生成的圆角充气字标。它由仓库脚本
`apps/web/scripts/generate-yuji-inflated-wordmark.mjs` 使用自有连续圆管手写路径生成，
不包含 Haoqi 的 `hello.gltf`、贴纸、纹理或其他第三方站点资产。

重新生成：

```bash
node apps/web/scripts/generate-yuji-inflated-wordmark.mjs
```

也可以把目标路径作为首个参数传入，用于先在临时目录生成并检查体积或内容。
