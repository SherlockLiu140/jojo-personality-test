# 奇妙人格档案 · JOJO Personality Archive

> **非官方粉丝企划，仅供趣味测试，非商用。** Unofficial fan project for entertainment only — not affiliated with JoJo rights holders; not for commercial use.

一个无需后端、无需构建的中文 JOJO 同人人格趣味测试。使用原生 HTML、CSS、JavaScript；完整解压后即可在桌面浏览器中打开 `index.html`。

> **GitHub Pages 版 1.6。** 保留仓库已发布的 45 张角色配图；其余角色使用部数配色与首字占位，本次未上传新第三方图。角色资料与测试覆盖全 126 个角色及形态。第三方素材权利不在 MIT 授权范围内。

## 功能

- 9 题剧情快测，答完可选填看过的部数或直接出结果；36 题剧情完整版，保留作品选择。两套进度分别保存在当前浏览器。
- 题目先交代虫箭、时停等设定，再在两种做法间给出七档倾向，不考剧情记忆。
- 四个维度：勇气与风险、正义与原则、思考与应变、情感与羁绊。完整版各 9 题；快测配比 3／2／2／2。
- 支持角色图鉴、部数筛选、搜索、角色详情、结果雷达图。旧版答题记录可在同一浏览器单独查看，不按新题重算。
- 原生静态页面，无登录、追踪、后端或 API 密钥。非官方趣味测试，不作心理诊断。

## 本地运行

### 方法一：直接打开

完整解压后，双击根目录 `index.html`。不要在 ZIP 内打开，也不要只复制 HTML；需要保留 JS、CSS 与 `assets/` 的相对路径。手机文件预览器可能不执行脚本，可使用静态站点访问。

### 方法二：本地静态服务器

在项目目录运行（需 Python 3）：

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

然后访问 `http://localhost:8080`。仅用于本机预览，不是公开部署。

## 部署

这是**纯静态网站**。不需要 Node 服务、数据库、登录系统、环境变量或构建命令。发布目录就是项目根目录，入口为 `index.html`；路由使用 `#/atlas` 等 hash，不需要服务端重写。完整部署说明及可交给 WorkBuddy 的任务见 [DEPLOYMENT.md](DEPLOYMENT.md)。

仓库开源与网站上线是两件不同的事：将源码提交到 GitHub 不会自动授权素材，也不等于已开启公开网站。

## 目录

```text
index.html                  页面入口
styles.css                  原有视觉与响应式样式
app.js                      交互、页面与本地进度
engine.js                   可独立测试的确定性评分逻辑
data.json                   题目、维度、角色画像的编辑源
data.js                     与 data.json 同步的浏览器数据
art.js                      浏览器图片与来源清单
assets/characters/          图片、缩略图、manifest.json、权利说明
tests/                      无第三方依赖的 Node 测试
scripts/sync-data.js         从 JSON 同步浏览器数据
LICENSE                     原创代码的 MIT 文本
THIRD_PARTY_NOTICES.md       授权边界与素材说明
```

## 开发与测试

运行本地自动检查需要 Node.js 20 或以上；**浏览和部署网站不需要 Node.js**。无需 `npm install`。

```bash
npm test
# 修改 data.json 或 assets/characters/manifest.json 后，同步浏览器文件：
npm run sync-data
npm test
```

测试覆盖数据同步、36 题／扩充角色结构、Likert 选项、作品加权、输入校验、评分边界、确定性、平分规则、素材引用以及发布包的基本安全检查。它不替代浏览器人工检查或素材权利审核。

修改后还应在桌面与手机尺寸检查：首页、图鉴筛选和搜索、角色详情、完整答题、刷新继续、上一题、修改答案、结果、重新开始的取消／确认、隐私清除入口和浏览器前进／后退。

## 隐私与许可证

应用不上传答题记录；存储键为 `jojo-personality-archive-v2`（v1.1）。可在「关于测试、隐私与图片来源」清除，也可清除浏览器站点数据。`file://`、本地服务器与正式站点属于不同存储环境，进度不会互通；隐私模式或禁用存储时可能无法保留。

第三方静态托管商仍可能记录常规访问日志；点击素材来源外链后适用目标网站的政策。

原创代码见 [MIT LICENSE](LICENSE)。**MIT 不授予第三方图片、原作、角色形象、名称、商标或标识的权利**。角色文字与向量是同人解读，不是官方设定。完整范围与历史素材清单见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 及 [素材权利记录](assets/characters/RIGHTS.md)。

本项目不隶属于、也未获得荒木飞吕彦、LUCKY LAND COMMUNICATIONS、集英社、相关动画制作委员会或 Bandai Namco Entertainment 的官方背书。
