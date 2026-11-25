# V2.0 GitHub / Vercel 更新说明

适用于已配置的 GitHub `luyan6679/sticker-layout` 与 Vercel `sticker.paperlabs.cn`。

1. 备份原来的 V1.9 ZIP 或 GitHub 提交，方便回滚。
2. 解压本包。确保同时存在 `index.html`、`styles.css`、`app.js`、`css/`、`modules/` 等文件和文件夹。
3. 打开 GitHub 仓库，选择 `main`，进入 `Add file → Upload files`。把解压后所有根目录文件、`css` 文件夹、`modules` 文件夹拖入上传区。**不要上传整个 ZIP**；不要漏掉 `css/canvas-shell.css` 和 `modules/shell.js`。
4. 提交消息填写 `Update to V2.0 - canvas first UI`，选择 `Commit directly to the main branch`。
5. 在 Vercel `Deployments` 查看新部署变成 `Ready`。网站访问地址仍为 `https://sticker.paperlabs.cn`。
6. 安卓手机使用无代理的厂商浏览器打开，测试添加图片、素材抽屉、设置、点选贴纸、编辑、导出 PDF 和文件保存。

若 GitHub 浏览器不能拖拽，可尝试 Edge 或网页的 `choose your files`（仅文件，保留子目录需要在 GitHub 对应路径下分别上传）。

注意：V2.0 没有引入第三方 CDN、数据库或后端，原有 GitHub → Vercel 自动部署不变。
