# 奇妙人格档案 · JOJO Personality Archive

> **非官方粉丝企划，仅供趣味测试，非商用。** Unofficial fan project for entertainment only — not affiliated with JoJo rights holders; not for commercial use.

一个无需后端、无需构建的中文 JOJO 同人人格趣味测试。使用原生 HTML、CSS、JavaScript；完整解压后即可在桌面浏览器中打开 `index.html`。

> **当前为完整配图预览包。** 保留原设计与已打包角色配图；v1.1 起另有新增角色以首字占位呈现。项目原创代码采用 MIT；官方／漫画图片、角色及其他第三方权利不受 MIT 授权。现有记录未验证这些图片的再分发许可。公开仓库、公开部署或商业使用前，应先确认素材权利，或采用不含第三方图片的独立开源版。署名与非商业用途不等于授权。

## 功能

- 开始前多选「你看过哪些 JOJO 作品」（第 1—9 部／OVA／游戏／番外，或几乎没看过）；熟悉部数角色在接近时轻微优先。
- 36 道程度题（7 点同意—不认同量表）、9 个倾向维度、53 位第 1—9 部代表角色（含花京院、福葛、特里休、阿纳苏、恩波里欧、史特雷海姆等扩充）。
- 首页、角色图鉴、按部数筛选、姓名／性格搜索、角色详情、测试结果与雷达图。
- 固定规则评分：相同答案产生相同结果；平分按角色 ID 排序。
- 答案与作品勾选仅保存在当前浏览器 `localStorage`，支持继续答题、回看修改、清除记录。
- 响应式布局、键盘可操作控件、图片替代文本；无登录、无分析追踪、无 API 密钥。

**不是心理诊断或经过心理测量学验证的量表。** 角色匹配不代表道德评价，也不代表认同角色的全部行为。

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
