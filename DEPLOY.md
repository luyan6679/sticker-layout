# 部署说明

## 1. 创建 GitHub 仓库

建议仓库名：

`sticker-layout`

仓库可设为 Public；如果希望源码暂时不公开，也可以先用 Private。

## 2. 上传仓库文件

把本目录中的文件全部上传到 GitHub 仓库根目录。

## 3. Cloudflare Pages

登录 Cloudflare 后：

1. Workers & Pages
2. 创建应用 / Create application
3. 选择 Pages
4. Connect to Git
5. 选择 GitHub
6. 选择 `sticker-layout`
7. Framework preset 选择 `None`
8. Build command 留空
9. Build output directory 使用仓库根目录
10. Deploy

完成后会获得类似：

`https://sticker-layout.pages.dev`

## 4. 后续更新

以后每次修改网站，只要把新文件提交到 GitHub 的 `main` 分支，Cloudflare Pages 就会自动重新部署，网址保持不变。
