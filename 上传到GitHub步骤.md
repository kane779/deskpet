# 把 DeskPet 传到 GitHub（完全新手版）

这份说明假设你**完全没有用过 GitHub 的命令行**。照着做就行，全程只有点击和复制粘贴。

要上传的文件夹：`D:\WorkBuddyDocuments\Creative\deskpet`

---

## ⭐ 你现在的情况：只差最后一步

前面所有准备工作**都已经做完了**，你不需要再看下面的方式一、方式二：

| 步骤 | 状态 |
|---|---|
| 本地代码写好、能运行、能打包 | ✅ 已完成 |
| 本地 Git 仓库初始化 | ✅ 已完成 |
| 6 次提交（每个改动一次记录） | ✅ 已完成 |
| 远程地址指向 `https://github.com/kane779/deskpet.git` | ✅ 已配置 |
| 在 GitHub 上建好空仓库 | ✅ 已完成 |
| **把代码推送上去** | ⬅ **只差这一步** |

### 你要做的：双击一个文件

打开文件夹 `D:\WorkBuddyDocuments\Creative`，双击 👉 **`push-to-github.bat`**

会弹出一个黑色窗口，自动开始推送。过程中可能发生两件事：

1. **弹出 GitHub 登录/授权窗口** → 用 `kane779` 登录，点绿色的 **Authorize / 授权** 按钮
2. **什么都不弹，直接滚动出一堆文字** → 说明凭据已经记住了，正常

看到窗口里出现 **`SUCCESS`** 字样就是成功了，浏览器会自动打开你的仓库。然后按任意键关闭窗口。

> **如果出现 `FAILED`**：把黑窗口截图发给助手，会告诉你哪里出了问题。另外，这个脚本可以**反复运行**，多试几次不会有副作用。

### 推送成功后干什么

1. 刷新 https://github.com/kane779/deskpet ——代码和 6 条提交记录都在了
2. 点顶部 **Actions** 标签，会看到一条自动运行的构建任务（黄色圆点）
3. 等 **5–10 分钟**变成 **绿色对勾**，点进去拉到底部 **Artifacts**，即可下载：
   - `DeskPet-Windows` → Windows 安装包
   - `DeskPet-macOS` → Mac 安装包（**你的电脑造不出来，GitHub 免费帮你造**）
4. 想正式分享给别人下载（让对方**不用登录 GitHub** 也能下），再双击一次 `publish-release.bat`，详见本文档后面的「怎么正式发布给别人下载」

---

## 以下为备用方案（当前用不到，将来换电脑或重装时可以看）

---

## 先说一件重要的事

项目里有两个**以点开头**的东西：

- `.gitignore`（文件）
- `.github`（文件夹，里面放着自动打包配置）

**用 GitHub 网页「Upload files」拖拽上传时，这两样会被自动跳过**，导致自动打包功能失效。

所以下面推荐用 **GitHub Desktop** 或者**命令行**，它们不会漏文件。

---

## 方式一：GitHub Desktop 图形客户端（推荐）

### 第 1 步：下载并安装

打开 https://desktop.github.com/ ，点 Download，装好后打开。

### 第 2 步：登录你的 GitHub 账号

第一次打开会让你登录，点 **Sign in to GitHub.com**，浏览器会自动打开，点授权即可。

### 第 3 步：把项目文件夹加进来

菜单栏 → **File** → **Add local repository...**

- Local path 点 **Choose...**，选中 `D:\WorkBuddyDocuments\Creative\deskpet`
- 如果它提示「这不是一个 Git 仓库，是否要创建」，点 **create a repository**（创建仓库）
- 弹窗里 Name 填 `deskpet`，其余保持默认，点 **Create repository**

### 第 4 步：提交（Commit）

左侧会列出所有文件，底部两个输入框：

- Summary 填：`首次提交`
- Description 不用填

点左下角蓝色的 **Commit to main**。

### 第 5 步：发布到 GitHub

顶部会出现 **Publish repository** 按钮，点它。

- Name 填 `deskpet`
- **把「Keep this code private」的勾去掉**（你说了要给别人用，所以要公开）
- 点 **Publish repository**

等几十秒，代码就上去了。点顶部的 **View on GitHub** 就能在浏览器里看到你的仓库。

### 第 6 步：等 GitHub 自动帮你打包

1. 在仓库页面点顶部 **Actions** 标签
2. 会看到一条正在运行的任务（黄色圆点在转），等它变成**绿色对勾**（大约 5–10 分钟）
3. 点进这条任务，页面拉到底部 **Artifacts** 区域
4. 下载 `DeskPet-Windows`（Windows 安装包）和 `DeskPet-macOS`（Mac 安装包）

打包是 GitHub 免费提供的云电脑在干活，**你自己的电脑不用装任何开发环境**。

---

## 方式二：用命令行（你的电脑已经装好 Git 了）

先在网页上建一个空仓库：

1. 打开 https://github.com/new
2. Repository name 填 `deskpet`
3. 选 **Public**（公开）
4. **不要**勾选 "Add a README file"
5. 点 **Create repository**

然后打开 **Git Bash**（开始菜单搜「Git Bash」），把下面这段**整段复制粘贴**进去，回车：

```bash
cd "D:/WorkBuddyDocuments/Creative/deskpet"
git init
git add .
git commit -m "首次提交"
git branch -M main
git remote add origin https://github.com/你的GitHub用户名/deskpet.git
git push -u origin main
```

⚠️ 把 `你的GitHub用户名` 换成你真实的用户名，比如 `git remote add origin https://github.com/zhangsan/deskpet.git`

执行 `git push` 时会弹出一个窗口让你登录 GitHub，点授权就行。之后代码就上去了。

---

## 怎么正式发布给别人下载（重要）

`Artifacts` 必须**登录 GitHub 才能下载**，不方便分享给朋友。要让任何人都能直接下载，需要建一个 **Release**（发布页）。

### 推荐：双击一个脚本，全自动完成

打开文件夹 `D:\WorkBuddyDocuments\Creative`，双击 👉 **`publish-release.bat`**

1. 黑窗口会问你版本号，**直接按回车**即可（默认 `v1.0.0`）
2. 它会自动依次做三件事：推送最新代码 → 打上版本标签 → 推送标签
3. GitHub 收到标签后会自动开始打包（Windows + macOS），**打包完成后自动创建发布页**

等 5–10 分钟，打开 👉 https://github.com/kane779/deskpet/releases

就能看到下载页了。**把这个链接发给别人，对方不需要 GitHub 账号就能直接下载。**

> **以后出新版本**：改完代码提交后，再双击一次这个脚本，版本号填一个**新的**数字（`v1.0.1`、`v1.0.2`、`v1.1.0`……）。
>
> ⚠️ **每个版本号只能用一次**，重复用会报错（Git 的标签不允许重复）。

### 手动方式（网页操作，备用）

1. 在仓库页面点右侧的 **Releases** → **Draft a new release**
2. **Choose a tag** 里输入版本号，比如 `v1.0.1`，点 **Create new tag**
3. Release title 填 `DeskPet v1.0.1`
4. 点 **Publish release**（此时发布页是空的，只有说明文字）

然后等几分钟，GitHub 会自动把打包好的安装包**补传**到你这个发布页上。刷新页面就能看到 `.exe` 和 `.dmg` 文件了。

> 也就是说：**打标签这个动作本身就是"发布指令"**，剩下的编译和上传都由 GitHub 代劳。

---


## 以后改了代码想更新上去

**GitHub Desktop**：改完文件 → 左边会出现改动列表 → Summary 填一句话 → 点 **Commit to main** → 点顶部 **Push origin**。

**命令行**：

```bash
cd "D:/WorkBuddyDocuments/Creative/deskpet"
git add .
git commit -m "改了什么，写一句话"
git push
```

推送后 GitHub 会自动重新打包一次，Actions 里会出现新的构建记录。

---

## 检查清单：上传前确认

- [ ] `node_modules` 文件夹**没有**被传上去（它有好几百 MB，`.gitignore` 已经帮你排除了）
- [ ] `dist` 文件夹**没有**被传上去（那是本地打包的产物）
- [ ] `.gitignore` 和 `.github` 都传上去了
- [ ] 仓库是 **Public**（否则别人看不到）

如果发现自己不小心把 `node_modules` 传上去了，在 GitHub Desktop 里删除该文件夹的提交并重新 Push，或者在网页上进入该文件夹逐个删除。
