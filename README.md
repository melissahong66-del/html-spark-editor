# HTML 可视化编辑器 MVP

一个基于 React、TypeScript、Vite、interact.js 和 iframe 的纯浏览器端静态 HTML 可视化编辑器。

## 启动

```bash
npm install
npm run dev
```

生产构建与类型检查：

```bash
npm run typecheck
npm run build
```

## 已支持

- 导入本地 `.html` / `.htm` 文件并在隔离 iframe 中预览
- 移除脚本、内联事件、嵌套 iframe 等危险内容
- 元素悬停与选择
- 元素自由拖动、八方向缩放、Shift/图片宽高比锁定
- 常见文字元素双击直接编辑
- 位置、尺寸、文字、背景、边框和间距属性编辑
- 复制/粘贴、删除、z-index 上下移动及键盘微调
- 最多 50 个状态的撤销与重做
- 导出清理过编辑器临时标记的完整 HTML

## 当前限制

- 仅面向普通静态 HTML、原生 CSS、内联 CSS 与 `<style>`。
- JavaScript 会在导入时移除，依赖脚本的交互不会保留。
- 本地相对图片、字体和其他相对资源不保证能够加载，也不会自动打包。
- 不支持 React、Vue、Next.js、需要构建的 Tailwind 项目或复杂 Web 应用。
- 浏览器会规范化导入的 HTML，无法保证导出文件与原文件逐字节一致。
- 复杂 transform、SVG、表格及特殊定位上下文中的拖放效果可能受原页面 CSS 影响。
