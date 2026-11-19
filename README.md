# 落假情 · 蓝调氛围个人主页

一个纯静态的单页个人主页 —— 深蓝夜色、黑胶唱片、均衡器，没有框架也没有构建步骤。

## 在线访问

- 个人主页：https://luojiaqing.github.io/luojiaqing-personal-site/
- MLP / 105 学习参数实验室：https://luojiaqing.github.io/luojiaqing-personal-site/mlp/

## 目录结构

```
index.html          个人主页（单文件，CSS/JS 内联）
mlp/                MLP / 105 学习参数实验室（独立子站，相对路径，可直接静态托管）
  index.html
  styles.css
  app.js
  data.js
  assets/           训练结果图片与 favicon
  downloads/        6 页图解 PDF + NumPy 源码
```

`mlp/` 是从本地 `http://127.0.0.1:4173/` 那套「MLP / 105 · 学习参数实验室」原样迁入的，
只补了一条返回个人主页的页脚链接，其余引用都是相对路径，放在任何子目录下都能直接运行。

## 本地预览

直接双击 `index.html`，或在目录内启动任意静态服务器：

```bash
python -m http.server 8080
```

## 说明

- 单文件：`index.html`，CSS 与 JS 内联，零依赖、零外部请求
- 响应式：桌面 / 平板 / 手机三档断点
- 无障碍：支持 `prefers-reduced-motion`，主要交互区带 `aria` 标注
- 托管：GitHub Pages（`main` 分支根目录）

---

© 落假情
