# BetDogEye

BetDogEye 是一个本地优先的投注组合分析前端应用，用于记录体育彩票输赢盘下注、测算收益风险、挖掘赛前情报风险因子，并基于资金管理逻辑生成策略建议。项目默认不依赖 Node.js 或 npm，使用 Python 即可在本机启动。

> 理性使用：本项目只提供记录、测算和风险提示，不保证盈利，不提供比分预测，也不构成投资、博彩或法律建议。

## 功能概览

- 下注台账：记录比赛、投注方向、玩法、下注金额、最高可中金额、实际支出、实际收入、状态、主观胜率、相关性分组和备注。
- 收益测算：自动计算隐含赔率、隐含胜率、风险调整胜率、期望收益、ROI、潜在利润、已实现盈亏和分数 Kelly 建议仓位。
- 组合风控：按预算、止损线、单场上限、组合最大风险暴露和风险偏好给出资金纪律提示。
- 对冲建议：根据参考对冲赔率估算保护仓位、盈亏均衡仓位，并提示何时应暂停加仓或降风险。
- 风险因子挖掘：本地规则识别伤病、停赛、更衣室不合、赛程体能、轮换战术、战意压力和赔率市场异常。
- DeepSeek AI 分析：通过本地 Python 代理调用 DeepSeek Chat Completions API，提取更结构化的风险因子、爆冷风险分和策略建议。
- 网络情报刷新：查询公开新闻 RSS，将来源标题、摘要、发布时间和链接交给 DeepSeek 归纳为可继续分析的情报文本。
- 可视化仪表盘：现金流曲线、状态环图、比赛敞口条形图、EV-风险矩阵、风险雷达、KPI 卡片。
- 数据管理：浏览器本地 `localStorage` 持久化，支持 JSON 备份导入/导出和 CSV 明细导出。
- PWA 支持：内置 Service Worker 缓存静态资源，适配桌面和移动端浏览器。

## 技术栈

- 前端：原生 HTML、CSS、JavaScript
- 图表：原生 SVG 和 DOM 渲染，无第三方图表库
- 本地服务：Python `http.server` 扩展
- AI 接口：DeepSeek OpenAI-compatible Chat Completions API
- 数据存储：浏览器 `localStorage` + 本地 `.env.local` 密钥文件

## 目录结构

```text
.
├── index.html              # 应用页面结构
├── styles.css              # 响应式 UI 与可视化样式
├── app.js                  # 状态管理、收益计算、图表渲染、DeepSeek 前端调用
├── server.py               # 静态文件服务 + DeepSeek 本地代理
├── service-worker.js       # PWA 缓存
├── manifest.webmanifest    # PWA manifest
├── .env.example            # 环境变量示例，不包含真实密钥
├── .gitignore              # 忽略密钥、日志、缓存和构建产物
└── README.md
```

## 快速启动

要求：

- Python 3.10 或更高版本
- 现代浏览器

启动：

```powershell
cd path\to\betdogeye
python server.py --port 4173
```

打开：

```text
http://127.0.0.1:4173
```

如果端口被占用，可以换端口：

```powershell
python server.py --port 4174
```

然后访问：

```text
http://127.0.0.1:4174
```

## DeepSeek 配置

项目不会把 API Key 写入前端代码。浏览器只请求本机 `/api/deepseek/risk`，由 `server.py` 在本机读取密钥后转发到 DeepSeek。

### 方法一：在页面中配置

1. 启动本地服务。
2. 打开「风险情报」页。
3. 在 DeepSeek API 区域输入 API Key。
4. Base URL 使用：

```text
https://api.deepseek.com
```

5. 模型默认：

```text
deepseek-chat
```

6. 点击「保存密钥到本机」。

保存后，密钥会写入 `.env.local`。该文件已被 `.gitignore` 忽略，不应提交到仓库。

### 方法二：手动创建 `.env.local`

```powershell
Copy-Item .env.example .env.local
```

编辑 `.env.local`：

```text
DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

重启服务后生效。

## 使用流程

### 1. 设置资金参数

进入「策略建议」页，配置：

- 总预算
- 单场上限百分比
- 止损线
- 对冲参考赔率
- 风险偏好
- 最大组合风险暴露百分比

这些参数会影响仓位建议、止损提示和对冲提醒。

### 2. 新增下注记录

进入「下注记录」页，填写：

- 比赛名称
- 比赛日期
- 投注选择
- 玩法
- 下注金额
- 最高可中金额
- 实际支出
- 实际收入
- 主观胜率
- 状态
- 相关性分组
- 备注

保存后，仪表盘会自动刷新组合收益、风险和图表。

### 3. 粘贴赛前情报

进入「风险情报」页，选择关联比赛，粘贴新闻、伤停、阵容、赔率变化、舆情或更衣室信息。

点击「挖掘风险因子」会使用本地规则引擎分析，不需要联网。

点击「刷新网络情报」会执行：

1. 根据当前比赛、投注方向和输入框里的补充关键词搜索公开新闻 RSS。
2. 抽取新闻标题、摘要、发布时间和链接。
3. 调用 DeepSeek 将搜索结果归纳为一段赛前情报文本。
4. 自动填入情报文本框，并在右侧展示引用来源。

刷新后可以继续点击「挖掘风险因子」或「DeepSeek 分析」。

点击「DeepSeek 分析」会通过本地代理调用 DeepSeek，返回：

- AI 摘要
- 爆冷风险分
- 概率调整建议
- 对冲触发条件
- 风险因子证据
- 资金管理建议

### 4. 查看策略建议

进入「策略建议」页查看系统生成的操作建议，包括：

- 是否暂停新增投注
- 是否单场仓位过重
- 是否负期望值
- 是否触及止损线
- 是否需要对冲观察
- 分数 Kelly 建议仓位

### 5. 导入导出数据

页面右上角支持：

- JSON 导出：备份完整本地状态
- JSON 导入：恢复历史备份
- CSV 导出：导出下注明细表

## 关键算法说明

### 期望收益

系统使用风险调整后的主观胜率计算单条投注的期望收益：

```text
EV = 调整后胜率 * 最高可中金额 - 实际支出
```

### 分数 Kelly

系统基于赔率和风险调整胜率计算 Kelly 仓位，再按风险偏好缩放，避免给出过激仓位：

```text
kelly = ((odds - 1) * p - (1 - p)) / (odds - 1)
suggestedStake = bankroll * max(kelly, 0) * profileScale
```

### 风险因子

本地规则引擎按关键词和严重程度给风险加权，DeepSeek 分析结果会作为额外风险信号叠加到比赛风险分中。

## 隐私与安全

- 投注记录默认只保存在当前浏览器的 `localStorage`。
- `.env.local` 保存 API Key，并已被 `.gitignore` 忽略。
- 前端代码不包含真实 API Key。
- DeepSeek 分析只发送当前输入的情报文本、已选比赛、投注方向和组合摘要。
- 网络情报刷新会向公开新闻/RSS 服务发送比赛名、投注方向和补充关键词。
- 网络情报刷新会把新闻搜索结果的标题、摘要、链接和发布时间发送给 DeepSeek 归纳。
- 不会上传完整 JSON 备份文件。
- 发布到 GitHub 前请再次确认没有提交 `.env.local`、日志文件或浏览器导出的个人备份。

## 开源发布前检查

建议执行：

```powershell
git status --short
```

确认不包含：

```text
.env.local
server.log
server.err.log
```

也可以检查密钥形态：

```powershell
Select-String -Path *.js,*.py,*.html,*.css,*.md,.env.example -Pattern "sk-[A-Za-z0-9_-]{12,}"
```

正常情况下不应返回真实密钥。

## 常见问题

### 页面显示 DeepSeek 代理未启动

请确认使用的是：

```powershell
python server.py --port 4173
```

而不是：

```powershell
python -m http.server 4173
```

后者只能提供静态页面，不能提供 `/api/deepseek/*` 代理。

### DeepSeek 返回认证失败

检查 `.env.local` 中的 API Key 是否有效，并重启服务。不要把真实 Key 提交到 GitHub。

### 更换模型

修改 `.env.local`：

```text
DEEPSEEK_MODEL=deepseek-chat
```

或在页面 DeepSeek 配置区域修改模型并保存。

## License

MIT License. See [LICENSE](LICENSE).
