# GeoJSON 地图数据放置目录

Phase 10 的 GeoJSON 地图源默认从 `/geo/<id>.json` 加载。把对应文件放到本目录下即可：

| 地图源 ID         | 文件名               | 推荐数据来源                                       |
|-------------------|----------------------|----------------------------------------------------|
| `china-province`  | `china-province.json`| 阿里 DataV.GeoAtlas 中国省级行政区                  |
| `china-city`      | `china-city.json`    | 阿里 DataV.GeoAtlas 中国地级行政区                  |
| `world-country`   | `world-country.json` | natural-earth-data 简化版国家边界                  |
| `us-state`        | `us-state.json`      | us-atlas 美国州（topojson 转 GeoJSON）             |

## 数据格式要求

- 顶层必须是 `FeatureCollection`。
- `features[*].geometry.type` 仅支持 `Polygon` / `MultiPolygon`，其他类型会被跳过。
- 推荐携带 `properties.name` 作为 region 名（与 `GEO_MAP_REGISTRY[id].nameProperty` 对应，可在 sources.ts 中改名）。

## 离线/CDN

- 离线运行：把文件放在本目录，`pnpm --filter @valley/world-sim dev` 会从 `http://localhost:5179/geo/*.json` 直接 serve。
- CDN：在 UI 端覆盖 URL（保留扩展位 `loadGeoMap({ url })`），或直接修改 `core/map/sources.ts` 的 `defaultUrl`。

## 隐私 / 版权

数据请自行确认许可。本仓库不内置原始 GeoJSON。
