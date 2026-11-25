# V1.9 部署与升级

保持已有流程：GitHub `luyan6679/sticker-layout` 的 `main` 分支 → Vercel 自动部署 → `https://sticker.paperlabs.cn`。

1. 先保留 V1.8 的 ZIP 作为回退备份。
2. 解压 V1.9，直接将**压缩包内的文件和 `modules/` 整个文件夹**上传到 GitHub 仓库根目录，覆盖同名文件：
   - `index.html`、`styles.css`、`app.js`
   - `modules/paper.js`、`modules/layout.js`、`modules/preview.js`、`modules/pdf.js`
   - `README.md`、`DEPLOY.md`、`tests/layout.test.mjs`（文档与测试可选）
3. 确认 `index.html` 与 `modules/` 在同一层级；**不要只上传三份旧文件**，否则页面会因缺少模块而无法运行。
4. GitHub 选择 `Commit directly to main`，提交说明建议：`Update to V1.9 - modular workspace`。
5. Vercel `Deployments` 出现最新一条 `Ready` 后，打开 `sticker.paperlabs.cn`，做纸张切换、批量删除、PDF 导出测试。

如果不想上传测试目录，完全可以去掉 `tests/`，运行站点只需要 HTML/CSS/JS 文件与 `modules/`。

**无后端、无 npm 构建、无付费 CDN 依赖。** Vercel 的 Framework Preset 保持 `Other`，Root Directory 保持 `./`；Build Command 保持不覆盖默认值。
