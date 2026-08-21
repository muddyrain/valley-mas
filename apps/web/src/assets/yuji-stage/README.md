# Yuji stage assets

`muddyrain-inflated.glb` 是为雨迹首页生成的圆角充气个人签名；站点品牌仍是
“雨迹 / YUJI”，该模型只替换首屏中央签名字样。仓库脚本
`apps/web/scripts/generate-yuji-inflated-wordmark.mjs` 使用 Three.js 示例字体中的
Optimer Bold 轮廓生成，按舞台宽度归一化并添加自有的 3D 深度与圆角参数；字体许可见
`MGOPEN-FONT-LICENSE.txt`。它不包含 Haoqi 的 `hello.gltf`、贴纸、纹理或其他第三方站点资产。

重新生成：

```bash
node apps/web/scripts/generate-yuji-inflated-wordmark.mjs
```

也可以把目标路径作为首个参数传入，用于先在临时目录生成并检查体积或内容。
