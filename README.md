# HTML Spark Editor

[简体中文](README.md) | [English](README_EN.md)

一个像 PowerPoint 一样操作的浏览器端 HTML 可视化编辑器。

无需安装软件，也不需要后端。导入已有的静态 HTML 文件后，可以直接修改文字、样式、位置和尺寸，最后重新导出完整 HTML。

## 在线使用

- Cloudflare（国内访问更友好）：[https://html-spark-editor.pages.dev/](https://html-spark-editor.pages.dev/)
- Vercel（备用地址）：[https://html-spark-editor.vercel.app/](https://html-spark-editor.vercel.app/)

## 使用方法

1. 点击“导入 HTML”，选择本地 `.html` 或 `.htm` 文件。
2. 点击页面中的文字或元素进行选择。
3. 再次点击文字或按 `Enter` / `F2` 进入文字编辑。
4. 使用右侧工具栏修改字体、字号、颜色、背景和文字格式。
5. 拖动元素改变位置，拖动蓝框控制点调整尺寸。
6. 点击“导出 HTML”，下载修改后的文件。

## 主要功能

- 导入和预览现有静态 HTML
- 点击选择、拖动和八方向缩放元素
- 直接编辑页面文字
- 修改字体、字号、颜色和文字背景色
- 粗体、斜体、下划线和大小写转换
- 对选中的几个字单独设置格式
- 有序列表、项目符号和回车自动续号
- 批量查找与替换，支持中英文混合文字和跨样式标签查找
- 最近使用颜色和常用标准色
- 智能参考线、边缘对齐和自动吸附
- 选择并移动外层布局区域
- 复制、粘贴、删除和调整层级
- 键盘方向键微调位置
- 撤销和重做，最多保存 50 个状态
- 导出前检查失效图片、空链接、乱码和超出画布的元素
- 导出完整 HTML，并清除编辑器临时标记

## 脚本与安全

为了防止导入的页面影响编辑器，原页面脚本在编辑过程中不会运行，链接跳转、表单提交和按钮原有行为也会被阻止。

导出时会恢复原 HTML 中保留的脚本，因此原页面的动画、轮播、菜单等功能仍有机会继续工作。请只导入和打开自己信任的 HTML 文件。

## 本地运行

需要安装 Node.js，然后执行：

```bash
npm install
npm run dev
```

浏览器打开终端中显示的本地地址，通常是：

```text
http://localhost:5173/
```

类型检查和生产构建：

```bash
npm run typecheck
npm run build
```

## 技术栈

- React
- TypeScript
- Vite
- interact.js
- iframe 与原生 DOM API

项目完全运行在浏览器中，不使用后端、数据库或 AI 服务。

## 当前限制

- 主要支持静态 HTML、原生 CSS、内联样式和 `<style>`。
- 不支持直接导入 React、Vue、Next.js 或需要构建的项目源码。
- 本地相对图片、字体和其他资源不会自动打包，预览时可能无法加载。
- 网络资源仍依赖网络连接和资源提供方的访问策略。
- 复杂 JavaScript 应用、SVG、表格、CSS transform 和特殊定位布局可能无法完全保持原始效果。
- 浏览器会规范化部分 HTML，导出结果不保证与原文件逐字节一致。

## 部署

执行 `npm run build` 后，将生成的 `dist` 文件夹部署到 Cloudflare Pages、Vercel、Netlify 或其他静态网站托管平台即可。
