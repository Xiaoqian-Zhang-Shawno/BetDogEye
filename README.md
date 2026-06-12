# BetDogEye

> 中文 | [English](#english)

BetDogEye 是一个本地优先的体育投注组合分析前端，用于记录胜负类投注、测算收益风险、刷新公开风险情报，并从资金管理角度生成仓位、止损和对冲建议。项目默认使用浏览器本地存储和本地 Python 代理，不会把 API Key 写进前端代码。

理性使用：本项目只提供记录、测算、风险提示和信息整理，不保证盈利，不提供比分预测，也不构成投资、博彩或法律建议。

## 支持作者

如果你觉得有用，请支持一下作者，这样作者会更有动力哦！感谢！

<img src="assets/support-alipay.jpg" alt="支付宝支持作者" width="260" />

## 功能概览

- 下注台账：记录比赛、投注方向、玩法、下注金额、最大可赢金额、实际支出、实际收入、状态、主观胜率、相关性分组和备注。
- 混合过关：支持记录多场串关明细，按各关赔率相乘估算最高可中，按各关胜率相乘估算联合胜率，并提示全中结构性风险。
- 收益测算：自动计算隐含赔率、隐含胜率、风险调整胜率、期望收益、ROI、潜在利润、已实现盈亏和分数 Kelly 建议仓位。
- 组合风控：按预算、止损线、单场上限、组合最大风险暴露和风险偏好给出资金纪律提示。
- 对冲建议：根据参考对冲赔率估算保护仓位、盈亏均衡仓位，并提示何时暂停加仓或降低风险。
- 风险因子挖掘：识别伤病、停赛、更衣室不合、赛程体能、轮换战术、战意压力和赔率市场异常。
- 网络情报刷新：查询公开新闻/RSS，将来源标题、摘要、发布时间和链接交给模型归纳为可继续分析的情报文本。
- 未结算组合刷新：只针对已下注且未结算记录里的球队/国家搜索最新信息，覆盖伤停、政治、金融、场外新闻、更衣室和市场异常因素。
- 通用大模型 API：通过本地 Python 代理调用 OpenAI-compatible Chat Completions API，可接入 DeepSeek、OpenAI/GPT 以及其他兼容服务。
- 可视化仪表盘：现金流曲线、状态环图、比赛敞口条形图、EV-风险矩阵、风险雷达、KPI 卡片。
- 数据管理：浏览器 `localStorage` 持久化，支持 JSON 备份导入/导出和 CSV 明细导出。
- PWA 支持：内置 Service Worker 缓存静态资源，适配桌面和移动端浏览器。

## 技术栈

- 前端：原生 HTML、CSS、JavaScript
- 图表：原生 SVG 和 DOM 渲染，无第三方图表库
- 本地服务：Python `http.server` 扩展
- AI 接口：OpenAI-compatible Chat Completions API
- 数据存储：浏览器 `localStorage` + 本地 `.env.local` 密钥文件

## 目录结构

```text
.
├── assets/
│   └── support-alipay.jpg     # 支持作者二维码图片
├── index.html                 # 应用页面结构
├── styles.css                 # 响应式 UI 与可视化样式
├── app.js                     # 状态管理、收益计算、图表渲染、模型 API 前端调用
├── server.py                  # 静态文件服务 + OpenAI-compatible 本地代理
├── service-worker.js          # PWA 缓存
├── manifest.webmanifest       # PWA manifest
├── .env.example               # 环境变量示例，不包含真实密钥
├── .gitignore                 # 忽略密钥、日志、缓存和构建产物
├── LICENSE
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

## 通用大模型 API 接入教程

BetDogEye 通过本地 `/api/llm/*` 和 `/api/intel/*` 代理调用模型。前端不会直接保存或发送 API Key 到浏览器代码仓库里，真实密钥只应保存在本机 `.env.local`。

只要服务商兼容 OpenAI Chat Completions 风格接口，通常都可以接入。你需要准备：

- API Key
- Base URL
- Model Name
- 可选的 Provider Name，用于页面显示

### 方法一：在页面里配置

1. 启动本地服务。
2. 打开「风险情报」页面。
3. 在「模型 API」区域填写供应商、API Key、Base URL 和模型名。
4. 点击「保存密钥到本机」。
5. 页面会把配置写入 `.env.local`，重启服务后仍可读取。

### 方法二：手动创建 `.env.local`

```powershell
Copy-Item .env.example .env.local
```

编辑 `.env.local`：

```text
LLM_PROVIDER=OpenAI-Compatible
LLM_API_KEY=YOUR_MODEL_API_KEY
LLM_BASE_URL=https://your-provider.example/v1
LLM_MODEL=your-model-name
```

保存后重启服务：

```powershell
python server.py --port 4173
```

### 常见配置示例

DeepSeek 示例：

```text
LLM_PROVIDER=DeepSeek
LLM_API_KEY=YOUR_DEEPSEEK_API_KEY
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
```

OpenAI/GPT 示例：

```text
LLM_PROVIDER=OpenAI
LLM_API_KEY=YOUR_OPENAI_API_KEY
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=YOUR_ENABLED_MODEL_NAME
```

其他兼容服务示例：

```text
LLM_PROVIDER=YourProvider
LLM_API_KEY=YOUR_PROVIDER_API_KEY
LLM_BASE_URL=https://your-provider.example/v1
LLM_MODEL=provider-model-name
```

注意：

- `.env.local` 已被 `.gitignore` 忽略，不要提交到 GitHub。
- 如果服务商不是 OpenAI-compatible Chat Completions 接口，需要先在 `server.py` 中增加适配逻辑。
- Base URL 通常不包含 `/chat/completions`，应用会自动拼接对应路径。
- 如果模型鉴权失败，先检查 API Key、Base URL、模型名和账户可用额度。

## 使用流程

### 1. 设置资金参数

进入「策略建议」页面，配置：

- 总预算
- 单场上限百分比
- 止损线
- 对冲参考赔率
- 风险偏好
- 最大组合风险暴露百分比

这些参数会影响仓位建议、止损提示和对冲提醒。

### 2. 新增下注记录

进入「下注记录」页面，选择投注类型：

- 单关：填写比赛名称、比赛日期、投注选择、玩法、下注金额、最大可赢金额、实际支出、实际收入、主观胜率、状态、相关性分组和备注。
- 混合过关：添加至少两关明细，分别填写每关比赛、玩法、投注选择、单关赔率和单关胜率。系统会自动生成综合赔率、联合胜率和估算最高可中金额。

保存后，仪表盘会自动刷新组合收益、风险和图表。

说明：应用会按“多场全部命中才有奖金”的结构做记录和测算；具体可售过关方式、场次数上限和同场限制仍以中国体育彩票官方销售端规则为准。

### 3. 刷新风险情报

进入「风险情报」页面：

- 「挖掘风险因子」：使用本地规则分析已输入情报，不需要联网。
- 「刷新网络情报」：针对当前选择的比赛搜索公开新闻/RSS，并调用模型归纳情报。
- 「刷新未结算组合」：只读取状态为「未结算」的投注记录，围绕相关球队/国家搜索伤停、政治、金融、场外新闻、更衣室和市场异常因素。
- 「模型分析」：调用已配置模型，输出摘要、爆冷风险、概率调整建议、对冲触发条件、风险证据和资金管理建议。

### 4. 查看策略建议

进入「策略建议」页面查看系统生成的操作建议，包括：

- 是否暂停新增投注
- 是否单场仓位过重
- 是否负期望值
- 是否触及止损线
- 是否需要观察对冲
- 分数 Kelly 建议仓位

### 5. 导入导出数据

页面右上角支持：

- JSON 导出：备份完整本地状态
- JSON 导入：恢复历史备份
- CSV 导出：导出下注明细表

## 关键算法说明

期望收益：

```text
EV = 风险调整后胜率 * 最大可赢金额 - 实际支出
```

分数 Kelly：

```text
kelly = ((odds - 1) * p - (1 - p)) / (odds - 1)
suggestedStake = bankroll * max(kelly, 0) * profileScale
```

风险因子：

本地规则引擎按关键词和严重程度给风险加权。模型分析结果会作为额外风险信号叠加到比赛风险分中。

混合过关：

```text
parlayOdds = odds1 * odds2 * ... * oddsN
jointProbability = p1 * p2 * ... * pN
maxPayout = actualOutflow * parlayOdds
```

因为混合过关需要全部关次命中才有奖金，系统会在情报风险之外叠加关数带来的结构性风险。

## 隐私与安全

- 投注记录默认只保存在当前浏览器的 `localStorage`。
- `.env.local` 保存 API Key，并已被 `.gitignore` 忽略。
- 前端代码不包含真实 API Key。
- 模型分析会发送当前输入的情报文本、已选比赛、投注方向和组合摘要。
- 网络情报刷新会向公开新闻/RSS 服务发送比赛名、投注方向和补充关键词。
- 未结算组合刷新会向公开新闻/RSS 服务发送未结算投注记录中的球队/国家关键词。
- 不会上传完整 JSON 备份文件。
- 发布到 GitHub 前请再次确认没有提交 `.env.local`、日志文件或个人备份数据。

## 开源发布前检查

查看工作区：

```powershell
git status --short
```

确认不包含：

```text
.env.local
server.log
server.err.log
```

检查密钥形态：

```powershell
Select-String -Path *.js,*.py,*.html,*.css,*.md,.env.example -Pattern "sk-[A-Za-z0-9_-]{12,}"
```

正常情况下不应返回真实密钥。

## 常见问题

### 页面显示模型代理未启动

请确认使用的是：

```powershell
python server.py --port 4173
```

而不是：

```powershell
python -m http.server 4173
```

后者只能提供静态页面，不能提供 `/api/llm/*` 和 `/api/intel/*` 代理。

### 模型 API 返回认证失败

检查 `.env.local` 中的 API Key、Base URL 和模型名是否正确，并重启服务。不要把真实 Key 提交到 GitHub。

### 如何更换模型

修改 `.env.local`：

```text
LLM_PROVIDER=YourProvider
LLM_BASE_URL=https://your-provider.example/v1
LLM_MODEL=provider-model-name
```

也可以在页面的「模型 API」配置区域修改并保存。

## License

MIT License. See [LICENSE](LICENSE).

---

## English

BetDogEye is a local-first betting portfolio analysis frontend for win/loss sports bets. It helps you record stakes, estimate return and risk, refresh public risk intelligence, and generate bankroll, stop-loss, and hedging suggestions. The project uses browser local storage and a local Python proxy by default. API keys are never embedded in frontend code.

Responsible use: this project only provides record keeping, calculations, risk reminders, and information organization. It does not guarantee profit, does not predict exact scores, and is not investment, gambling, or legal advice.

## Support The Author

If you find this project useful, please consider supporting the author. Your support helps keep the project moving. Thank you!

<img src="assets/support-alipay.jpg" alt="Support the author via Alipay" width="260" />

## Features

- Bet ledger: record match, pick, market type, stake, max payout, actual expense, actual income, status, subjective win probability, correlation group, and notes.
- Mixed pass / parlay records: track multiple legs, multiply leg odds into combined odds, multiply leg probabilities into joint probability, and flag all-hit structural risk.
- Return analytics: calculate implied odds, implied probability, risk-adjusted probability, expected value, ROI, potential profit, realized PnL, and fractional Kelly stake suggestions.
- Portfolio risk control: generate bankroll discipline warnings from budget, stop-loss line, per-match cap, maximum portfolio exposure, and risk profile.
- Hedging suggestions: estimate protective hedge stake and breakeven hedge stake from a reference hedge odds value.
- Risk factor mining: detect injuries, suspensions, locker-room issues, fatigue, rotation, motivation pressure, and market anomalies.
- Web intelligence refresh: search public news/RSS sources and ask the model to summarize titles, snippets, timestamps, and links into usable pre-match intelligence.
- Open-bet portfolio refresh: search only the teams/countries already present in unsettled bets, including injury, politics, finance, off-field news, locker-room, and market signals.
- Generic LLM API support: connect DeepSeek, OpenAI/GPT, or other OpenAI-compatible Chat Completions providers through the local Python proxy.
- Visual dashboard: cashflow curve, status donut, match exposure bars, EV-risk matrix, risk radar, and KPI cards.
- Data management: browser `localStorage`, JSON backup import/export, and CSV ledger export.
- PWA support: Service Worker caching for desktop and mobile browsers.

## Tech Stack

- Frontend: vanilla HTML, CSS, and JavaScript
- Charts: native SVG and DOM rendering, no third-party chart library
- Local server: extended Python `http.server`
- AI interface: OpenAI-compatible Chat Completions API
- Storage: browser `localStorage` + local `.env.local` secret file

## Project Structure

```text
.
├── assets/
│   └── support-alipay.jpg     # Author support QR image
├── index.html                 # App page structure
├── styles.css                 # Responsive UI and visualization styles
├── app.js                     # State, calculations, charts, model API calls
├── server.py                  # Static server + OpenAI-compatible local proxy
├── service-worker.js          # PWA cache
├── manifest.webmanifest       # PWA manifest
├── .env.example               # Environment variable example, no real secrets
├── .gitignore                 # Ignores secrets, logs, cache, and build output
├── LICENSE
└── README.md
```

## Quick Start

Requirements:

- Python 3.10 or newer
- A modern browser

Start the app:

```powershell
cd path\to\betdogeye
python server.py --port 4173
```

Open:

```text
http://127.0.0.1:4173
```

If the port is already in use:

```powershell
python server.py --port 4174
```

Then open:

```text
http://127.0.0.1:4174
```

## Generic LLM API Integration

BetDogEye calls models through local `/api/llm/*` and `/api/intel/*` proxy endpoints. The frontend does not store real API keys in source code. Secrets should stay in your local `.env.local`.

Any provider that supports an OpenAI-style Chat Completions API can usually be connected. You need:

- API Key
- Base URL
- Model Name
- Optional Provider Name for display

### Option 1: Configure In The App

1. Start the local server.
2. Open the Risk Intelligence page.
3. Fill in provider, API key, base URL, and model name in the Model API panel.
4. Click the save button.
5. The app writes the configuration to `.env.local`.

### Option 2: Create `.env.local` Manually

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local`:

```text
LLM_PROVIDER=OpenAI-Compatible
LLM_API_KEY=YOUR_MODEL_API_KEY
LLM_BASE_URL=https://your-provider.example/v1
LLM_MODEL=your-model-name
```

Restart:

```powershell
python server.py --port 4173
```

### Common Examples

DeepSeek:

```text
LLM_PROVIDER=DeepSeek
LLM_API_KEY=YOUR_DEEPSEEK_API_KEY
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
```

OpenAI/GPT:

```text
LLM_PROVIDER=OpenAI
LLM_API_KEY=YOUR_OPENAI_API_KEY
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=YOUR_ENABLED_MODEL_NAME
```

Other compatible providers:

```text
LLM_PROVIDER=YourProvider
LLM_API_KEY=YOUR_PROVIDER_API_KEY
LLM_BASE_URL=https://your-provider.example/v1
LLM_MODEL=provider-model-name
```

Notes:

- `.env.local` is ignored by `.gitignore`; do not commit it.
- Providers that are not OpenAI-compatible need an adapter in `server.py`.
- The Base URL usually should not include `/chat/completions`; the app appends the path.
- If authentication fails, check API key, Base URL, model name, and account quota.

## Usage Flow

1. Configure bankroll settings on the Strategy page: budget, per-match cap, stop-loss line, hedge reference odds, risk profile, and maximum exposure.
2. Add bet records on the Bet Ledger page. Single bets use the classic fields. Mixed pass records require at least two legs, each with match, market, pick, leg odds, and leg probability.

Note: the app models mixed pass records as all-hit parlays for tracking and analytics. Available pass types, leg limits, and same-match restrictions should still be checked against the official lottery sales rules.
3. Open Risk Intelligence to mine local risk factors, refresh web intelligence, refresh unsettled open-bet intelligence, or run model analysis.
4. Review strategy suggestions such as stop betting, reducing concentration, avoiding negative EV, monitoring hedge triggers, and fractional Kelly stake size.
5. Import/export data with JSON backup and CSV ledger export.

## Core Calculations

Expected value:

```text
EV = riskAdjustedProbability * maxPayout - actualExpense
```

Fractional Kelly:

```text
kelly = ((odds - 1) * p - (1 - p)) / (odds - 1)
suggestedStake = bankroll * max(kelly, 0) * profileScale
```

Risk factors:

The local rule engine scores keyword-based signals by category and severity. Model output can add extra risk evidence to the match risk score.

Mixed pass / parlay:

```text
parlayOdds = odds1 * odds2 * ... * oddsN
jointProbability = p1 * p2 * ... * pN
maxPayout = actualOutflow * parlayOdds
```

Because every leg must hit before the ticket pays out, the app adds structural risk on top of intelligence-based risk.

## Privacy And Security

- Bet records are saved in the current browser's `localStorage` by default.
- `.env.local` stores API keys and is ignored by `.gitignore`.
- Frontend code does not contain real API keys.
- Model analysis sends the current intelligence text, selected match, pick, and portfolio summary to the configured provider.
- Web intelligence refresh sends match names, picks, and keywords to public news/RSS services.
- Open-bet refresh sends team/country keywords from unsettled bet records to public news/RSS services.
- Full JSON backups are not uploaded automatically.
- Before publishing to GitHub, verify that `.env.local`, logs, and personal backup files are not committed.

## Pre-Release Checklist

```powershell
git status --short
```

Do not commit:

```text
.env.local
server.log
server.err.log
```

Optional secret-pattern check:

```powershell
Select-String -Path *.js,*.py,*.html,*.css,*.md,.env.example -Pattern "sk-[A-Za-z0-9_-]{12,}"
```

It should not return any real API key.

## FAQ

### The app says the model proxy is not running

Use:

```powershell
python server.py --port 4173
```

Do not use:

```powershell
python -m http.server 4173
```

The latter only serves static files and does not provide `/api/llm/*` or `/api/intel/*`.

### The model API returns an authentication error

Check `.env.local`, especially API key, Base URL, and model name. Restart the local server after editing.

### How do I switch models?

Edit `.env.local`:

```text
LLM_PROVIDER=YourProvider
LLM_BASE_URL=https://your-provider.example/v1
LLM_MODEL=provider-model-name
```

You can also update the configuration in the Model API panel inside the app.

## License

MIT License. See [LICENSE](LICENSE).
