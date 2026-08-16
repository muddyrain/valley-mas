# 使用 Three.js shader 渲染液态雨膜

首页沿用现有 GSAP ScrollTrigger 驱动原生滚动时间轴，并为 `apps/web` 新增 `three`，使用单一全屏画布与自定义 `ShaderMaterial` 渲染液态雨膜、膜下影像折射和局部指针压痕。CSS/SVG 位移无法稳定达到所需材质触感，裸 WebGL 又会把纹理、尺寸、上下文丢失和资源回收成本留给业务代码；因此本项目只引入 Three 处理渲染生命周期，不同时引入 React Three Fiber、Lenis 或额外后处理框架，并以单屏技术样片通过视觉与性能验证作为完整三幕首页的实施前置条件。
