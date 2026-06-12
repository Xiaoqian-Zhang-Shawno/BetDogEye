"use strict";

const STORE_KEY = "betdogeye.state.v1";
const MONEY = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  maximumFractionDigits: 0,
});
const NUMBER = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });
const COLORS = ["#1f9d72", "#247c9f", "#c9891b", "#cf3f35", "#596275", "#6f8f3c"];

const statusMeta = {
  open: { label: "未结算", tone: "open" },
  won: { label: "已中奖", tone: "won" },
  lost: { label: "未中奖", tone: "lost" },
  cashed: { label: "提前兑付", tone: "cashed" },
  void: { label: "作废", tone: "void" },
};

const profileScale = {
  conservative: { label: "保守", kelly: 0.18, riskPenalty: 1.25 },
  balanced: { label: "均衡", kelly: 0.25, riskPenalty: 1 },
  aggressive: { label: "进取", kelly: 0.38, riskPenalty: 0.82 },
};

const factorRules = [
  {
    key: "injury",
    label: "伤病与停赛",
    color: "#cf3f35",
    weight: 1.15,
    words: [
      "伤病",
      "受伤",
      "伤停",
      "缺阵",
      "停赛",
      "拉伤",
      "骨折",
      "膝盖",
      "脚踝",
      "门将",
      "核心",
      "主力",
      "队长",
    ],
  },
  {
    key: "locker",
    label: "更衣室与纪律",
    color: "#c9891b",
    weight: 1.25,
    words: ["更衣室", "内讧", "矛盾", "不合", "冲突", "罢训", "纪律", "炮轰", "分歧"],
  },
  {
    key: "fatigue",
    label: "赛程与体能",
    color: "#247c9f",
    weight: 0.92,
    words: ["疲劳", "体能", "连续", "背靠背", "旅途", "长途", "客场", "高温", "恢复"],
  },
  {
    key: "rotation",
    label: "轮换与战术",
    color: "#596275",
    weight: 0.82,
    words: ["轮换", "替补", "变阵", "战术", "磨合", "新人", "阵容", "首发", "主帅"],
  },
  {
    key: "motivation",
    label: "战意与压力",
    color: "#6f8f3c",
    weight: 0.78,
    words: ["战意", "压力", "出线", "无欲无求", "必须取胜", "心理", "士气", "舆论"],
  },
  {
    key: "market",
    label: "赔率与市场",
    color: "#1f9d72",
    weight: 0.9,
    words: ["降赔", "升赔", "热度", "盘口", "赔率", "资金", "异常", "大热", "冷门"],
  },
];

const severeWords = ["核心", "主力", "门将", "队长", "重伤", "罢训", "内讧", "缺阵", "停赛", "异常"];

const state = loadState();

const els = {
  navTabs: document.querySelector("#navTabs"),
  viewTitle: document.querySelector("#viewTitle"),
  kpiGrid: document.querySelector("#kpiGrid"),
  portfolioStatus: document.querySelector("#portfolioStatus"),
  cashflowChart: document.querySelector("#cashflowChart"),
  cashflowBadge: document.querySelector("#cashflowBadge"),
  statusDonut: document.querySelector("#statusDonut"),
  exposureBars: document.querySelector("#exposureBars"),
  evScatter: document.querySelector("#evScatter"),
  ledgerRows: document.querySelector("#ledgerRows"),
  ledgerSearch: document.querySelector("#ledgerSearch"),
  ledgerStatusFilter: document.querySelector("#ledgerStatusFilter"),
  betForm: document.querySelector("#betForm"),
  betFormTitle: document.querySelector("#betFormTitle"),
  deleteBetBtn: document.querySelector("#deleteBetBtn"),
  resetBetFormBtn: document.querySelector("#resetBetFormBtn"),
  newBetBtn: document.querySelector("#newBetBtn"),
  exportCsvBtn: document.querySelector("#exportCsvBtn"),
  seedDemoBtn: document.querySelector("#seedDemoBtn"),
  exportJsonBtn: document.querySelector("#exportJsonBtn"),
  importJsonInput: document.querySelector("#importJsonInput"),
  intelForm: document.querySelector("#intelForm"),
  intelMatch: document.querySelector("#intelMatch"),
  intelText: document.querySelector("#intelText"),
  sourceReliability: document.querySelector("#sourceReliability"),
  clearIntelBtn: document.querySelector("#clearIntelBtn"),
  aiStatus: document.querySelector("#aiStatus"),
  llmProvider: document.querySelector("#llmProvider"),
  deepseekKey: document.querySelector("#deepseekKey"),
  deepseekModel: document.querySelector("#deepseekModel"),
  deepseekBaseUrl: document.querySelector("#deepseekBaseUrl"),
  saveDeepseekKeyBtn: document.querySelector("#saveDeepseekKeyBtn"),
  refreshIntelBtn: document.querySelector("#refreshIntelBtn"),
  refreshOpenBetsBtn: document.querySelector("#refreshOpenBetsBtn"),
  deepseekAnalyzeBtn: document.querySelector("#deepseekAnalyzeBtn"),
  aiConfigMessage: document.querySelector("#aiConfigMessage"),
  riskRadar: document.querySelector("#riskRadar"),
  factorList: document.querySelector("#factorList"),
  webIntelList: document.querySelector("#webIntelList"),
  aiInsightList: document.querySelector("#aiInsightList"),
  settingsForm: document.querySelector("#settingsForm"),
  recommendations: document.querySelector("#recommendations"),
  strategyCount: document.querySelector("#strategyCount"),
  disciplineFill: document.querySelector("#disciplineFill"),
  disciplineScore: document.querySelector("#disciplineScore"),
  disciplineLabel: document.querySelector("#disciplineLabel"),
  lastSaved: document.querySelector("#lastSaved"),
};

const formFields = [
  "betId",
  "matchName",
  "matchDate",
  "pickName",
  "marketType",
  "stake",
  "maxPayout",
  "actualOutflow",
  "actualIncome",
  "subjectiveProb",
  "betStatus",
  "correlationGroup",
  "confidence",
  "betNotes",
];

init();

function init() {
  bindEvents();
  syncSettingsForm();
  resetBetForm();
  render();
  refreshDeepseekStatus();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => undefined);
  }
}

function bindEvents() {
  els.navTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (!button) return;
    setView(button.dataset.view);
  });

  els.betForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveBetFromForm();
  });

  els.deleteBetBtn.addEventListener("click", () => {
    const id = document.querySelector("#betId").value;
    if (!id) return;
    state.bets = state.bets.filter((bet) => bet.id !== id);
    state.intel = state.intel.filter((item) => item.matchId !== id);
    state.aiInsights = state.aiInsights.filter((item) => item.matchId !== id);
    resetBetForm();
    persistAndRender();
  });

  els.resetBetFormBtn.addEventListener("click", resetBetForm);
  els.newBetBtn.addEventListener("click", () => {
    resetBetForm();
    document.querySelector("#matchName").focus();
  });

  els.ledgerSearch.addEventListener("input", renderLedger);
  els.ledgerStatusFilter.addEventListener("change", renderLedger);

  els.intelForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveIntelFromForm();
  });

  els.clearIntelBtn.addEventListener("click", () => {
    if (els.intelMatch.value === "portfolio") {
      state.intel = [];
      state.aiInsights = [];
      state.webIntel = [];
    } else {
      state.intel = state.intel.filter((item) => item.matchId !== els.intelMatch.value);
      state.aiInsights = state.aiInsights.filter((item) => item.matchId !== els.intelMatch.value);
      state.webIntel = state.webIntel.filter((item) => item.matchId !== els.intelMatch.value);
    }
    els.intelText.value = "";
    persistAndRender();
  });

  els.saveDeepseekKeyBtn.addEventListener("click", saveDeepseekConfig);
  els.llmProvider.addEventListener("change", applyProviderPreset);
  els.refreshIntelBtn.addEventListener("click", runWebIntelRefresh);
  els.refreshOpenBetsBtn.addEventListener("click", runOpenBetsIntelRefresh);
  els.deepseekAnalyzeBtn.addEventListener("click", runDeepseekAnalysis);

  els.settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSettings();
  });

  els.exportCsvBtn.addEventListener("click", exportCsv);
  els.exportJsonBtn.addEventListener("click", exportJson);
  els.seedDemoBtn.addEventListener("click", () => {
    const demo = createDemoState();
    Object.assign(state, demo);
    syncSettingsForm();
    resetBetForm();
    persistAndRender();
  });

  els.importJsonInput.addEventListener("change", importJson);

  document.querySelector("#stake").addEventListener("input", mirrorOutflowWhenEmpty);
}

function setView(view) {
  const titles = {
    dashboard: "组合仪表盘",
    ledger: "下注记录",
    intel: "风险情报",
    strategy: "金融收益策略",
  };
  document.querySelectorAll(".view").forEach((node) => node.classList.remove("active"));
  document.querySelector(`#${view}View`).classList.add("active");
  document.querySelectorAll(".nav-tab").forEach((node) => {
    node.classList.toggle("active", node.dataset.view === view);
  });
  els.viewTitle.textContent = titles[view] || "BetDogEye";
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) {
      return normalizeState(JSON.parse(saved));
    }
  } catch (error) {
    console.warn("Failed to load state", error);
  }
  return createDemoState();
}

function normalizeState(input) {
  const fallback = createDemoState();
  return {
    bankroll: finite(input.bankroll, fallback.bankroll),
    riskProfile: input.riskProfile || fallback.riskProfile,
    stopLoss: finite(input.stopLoss, fallback.stopLoss),
    perMatchCapPct: finite(input.perMatchCapPct, fallback.perMatchCapPct),
    maxPortfolioRiskPct: finite(input.maxPortfolioRiskPct, fallback.maxPortfolioRiskPct),
    hedgeOdds: finite(input.hedgeOdds, fallback.hedgeOdds),
    bets: Array.isArray(input.bets) ? input.bets.map(normalizeBet) : fallback.bets,
    intel: Array.isArray(input.intel) ? input.intel.map(normalizeIntel) : fallback.intel,
    aiInsights: Array.isArray(input.aiInsights) ? input.aiInsights.map(normalizeAiInsight) : fallback.aiInsights,
    webIntel: Array.isArray(input.webIntel) ? input.webIntel.map(normalizeWebIntel) : fallback.webIntel,
    savedAt: input.savedAt || new Date().toISOString(),
  };
}

function createDemoState() {
  const today = new Date();
  const addDays = (days) => new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10);
  const bets = [
    {
      id: makeId(),
      matchName: "东道主 A vs 强队 B",
      matchDate: addDays(1),
      pickName: "强队 B 胜",
      marketType: "胜平负",
      stake: 600,
      maxPayout: 1020,
      actualOutflow: 600,
      actualIncome: 0,
      subjectiveProb: 61,
      status: "open",
      correlationGroup: "B队敞口",
      confidence: "medium",
      notes: "赔率合理，但临场阵容要复核。",
    },
    {
      id: makeId(),
      matchName: "传统强队 C vs 黑马 D",
      matchDate: addDays(2),
      pickName: "强队 C 胜",
      marketType: "胜平负",
      stake: 900,
      maxPayout: 1350,
      actualOutflow: 900,
      actualIncome: 0,
      subjectiveProb: 67,
      status: "open",
      correlationGroup: "热门低赔",
      confidence: "high",
      notes: "热门方向，注意大热倒灶。",
    },
    {
      id: makeId(),
      matchName: "E队 vs F队",
      matchDate: addDays(-1),
      pickName: "E队 不败",
      marketType: "二选一",
      stake: 500,
      maxPayout: 820,
      actualOutflow: 500,
      actualIncome: 820,
      subjectiveProb: 58,
      status: "won",
      correlationGroup: "单关",
      confidence: "medium",
      notes: "已结算。",
    },
    {
      id: makeId(),
      matchName: "G队 vs H队",
      matchDate: addDays(-2),
      pickName: "H队 胜",
      marketType: "胜平负",
      stake: 400,
      maxPayout: 760,
      actualOutflow: 400,
      actualIncome: 0,
      subjectiveProb: 52,
      status: "lost",
      correlationGroup: "单关",
      confidence: "low",
      notes: "临场信息不足。",
    },
  ].map(normalizeBet);

  return {
    bankroll: 10000,
    riskProfile: "balanced",
    stopLoss: 1000,
    perMatchCapPct: 10,
    maxPortfolioRiskPct: 35,
    hedgeOdds: 1.92,
    bets,
    intel: [
      {
        id: makeId(),
        matchId: bets[1].id,
        createdAt: new Date().toISOString(),
        sourceReliability: 0.75,
        text: "赛前消息显示，强队 C 主力前锋脚踝不适，队内对轮换方案存在分歧，市场热度集中在主胜方向。",
        factors: mineFactors(
          "赛前消息显示，强队 C 主力前锋脚踝不适，队内对轮换方案存在分歧，市场热度集中在主胜方向。",
          0.75
        ),
      },
    ],
    aiInsights: [],
    webIntel: [],
    savedAt: new Date().toISOString(),
  };
}

function normalizeBet(bet) {
  return {
    id: bet.id || makeId(),
    matchName: String(bet.matchName || "").trim() || "未命名比赛",
    matchDate: bet.matchDate || new Date().toISOString().slice(0, 10),
    pickName: String(bet.pickName || "").trim() || "未填写",
    marketType: bet.marketType || "胜平负",
    stake: finite(bet.stake, 0),
    maxPayout: finite(bet.maxPayout, 0),
    actualOutflow: finite(bet.actualOutflow, finite(bet.stake, 0)),
    actualIncome: finite(bet.actualIncome, 0),
    subjectiveProb: clamp(finite(bet.subjectiveProb, 50), 1, 99),
    status: statusMeta[bet.status] ? bet.status : "open",
    correlationGroup: String(bet.correlationGroup || "").trim(),
    confidence: bet.confidence || "medium",
    notes: String(bet.notes || ""),
  };
}

function normalizeIntel(item) {
  return {
    id: item.id || makeId(),
    matchId: item.matchId || "portfolio",
    createdAt: item.createdAt || new Date().toISOString(),
    sourceReliability: finite(item.sourceReliability, 0.75),
    text: String(item.text || ""),
    factors: Array.isArray(item.factors) ? item.factors : mineFactors(item.text || "", item.sourceReliability),
  };
}

function normalizeAiInsight(item) {
  return {
    id: item.id || makeId(),
    matchId: item.matchId || "portfolio",
    createdAt: item.createdAt || new Date().toISOString(),
    model: String(item.model || ""),
    summary: String(item.summary || ""),
    upsetRiskScore: clamp(finite(item.upsetRiskScore, 0), 0, 100),
    probabilityAdjustment: finite(item.probabilityAdjustment, 0),
    hedgeTrigger: String(item.hedgeTrigger || ""),
    factors: Array.isArray(item.factors) ? item.factors.map(normalizeAiFactor) : [],
    strategyNotes: Array.isArray(item.strategyNotes) ? item.strategyNotes.map(String) : [],
  };
}

function normalizeAiFactor(factor) {
  return {
    label: String(factor.label || "AI 风险因子"),
    severity: clamp(finite(factor.severity, 0), 0, 100),
    confidence: clamp(finite(factor.confidence, 0.5), 0, 1),
    evidence: String(factor.evidence || ""),
    action: String(factor.action || ""),
  };
}

function normalizeWebIntel(item) {
  return {
    id: item.id || makeId(),
    matchId: item.matchId || "portfolio",
    createdAt: item.createdAt || new Date().toISOString(),
    summary: String(item.summary || ""),
    searchQuery: String(item.searchQuery || ""),
    intelText: String(item.intelText || ""),
    sources: Array.isArray(item.sources) ? item.sources.map(normalizeIntelSource) : [],
    nextSteps: Array.isArray(item.nextSteps) ? item.nextSteps.map(String) : [],
  };
}

function normalizeIntelSource(source) {
  return {
    title: String(source.title || ""),
    url: String(source.url || ""),
    source: String(source.source || ""),
    publishedAt: String(source.publishedAt || ""),
    relevance: clamp(finite(source.relevance, 0), 0, 100),
  };
}

function persistAndRender() {
  state.savedAt = new Date().toISOString();
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  render();
}

function render() {
  const analytics = buildAnalytics();
  renderKpis(analytics);
  renderCharts(analytics);
  renderLedger();
  renderIntelSelect();
  renderRiskBoard(analytics);
  renderRecommendations(analytics);
  renderDiscipline(analytics);
  els.lastSaved.textContent = `已保存 ${new Date(state.savedAt).toLocaleString("zh-CN")}`;
}

function buildAnalytics() {
  const riskByMatch = getRiskByMatch();
  const bets = state.bets.map((bet) => enrichBet(bet, riskByMatch[bet.id] || 0));
  const totalOutflow = sum(bets, "actualOutflow");
  const totalIncome = sum(bets, "actualIncome");
  const settled = bets.filter((bet) => bet.status !== "open");
  const open = bets.filter((bet) => bet.status === "open");
  const settledOutflow = sum(settled, "actualOutflow");
  const settledIncome = sum(settled, "actualIncome");
  const settledProfit = settledIncome - settledOutflow;
  const openExposure = sum(open, "actualOutflow");
  const maxPayout = sum(open, "maxPayout");
  const expectedProfit = sum(open, "expectedProfit");
  const openRiskWeighted = openExposure ? sum(open.map((bet) => bet.actualOutflow * bet.riskScore)) / openExposure : 0;
  const roi = totalOutflow ? (totalIncome - totalOutflow) / totalOutflow : 0;
  const hitRate = settled.length
    ? (settled.filter((bet) => bet.status === "won" || bet.status === "cashed").length / settled.length) * 100
    : 0;
  const byStatus = groupSum(bets, (bet) => statusMeta[bet.status].label, "actualOutflow");
  const byMatch = groupSum(open, (bet) => bet.matchName, "actualOutflow")
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);
  const cashflow = buildCashflow(bets);

  return {
    bets,
    open,
    settled,
    totalOutflow,
    totalIncome,
    settledProfit,
    openExposure,
    maxPayout,
    expectedProfit,
    roi,
    hitRate,
    byStatus,
    byMatch,
    cashflow,
    openRiskWeighted,
    riskByMatch,
  };
}

function enrichBet(bet, riskScore) {
  const outflow = Math.max(bet.actualOutflow, 0);
  const odds = outflow > 0 ? bet.maxPayout / outflow : 0;
  const impliedProb = odds > 0 ? (1 / odds) * 100 : 0;
  const profile = profileScale[state.riskProfile] || profileScale.balanced;
  const adjustedProb = clamp(bet.subjectiveProb * (1 - riskScore * 0.34 * profile.riskPenalty), 1, 99);
  const expectedProfit = (adjustedProb / 100) * bet.maxPayout - outflow;
  const potentialProfit = bet.maxPayout - outflow;
  const realizedProfit = bet.actualIncome - outflow;
  const b = Math.max(odds - 1, 0);
  const p = adjustedProb / 100;
  const kellyRaw = b > 0 ? (b * p - (1 - p)) / b : 0;
  const kellyFraction = clamp(kellyRaw, 0, 1) * profile.kelly;
  const suggestedStake = Math.max(0, state.bankroll * kellyFraction);
  const roiExpected = outflow ? expectedProfit / outflow : 0;
  return {
    ...bet,
    odds,
    impliedProb,
    adjustedProb,
    riskScore,
    expectedProfit,
    potentialProfit,
    realizedProfit,
    kellyFraction,
    suggestedStake,
    roiExpected,
  };
}

function getRiskByMatch() {
  const score = {};
  for (const item of state.intel) {
    const targetIds = item.matchId === "portfolio" ? state.bets.map((bet) => bet.id) : [item.matchId];
    const factorScore = item.factors.reduce((acc, factor) => acc + factor.score, 0);
    for (const id of targetIds) {
      score[id] = (score[id] || 0) + factorScore;
    }
  }
  for (const item of state.aiInsights || []) {
    const targetIds = item.matchId === "portfolio" ? state.bets.map((bet) => bet.id) : [item.matchId];
    const aiScore = item.upsetRiskScore * 0.55;
    for (const id of targetIds) {
      score[id] = (score[id] || 0) + aiScore;
    }
  }
  for (const key of Object.keys(score)) {
    score[key] = clamp(score[key] / 100, 0, 1);
  }
  return score;
}

function renderKpis(analytics) {
  const riskTone = analytics.openRiskWeighted > 0.55 ? "red" : analytics.openRiskWeighted > 0.28 ? "amber" : "green";
  const cards = [
    {
      label: "实际总支出",
      value: money(analytics.totalOutflow),
      detail: `未结算敞口 ${money(analytics.openExposure)}`,
      tone: "cyan",
    },
    {
      label: "最高可中金额",
      value: money(analytics.maxPayout),
      detail: `未结算潜在利润 ${money(analytics.maxPayout - analytics.openExposure)}`,
      tone: "green",
    },
    {
      label: "已结算盈亏",
      value: signedMoney(analytics.settledProfit),
      detail: `命中率 ${formatPct(analytics.hitRate / 100)}`,
      tone: analytics.settledProfit >= 0 ? "green" : "red",
    },
    {
      label: "期望收益 / 风险",
      value: signedMoney(analytics.expectedProfit),
      detail: `风险分 ${NUMBER.format(analytics.openRiskWeighted * 100)}`,
      tone: riskTone,
    },
  ];
  els.kpiGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="kpi-card" data-tone="${card.tone}">
          <p class="panel-label">${card.label}</p>
          <strong>${card.value}</strong>
          <span>${card.detail}</span>
        </article>
      `
    )
    .join("");

  const exposurePct = state.bankroll ? analytics.openExposure / state.bankroll : 0;
  els.portfolioStatus.className = "status-pill";
  if (exposurePct > state.maxPortfolioRiskPct / 100 || analytics.openRiskWeighted > 0.58) {
    els.portfolioStatus.classList.add("bad");
    els.portfolioStatus.textContent = "组合需降风险";
  } else if (analytics.expectedProfit < 0 || analytics.openRiskWeighted > 0.32) {
    els.portfolioStatus.classList.add("warn");
    els.portfolioStatus.textContent = "谨慎持仓";
  } else {
    els.portfolioStatus.classList.add("good");
    els.portfolioStatus.textContent = "风险可控";
  }
}

function renderCharts(analytics) {
  renderCashflow(analytics.cashflow);
  renderDonut(els.statusDonut, analytics.byStatus);
  renderBars(els.exposureBars, analytics.byMatch, state.bankroll * (state.perMatchCapPct / 100));
  renderScatter(els.evScatter, analytics.open);
}

function renderCashflow(points) {
  if (!points.length) {
    els.cashflowChart.innerHTML = empty("暂无已结算现金流");
    els.cashflowBadge.textContent = "--";
    return;
  }
  const width = 720;
  const height = 230;
  const pad = 28;
  const values = points.map((p) => p.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((p, index) => {
    const x = pad + stepX * index;
    const y = height - pad - ((p.value - min) / span) * (height - pad * 2);
    return [x, y];
  });
  const path = coords.map(([x, y], index) => `${index ? "L" : "M"} ${x} ${y}`).join(" ");
  const area = `${path} L ${coords.at(-1)[0]} ${height - pad} L ${coords[0][0]} ${height - pad} Z`;
  const last = points.at(-1).value;
  els.cashflowBadge.textContent = `最新 ${signedMoney(last)}`;
  els.cashflowChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="累计盈亏曲线">
      <defs>
        <linearGradient id="cashArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="${last >= 0 ? "#1f9d72" : "#cf3f35"}" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="${last >= 0 ? "#1f9d72" : "#cf3f35"}" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <line x1="${pad}" x2="${width - pad}" y1="${height - pad}" y2="${height - pad}" stroke="#dfe4dc"/>
      <line x1="${pad}" x2="${width - pad}" y1="${
        height - pad - ((0 - min) / span) * (height - pad * 2)
      }" y2="${height - pad - ((0 - min) / span) * (height - pad * 2)}" stroke="#cbd3c8" stroke-dasharray="4 6"/>
      <path d="${area}" fill="url(#cashArea)"></path>
      <path d="${path}" fill="none" stroke="${last >= 0 ? "#1f9d72" : "#cf3f35"}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
      ${coords
        .map(([x, y], index) => `<circle cx="${x}" cy="${y}" r="${index === coords.length - 1 ? 5 : 3}" fill="#10131a"></circle>`)
        .join("")}
      <text x="${pad}" y="18" fill="#6c7280" font-size="12">${money(max)}</text>
      <text x="${pad}" y="${height - 6}" fill="#6c7280" font-size="12">${money(min)}</text>
    </svg>
  `;
}

function renderDonut(target, segments) {
  const total = sum(segments, "value");
  if (!total) {
    target.innerHTML = empty("暂无投注状态数据");
    return;
  }
  let offset = 25;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const circles = segments
    .map((seg, index) => {
      const part = seg.value / total;
      const dash = part * circumference;
      const circle = `<circle r="${radius}" cx="50" cy="50" fill="none" stroke="${COLORS[index % COLORS.length]}" stroke-width="14" stroke-dasharray="${dash} ${
        circumference - dash
      }" stroke-dashoffset="${offset}" stroke-linecap="round"></circle>`;
      offset -= dash;
      return circle;
    })
    .join("");
  target.innerHTML = `
    <svg viewBox="0 0 100 100" style="height:170px; margin:auto;" role="img" aria-label="状态资金分布">
      <circle r="${radius}" cx="50" cy="50" fill="none" stroke="#e8ece6" stroke-width="14"></circle>
      <g transform="rotate(-90 50 50)">${circles}</g>
      <text x="50" y="47" text-anchor="middle" fill="#10131a" font-size="11" font-weight="800">${money(total)}</text>
      <text x="50" y="61" text-anchor="middle" fill="#6c7280" font-size="7">总支出</text>
    </svg>
    <div class="legend">
      ${segments
        .map(
          (seg, index) => `
          <div class="legend-row">
            <span class="legend-name"><span class="swatch" style="background:${COLORS[index % COLORS.length]}"></span>${seg.name}</span>
            <strong>${formatPct(seg.value / total)}</strong>
          </div>
        `
        )
        .join("")}
    </div>
  `;
}

function renderBars(target, items, cap) {
  if (!items.length) {
    target.innerHTML = empty("暂无未结算敞口");
    return;
  }
  const max = Math.max(...items.map((item) => item.value), cap, 1);
  target.innerHTML = `
    <div class="bar-list">
      ${items
        .map((item, index) => {
          const pct = Math.max(4, (item.value / max) * 100);
          const over = cap > 0 && item.value > cap;
          return `
            <div class="bar-row">
              <div class="bar-meta">
                <span>${escapeHtml(item.name)}</span>
                <strong class="${over ? "amount-negative" : ""}">${money(item.value)}</strong>
              </div>
              <div class="bar-track">
                <div class="bar-fill" style="width:${pct}%; background:${over ? "#cf3f35" : COLORS[index % COLORS.length]}"></div>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderScatter(target, bets) {
  if (!bets.length) {
    target.innerHTML = empty("暂无未结算投注");
    return;
  }
  const width = 720;
  const height = 250;
  const pad = 34;
  const evs = bets.map((bet) => bet.roiExpected * 100);
  const minEv = Math.min(-30, ...evs);
  const maxEv = Math.max(30, ...evs);
  const maxStake = Math.max(...bets.map((bet) => bet.actualOutflow), 1);
  const plotted = [];
  const nodes = bets
    .map((bet, index) => {
      const x = pad + ((bet.roiExpected * 100 - minEv) / (maxEv - minEv || 1)) * (width - pad * 2);
      let y = height - pad - bet.riskScore * (height - pad * 2);
      const r = 6 + (bet.actualOutflow / maxStake) * 12;
      const nearby = plotted.filter((point) => Math.abs(point.x - x) < 28 && Math.abs(point.y - y) < 24).length;
      if (nearby) {
        y = clamp(y + (nearby % 2 ? 1 : -1) * Math.ceil(nearby / 2) * 18, pad + r, height - pad - r);
      }
      plotted.push({ x, y });
      const color = bet.expectedProfit >= 0 ? "#1f9d72" : "#cf3f35";
      return `
        <g aria-label="${escapeSvg(bet.matchName)}">
          <circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="0.78"></circle>
          <text x="${x}" y="${y + 4}" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="800">${index + 1}</text>
        </g>
      `;
    })
    .join("");
  const legend = bets
    .map((bet, index) => {
      const tone = bet.expectedProfit >= 0 ? "amount-positive" : "amount-negative";
      return `
        <div class="scatter-legend-row">
          <span class="scatter-index">${index + 1}</span>
          <span class="scatter-name">${escapeHtml(bet.matchName)} · ${escapeHtml(bet.pickName)}</span>
          <strong class="${tone}">${signedMoney(bet.expectedProfit)}</strong>
        </div>
      `;
    })
    .join("");
  const zeroX = pad + ((0 - minEv) / (maxEv - minEv || 1)) * (width - pad * 2);
  target.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="EV 风险散点图">
      <rect x="${pad}" y="${pad}" width="${width - pad * 2}" height="${height - pad * 2}" rx="8" fill="#fbfcfa" stroke="#dfe4dc"></rect>
      <line x1="${zeroX}" x2="${zeroX}" y1="${pad}" y2="${height - pad}" stroke="#cbd3c8" stroke-dasharray="4 6"></line>
      <line x1="${pad}" x2="${width - pad}" y1="${height - pad}" y2="${height - pad}" stroke="#cbd3c8"></line>
      <line x1="${pad}" x2="${pad}" y1="${pad}" y2="${height - pad}" stroke="#cbd3c8"></line>
      ${nodes}
      <text x="${pad}" y="${height - 8}" fill="#6c7280" font-size="11">低 EV</text>
      <text x="${width - pad - 44}" y="${height - 8}" fill="#6c7280" font-size="11">高 EV</text>
      <text x="6" y="${pad + 8}" fill="#6c7280" font-size="11">高风险</text>
    </svg>
    <div class="scatter-legend">${legend}</div>
  `;
}

function renderLedger() {
  const analytics = buildAnalytics();
  const query = els.ledgerSearch.value.trim().toLowerCase();
  const status = els.ledgerStatusFilter.value;
  const rows = analytics.bets.filter((bet) => {
    const matchesQuery = [bet.matchName, bet.pickName, bet.marketType, bet.correlationGroup]
      .join(" ")
      .toLowerCase()
      .includes(query);
    const matchesStatus = status === "all" || bet.status === status;
    return matchesQuery && matchesStatus;
  });

  if (!rows.length) {
    els.ledgerRows.innerHTML = `<tr><td colspan="8">${empty("没有符合条件的记录")}</td></tr>`;
    return;
  }

  els.ledgerRows.innerHTML = rows
    .map((bet) => {
      const riskClass = bet.riskScore > 0.55 ? "high" : bet.riskScore > 0.28 ? "mid" : "low";
      const status = statusMeta[bet.status];
      return `
        <tr>
          <td>
            <strong>${escapeHtml(bet.matchName)}</strong>
            <small>${bet.matchDate} · ${escapeHtml(bet.marketType)}</small>
          </td>
          <td>
            <strong>${escapeHtml(bet.pickName)}</strong>
            <small>主观 ${NUMBER.format(bet.subjectiveProb)}% / 调整 ${NUMBER.format(bet.adjustedProb)}%</small>
          </td>
          <td>${money(bet.actualOutflow)}<br><small>赔率 ${NUMBER.format(bet.odds || 0)}</small></td>
          <td>${money(bet.maxPayout)}<br><small>潜利 ${money(bet.potentialProfit)}</small></td>
          <td class="${bet.expectedProfit >= 0 ? "amount-positive" : "amount-negative"}">${signedMoney(bet.expectedProfit)}<br><small>${formatPct(bet.roiExpected)}</small></td>
          <td><span class="risk-tag ${riskClass}">${NUMBER.format(bet.riskScore * 100)}</span></td>
          <td><span class="status-tag ${status.tone}">${status.label}</span></td>
          <td>
            <div class="row-actions">
              <button class="link-button" type="button" data-edit="${bet.id}">编辑</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  els.ledgerRows.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => editBet(button.dataset.edit));
  });
}

function renderIntelSelect() {
  const selected = els.intelMatch.value || "portfolio";
  els.intelMatch.innerHTML = `
    <option value="portfolio">全部组合</option>
    ${state.bets
      .map((bet) => `<option value="${bet.id}">${escapeHtml(bet.matchName)} · ${escapeHtml(bet.pickName)}</option>`)
      .join("")}
  `;
  els.intelMatch.value = state.bets.some((bet) => bet.id === selected) ? selected : "portfolio";
}

function renderRiskBoard() {
  const factors = state.intel.flatMap((item) =>
    item.factors.map((factor) => ({
      ...factor,
      matchName: item.matchId === "portfolio" ? "全部组合" : state.bets.find((bet) => bet.id === item.matchId)?.matchName || "未知比赛",
      createdAt: item.createdAt,
    }))
  );
  renderRadar(factors);
  renderFactorList(factors);
  renderWebIntelList();
  renderAiInsightList();
}

function renderRadar(factors) {
  const totals = factorRules.map((rule) => ({
    name: rule.label,
    color: rule.color,
    value: factors.filter((factor) => factor.key === rule.key).reduce((acc, factor) => acc + factor.score, 0),
  }));
  const max = Math.max(20, ...totals.map((item) => item.value));
  const size = 250;
  const center = size / 2;
  const radius = 84;
  const points = totals.map((item, index) => {
    const angle = -Math.PI / 2 + (index / totals.length) * Math.PI * 2;
    const length = (item.value / max) * radius;
    return {
      ...item,
      x: center + Math.cos(angle) * length,
      y: center + Math.sin(angle) * length,
      lx: center + Math.cos(angle) * (radius + 22),
      ly: center + Math.sin(angle) * (radius + 22),
      ax: center + Math.cos(angle) * radius,
      ay: center + Math.sin(angle) * radius,
    };
  });
  if (!factors.length) {
    els.riskRadar.innerHTML = empty("暂无风险因子，先粘贴赛前情报");
    return;
  }
  const legend = totals
    .map(
      (item, index) => `
        <div class="radar-legend-row">
          <span class="scatter-index" style="background:${item.color}">${index + 1}</span>
          <span>${escapeHtml(item.name)}</span>
          <strong>${NUMBER.format(item.value)}</strong>
        </div>
      `
    )
    .join("");
  els.riskRadar.innerHTML = `
    <svg class="radar-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="风险因子雷达图">
      ${points
        .map(
          (p) =>
            `<line x1="${center}" y1="${center}" x2="${p.ax}" y2="${p.ay}" stroke="#dfe4dc"></line>`
        )
        .join("")}
      <polygon points="${points.map((p) => `${p.x},${p.y}`).join(" ")}" fill="rgba(207,63,53,0.17)" stroke="#cf3f35" stroke-width="3"></polygon>
      ${points
        .map(
          (p) => `
            <circle cx="${p.x}" cy="${p.y}" r="4" fill="${p.color}"></circle>
            <text x="${p.lx}" y="${p.ly + 3}" text-anchor="middle" fill="#3a4048" font-size="9" font-weight="800">${points.indexOf(p) + 1}</text>
          `
        )
        .join("")}
    </svg>
    <div class="radar-legend">${legend}</div>
  `;
}

function renderFactorList(factors) {
  if (!factors.length) {
    els.factorList.innerHTML = empty("风险因子会在这里显示");
    return;
  }
  els.factorList.innerHTML = factors
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((factor) => {
      const riskClass = factor.score > 18 ? "high" : factor.score > 10 ? "mid" : "low";
      return `
        <article class="factor-card">
          <header>
            <div>
              <strong>${escapeHtml(factor.label)}</strong>
              <p>${escapeHtml(factor.matchName)}</p>
            </div>
            <span class="risk-tag ${riskClass}">${NUMBER.format(factor.score)}</span>
          </header>
          <p>${escapeHtml(factor.snippet)}</p>
        </article>
      `;
    })
    .join("");
}

function renderAiInsightList() {
  const insights = (state.aiInsights || []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!insights.length) {
    els.aiInsightList.innerHTML = empty("模型分析结果会在这里显示");
    return;
  }
  els.aiInsightList.innerHTML = insights
    .slice(0, 5)
    .map((insight) => {
      const matchName =
        insight.matchId === "portfolio"
          ? "全部组合"
          : state.bets.find((bet) => bet.id === insight.matchId)?.matchName || "未知比赛";
      const riskClass = insight.upsetRiskScore > 66 ? "high" : insight.upsetRiskScore > 36 ? "mid" : "low";
      const notes = insight.strategyNotes.length ? insight.strategyNotes.join("；") : insight.hedgeTrigger;
      return `
        <article class="factor-card">
          <header>
            <div>
              <strong>模型分析：${escapeHtml(matchName)}</strong>
              <p>${escapeHtml(insight.summary || "已完成 AI 风险分析")}</p>
            </div>
            <span class="risk-tag ${riskClass}">${NUMBER.format(insight.upsetRiskScore)}</span>
          </header>
          <p>${escapeHtml(notes || "暂无额外策略说明")}</p>
        </article>
      `;
    })
    .join("");
}

function renderWebIntelList() {
  const records = (state.webIntel || []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!records.length) {
    els.webIntelList.innerHTML = empty("网络刷新来源会在这里显示");
    return;
  }
  els.webIntelList.innerHTML = records
    .slice(0, 4)
    .map((record) => {
      const matchName =
        record.matchId === "portfolio"
          ? "全部组合"
          : state.bets.find((bet) => bet.id === record.matchId)?.matchName || "未知比赛";
      const sourceRows = record.sources
        .slice(0, 4)
        .map((source) => {
          const label = [source.source, source.publishedAt].filter(Boolean).join(" · ");
          return `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(
            source.title || source.url
          )}</a><small>${escapeHtml(label)}</small>`;
        })
        .join("");
      return `
        <article class="factor-card source-card">
          <header>
            <div>
              <strong>网络情报：${escapeHtml(matchName)}</strong>
              <p>${escapeHtml(record.summary || "已刷新公开新闻来源")}</p>
            </div>
            <span class="mini-badge">${record.sources.length} 来源</span>
          </header>
          <div class="source-links">${sourceRows}</div>
        </article>
      `;
    })
    .join("");
}

function renderRecommendations(analytics) {
  const recommendations = buildRecommendations(analytics);
  els.strategyCount.textContent = `${recommendations.length} 条`;
  els.recommendations.innerHTML = recommendations.length
    ? recommendations
        .map(
          (item) => `
          <article class="recommendation-card" data-level="${item.level}">
            <header>
              <div>
                <strong>${escapeHtml(item.title)}</strong>
                <span class="mini-badge">${escapeHtml(item.badge)}</span>
              </div>
            </header>
            <p>${escapeHtml(item.body)}</p>
          </article>
        `
        )
        .join("")
    : empty("当前没有需要处理的策略提醒");
}

function buildRecommendations(analytics) {
  const recs = [];
  const exposurePct = state.bankroll ? analytics.openExposure / state.bankroll : 0;
  if (exposurePct > state.maxPortfolioRiskPct / 100) {
    recs.push({
      level: "bad",
      title: "组合敞口超过预算阈值",
      badge: `${formatPct(exposurePct)} / ${state.maxPortfolioRiskPct}%`,
      body: `未结算支出已达 ${money(analytics.openExposure)}。建议暂停新增同向投注，并优先对高风险或负 EV 记录做减仓。`,
    });
  }
  if (Math.abs(analytics.settledProfit) >= state.stopLoss && analytics.settledProfit < 0) {
    recs.push({
      level: "bad",
      title: "已触及止损线",
      badge: signedMoney(analytics.settledProfit),
      body: `当前已结算亏损超过止损线 ${money(state.stopLoss)}。建议停止追加，复盘信息源与主观胜率偏差。`,
    });
  }

  const cap = state.bankroll * (state.perMatchCapPct / 100);
  for (const bet of analytics.open) {
    if (bet.actualOutflow > cap) {
      recs.push({
        level: "warn",
        title: `单场仓位过重：${bet.matchName}`,
        badge: money(bet.actualOutflow),
        body: `单场支出超过上限 ${money(cap)}。若不想完全退出，可用对冲参考赔率 ${NUMBER.format(
          state.hedgeOdds
        )} 估算保护仓位。`,
      });
    }
    if (bet.expectedProfit < 0) {
      recs.push({
        level: "bad",
        title: `负期望值：${bet.matchName}`,
        badge: signedMoney(bet.expectedProfit),
        body: `调整后胜率 ${NUMBER.format(bet.adjustedProb)}% 低于隐含概率 ${NUMBER.format(
          bet.impliedProb
        )}%。建议不追加，等待首发或赔率改善。`,
      });
    } else if (bet.kellyFraction > 0.001 && bet.suggestedStake > bet.actualOutflow * 1.2) {
      recs.push({
        level: "good",
        title: `正 EV 但需分批：${bet.matchName}`,
        badge: `Kelly ${formatPct(bet.kellyFraction)}`,
        body: `分数 Kelly 建议仓位约 ${money(bet.suggestedStake)}，当前已投入 ${money(
          bet.actualOutflow
        )}。若新增，仍应受单场上限约束。`,
      });
    }
    if (bet.riskScore > 0.3) {
      const hedge = calculateHedge(bet, state.hedgeOdds);
      recs.push({
        level: "warn",
        title: `爆冷风险偏高：${bet.matchName}`,
        badge: `风险 ${NUMBER.format(bet.riskScore * 100)}`,
        body: `可考虑对冲 ${money(hedge.equalizedStake)} 左右以接近盈亏均衡；若只想把最大亏损压到 ${money(
          state.stopLoss
        )} 内，最低对冲约 ${money(hedge.lossCapStake)}。`,
      });
    }
  }

  if (!recs.some((item) => item.body.includes("对冲")) && analytics.open.length) {
    const candidate = analytics.open
      .slice()
      .sort((a, b) => b.riskScore - a.riskScore || b.actualOutflow - a.actualOutflow)[0];
    const hedge = calculateHedge(candidate, state.hedgeOdds);
    recs.push({
      level: "info",
      title: `对冲观察：${candidate.matchName}`,
      badge: `参考赔率 ${NUMBER.format(state.hedgeOdds)}`,
      body: `当前未必需要立刻对冲；若临场出现伤停、内讧或赔率异常，可先以 ${money(
        hedge.lossCapStake || candidate.actualOutflow * 0.35
      )} 作为保护仓位观察点，完整盈亏均衡约需 ${money(hedge.equalizedStake)}。`,
    });
  }

  if (analytics.expectedProfit > 0 && analytics.openRiskWeighted < 0.28 && exposurePct <= state.maxPortfolioRiskPct / 100) {
    recs.unshift({
      level: "info",
      title: "组合当前处于可观察区",
      badge: signedMoney(analytics.expectedProfit),
      body: "整体期望收益为正且风险分不高。建议保持信息更新，不因短期赔率波动频繁加仓。",
    });
  }

  return recs.slice(0, 12);
}

function calculateHedge(bet, hedgeOdds) {
  const odds = Math.max(hedgeOdds, 1.01);
  const equalizedStake = bet.maxPayout / odds;
  const lossCapStake = Math.max(0, (bet.actualOutflow - state.stopLoss) / (odds - 1));
  return {
    equalizedStake,
    lossCapStake,
  };
}

function renderDiscipline(analytics) {
  const exposurePct = state.bankroll ? analytics.openExposure / state.bankroll : 0;
  const riskPenalty = analytics.openRiskWeighted;
  const score = clamp(100 - exposurePct * 120 - riskPenalty * 45 + Math.max(analytics.expectedProfit, 0) / Math.max(state.bankroll, 1) * 80, 0, 100);
  els.disciplineFill.style.width = `${score}%`;
  els.disciplineScore.textContent = NUMBER.format(score);
  if (score >= 75) {
    els.disciplineLabel.textContent = "纪律良好";
  } else if (score >= 48) {
    els.disciplineLabel.textContent = "需要观察";
  } else {
    els.disciplineLabel.textContent = "建议降仓";
  }
}

function saveBetFromForm() {
  const form = getBetFormValue();
  const existingIndex = state.bets.findIndex((bet) => bet.id === form.id);
  if (existingIndex >= 0) {
    state.bets[existingIndex] = form;
  } else {
    state.bets.unshift(form);
  }
  resetBetForm();
  persistAndRender();
}

function getBetFormValue() {
  return normalizeBet({
    id: document.querySelector("#betId").value || makeId(),
    matchName: document.querySelector("#matchName").value,
    matchDate: document.querySelector("#matchDate").value,
    pickName: document.querySelector("#pickName").value,
    marketType: document.querySelector("#marketType").value,
    stake: Number(document.querySelector("#stake").value),
    maxPayout: Number(document.querySelector("#maxPayout").value),
    actualOutflow: Number(document.querySelector("#actualOutflow").value),
    actualIncome: Number(document.querySelector("#actualIncome").value),
    subjectiveProb: Number(document.querySelector("#subjectiveProb").value),
    status: document.querySelector("#betStatus").value,
    correlationGroup: document.querySelector("#correlationGroup").value,
    confidence: document.querySelector("#confidence").value,
    notes: document.querySelector("#betNotes").value,
  });
}

function editBet(id) {
  const bet = state.bets.find((item) => item.id === id);
  if (!bet) return;
  document.querySelector("#betId").value = bet.id;
  document.querySelector("#matchName").value = bet.matchName;
  document.querySelector("#matchDate").value = bet.matchDate;
  document.querySelector("#pickName").value = bet.pickName;
  document.querySelector("#marketType").value = bet.marketType;
  document.querySelector("#stake").value = bet.stake;
  document.querySelector("#maxPayout").value = bet.maxPayout;
  document.querySelector("#actualOutflow").value = bet.actualOutflow;
  document.querySelector("#actualIncome").value = bet.actualIncome;
  document.querySelector("#subjectiveProb").value = bet.subjectiveProb;
  document.querySelector("#betStatus").value = bet.status;
  document.querySelector("#correlationGroup").value = bet.correlationGroup;
  document.querySelector("#confidence").value = bet.confidence;
  document.querySelector("#betNotes").value = bet.notes;
  els.betFormTitle.textContent = "编辑下注";
  els.deleteBetBtn.classList.remove("hidden");
  setView("ledger");
}

function resetBetForm() {
  formFields.forEach((id) => {
    const node = document.querySelector(`#${id}`);
    if (!node) return;
    node.value = "";
  });
  document.querySelector("#matchDate").value = new Date().toISOString().slice(0, 10);
  document.querySelector("#marketType").value = "胜平负";
  document.querySelector("#subjectiveProb").value = "55";
  document.querySelector("#betStatus").value = "open";
  document.querySelector("#confidence").value = "medium";
  els.betFormTitle.textContent = "新增下注";
  els.deleteBetBtn.classList.add("hidden");
}

function mirrorOutflowWhenEmpty() {
  const outflow = document.querySelector("#actualOutflow");
  if (!outflow.value) {
    outflow.value = document.querySelector("#stake").value;
  }
}

function saveIntelFromForm() {
  const text = els.intelText.value.trim();
  if (!text) return;
  const reliability = Number(els.sourceReliability.value);
  state.intel.unshift({
    id: makeId(),
    matchId: els.intelMatch.value,
    createdAt: new Date().toISOString(),
    sourceReliability: reliability,
    text,
    factors: mineFactors(text, reliability),
  });
  els.intelText.value = "";
  persistAndRender();
}

async function refreshDeepseekStatus() {
  try {
    const response = await fetch("/api/llm/status", { cache: "no-store" });
    if (!response.ok) throw new Error("status unavailable");
    const data = await response.json();
    els.llmProvider.value = data.provider || "DeepSeek";
    els.deepseekBaseUrl.value = data.baseUrl || "https://api.deepseek.com";
    els.deepseekModel.value = data.model || "deepseek-chat";
    els.aiStatus.textContent = data.configured ? "已配置" : "未配置";
    els.aiStatus.className = `mini-badge ${data.configured ? "status-tag won" : "status-tag open"}`;
    return data.configured;
  } catch {
    els.aiStatus.textContent = "代理未启动";
    els.aiStatus.className = "mini-badge status-tag lost";
    return false;
  }
}

function applyProviderPreset() {
  const provider = els.llmProvider.value;
  if (provider === "DeepSeek") {
    els.deepseekBaseUrl.value = "https://api.deepseek.com";
    if (!els.deepseekModel.value || els.deepseekModel.value.startsWith("gpt-")) {
      els.deepseekModel.value = "deepseek-chat";
    }
  }
  if (provider === "OpenAI") {
    els.deepseekBaseUrl.value = "https://api.openai.com/v1";
    if (!els.deepseekModel.value || els.deepseekModel.value.startsWith("deepseek")) {
      els.deepseekModel.value = "gpt-4.1-mini";
    }
  }
}

async function saveDeepseekConfig() {
  const apiKey = els.deepseekKey.value.trim();
  if (!apiKey) {
    setAiMessage("请输入模型 API Key。", "warn");
    return false;
  }
  try {
    setAiMessage("正在保存到本机...", "info");
    const response = await fetch("/api/config/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: els.llmProvider.value,
        apiKey,
        baseUrl: els.deepseekBaseUrl.value.trim() || "https://api.deepseek.com",
        model: els.deepseekModel.value.trim() || "deepseek-chat",
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "保存失败");
    els.deepseekKey.value = "";
    els.aiStatus.textContent = "已配置";
    els.aiStatus.className = "mini-badge status-tag won";
    setAiMessage(`已保存，${data.provider || "模型"} / ${data.model}`, "good");
    return true;
  } catch (error) {
    setAiMessage(`保存失败：${error.message}`, "bad");
    return false;
  }
}

async function runDeepseekAnalysis() {
  const text = els.intelText.value.trim();
  if (!text) {
    setAiMessage("请先粘贴情报文本。", "warn");
    return;
  }
  if (els.deepseekKey.value.trim()) {
    const saved = await saveDeepseekConfig();
    if (!saved) return;
  }

  const selected = getSelectedMatchContext();
  const localFactors = mineFactors(text, Number(els.sourceReliability.value));
  els.deepseekAnalyzeBtn.disabled = true;
  els.deepseekAnalyzeBtn.textContent = "分析中...";
  setAiMessage("模型正在分析风险因子。", "info");
  try {
    const response = await fetch("/api/llm/risk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        matchId: selected.matchId,
        matchName: selected.matchName,
        pickName: selected.pickName,
        localFactors,
        portfolio: buildAiPortfolioSummary(),
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "模型请求失败");
    const insight = normalizeAiInsight({
      id: makeId(),
      matchId: selected.matchId,
      createdAt: new Date().toISOString(),
      model: data._meta?.model || els.deepseekModel.value,
      summary: data.summary,
      upsetRiskScore: data.upsetRiskScore,
      probabilityAdjustment: data.probabilityAdjustment,
      hedgeTrigger: data.hedgeTrigger,
      factors: data.factors,
      strategyNotes: data.strategyNotes,
    });
    state.aiInsights.unshift(insight);
    persistAndRender();
    setAiMessage(`AI 分析完成，风险分 ${NUMBER.format(insight.upsetRiskScore)}。`, "good");
  } catch (error) {
    setAiMessage(`AI 分析失败：${error.message}`, "bad");
    if (String(error.message).includes("not configured")) {
      els.aiStatus.textContent = "未配置";
      els.aiStatus.className = "mini-badge status-tag open";
    }
  } finally {
    els.deepseekAnalyzeBtn.disabled = false;
    els.deepseekAnalyzeBtn.textContent = "模型分析";
  }
}

async function runWebIntelRefresh() {
  if (els.deepseekKey.value.trim()) {
    const saved = await saveDeepseekConfig();
    if (!saved) return;
  }
  const selected = getSelectedMatchContext();
  els.refreshIntelBtn.disabled = true;
  els.refreshIntelBtn.textContent = "刷新中...";
  setAiMessage("正在搜索公开新闻并生成情报文本。", "info");
  try {
    const response = await fetch("/api/intel/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: selected.matchId,
        matchName: selected.matchName,
        pickName: selected.pickName,
        query: els.intelText.value.trim().slice(0, 120),
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "刷新失败");
    const record = normalizeWebIntel({
      id: makeId(),
      matchId: selected.matchId,
      createdAt: new Date().toISOString(),
      summary: data.summary,
      searchQuery: data.searchQuery,
      intelText: data.intelText,
      sources: data.sources || data.rawSources || [],
      nextSteps: data.nextSteps,
    });
    state.webIntel.unshift(record);
    els.intelText.value = record.intelText;
    persistAndRender();
    setAiMessage(`已生成网络情报，引用 ${record.sources.length} 个来源。`, "good");
  } catch (error) {
    setAiMessage(`网络情报刷新失败：${error.message}`, "bad");
  } finally {
    els.refreshIntelBtn.disabled = false;
    els.refreshIntelBtn.textContent = "刷新网络情报";
  }
}

async function runOpenBetsIntelRefresh() {
  if (els.deepseekKey.value.trim()) {
    const saved = await saveDeepseekConfig();
    if (!saved) return;
  }
  const openBets = buildOpenBetsSearchPayload();
  if (!openBets.length) {
    setAiMessage("当前没有未结算下注记录。", "warn");
    return;
  }
  els.refreshOpenBetsBtn.disabled = true;
  els.refreshOpenBetsBtn.textContent = "组合刷新中...";
  setAiMessage(`正在搜索 ${openBets.length} 条未结算下注的相关球队/国家信息。`, "info");
  try {
    const response = await fetch("/api/intel/portfolio-refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        openBets,
        query: els.intelText.value.trim().slice(0, 120),
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "组合刷新失败");
    const record = normalizeWebIntel({
      id: makeId(),
      matchId: "portfolio",
      createdAt: new Date().toISOString(),
      summary: data.summary,
      searchQuery: data.searchQuery,
      intelText: data.intelText,
      sources: data.sources || data.rawSources || [],
      nextSteps: data.nextSteps,
    });
    state.webIntel.unshift(record);
    els.intelMatch.value = "portfolio";
    els.intelText.value = record.intelText;
    persistAndRender();
    setAiMessage(`已刷新未结算组合，引用 ${record.sources.length} 个相关来源。`, "good");
  } catch (error) {
    setAiMessage(`未结算组合刷新失败：${error.message}`, "bad");
  } finally {
    els.refreshOpenBetsBtn.disabled = false;
    els.refreshOpenBetsBtn.textContent = "刷新未结算组合";
  }
}

function buildOpenBetsSearchPayload() {
  return state.bets
    .filter((bet) => bet.status === "open")
    .map((bet) => ({
      id: bet.id,
      matchName: bet.matchName,
      pickName: bet.pickName,
      marketType: bet.marketType,
      matchDate: bet.matchDate,
      stake: bet.actualOutflow,
      maxPayout: bet.maxPayout,
      subjectiveProb: bet.subjectiveProb,
      correlationGroup: bet.correlationGroup,
      notes: bet.notes,
    }));
}

function setAiMessage(message, tone = "info") {
  els.aiConfigMessage.textContent = message;
  els.aiConfigMessage.className = `fine-print amount-${tone === "bad" ? "negative" : "positive"}`;
  if (tone === "info" || tone === "warn") {
    els.aiConfigMessage.className = "fine-print";
  }
}

function getSelectedMatchContext() {
  const matchId = els.intelMatch.value || "portfolio";
  const bet = state.bets.find((item) => item.id === matchId);
  return {
    matchId,
    matchName: bet ? bet.matchName : "全部组合",
    pickName: bet ? bet.pickName : "组合层面",
  };
}

function buildAiPortfolioSummary() {
  const analytics = buildAnalytics();
  return {
    bankroll: state.bankroll,
    riskProfile: state.riskProfile,
    openExposure: analytics.openExposure,
    expectedProfit: Math.round(analytics.expectedProfit),
    openRiskWeighted: Math.round(analytics.openRiskWeighted * 100),
    stopLoss: state.stopLoss,
    hedgeOdds: state.hedgeOdds,
    openBets: analytics.open.map((bet) => ({
      matchName: bet.matchName,
      pickName: bet.pickName,
      outflow: bet.actualOutflow,
      maxPayout: bet.maxPayout,
      adjustedProb: Math.round(bet.adjustedProb),
      expectedProfit: Math.round(bet.expectedProfit),
      riskScore: Math.round(bet.riskScore * 100),
    })),
  };
}

function mineFactors(text, reliability = 0.75) {
  const cleanText = String(text || "").trim();
  if (!cleanText) return [];
  const sentences = cleanText
    .split(/[。！？!?；;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const found = [];
  for (const sentence of sentences) {
    for (const rule of factorRules) {
      const matched = rule.words.filter((word) => sentence.includes(word));
      if (!matched.length) continue;
      const severityBoost = severeWords.some((word) => sentence.includes(word)) ? 1.35 : 1;
      const density = Math.min(1.4, 0.8 + matched.length * 0.16);
      const severity = 6.5 * rule.weight * severityBoost * density;
      found.push({
        id: makeId(),
        key: rule.key,
        label: rule.label,
        snippet: sentence,
        matched,
        score: Math.round(severity * reliability * 10) / 10,
      });
    }
  }

  const merged = new Map();
  for (const factor of found) {
    const key = `${factor.key}:${factor.snippet}`;
    if (!merged.has(key) || merged.get(key).score < factor.score) {
      merged.set(key, factor);
    }
  }
  return [...merged.values()];
}

function saveSettings() {
  state.bankroll = finite(document.querySelector("#bankroll").value, state.bankroll);
  state.perMatchCapPct = finite(document.querySelector("#perMatchCapPct").value, state.perMatchCapPct);
  state.stopLoss = finite(document.querySelector("#stopLoss").value, state.stopLoss);
  state.hedgeOdds = finite(document.querySelector("#hedgeOdds").value, state.hedgeOdds);
  state.riskProfile = document.querySelector("#riskProfile").value;
  state.maxPortfolioRiskPct = finite(document.querySelector("#maxPortfolioRiskPct").value, state.maxPortfolioRiskPct);
  persistAndRender();
}

function syncSettingsForm() {
  document.querySelector("#bankroll").value = state.bankroll;
  document.querySelector("#perMatchCapPct").value = state.perMatchCapPct;
  document.querySelector("#stopLoss").value = state.stopLoss;
  document.querySelector("#hedgeOdds").value = state.hedgeOdds;
  document.querySelector("#riskProfile").value = state.riskProfile;
  document.querySelector("#maxPortfolioRiskPct").value = state.maxPortfolioRiskPct;
}

function exportCsv() {
  const header = [
    "比赛",
    "日期",
    "选择",
    "玩法",
    "下注金额",
    "最高可中",
    "实际支出",
    "实际收入",
    "主观胜率",
    "状态",
    "分组",
    "备注",
  ];
  const rows = state.bets.map((bet) => [
    bet.matchName,
    bet.matchDate,
    bet.pickName,
    bet.marketType,
    bet.stake,
    bet.maxPayout,
    bet.actualOutflow,
    bet.actualIncome,
    bet.subjectiveProb,
    statusMeta[bet.status].label,
    bet.correlationGroup,
    bet.notes,
  ]);
  downloadText(
    "betdogeye-ledger.csv",
    [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"),
    "text/csv;charset=utf-8"
  );
}

function exportJson() {
  downloadText("betdogeye-backup.json", JSON.stringify(state, null, 2), "application/json");
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = normalizeState(JSON.parse(String(reader.result)));
      Object.assign(state, imported);
      syncSettingsForm();
      resetBetForm();
      persistAndRender();
    } catch (error) {
      alert("导入失败：JSON 格式不正确。");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file, "utf-8");
}

function buildCashflow(bets) {
  let total = 0;
  return bets
    .filter((bet) => bet.status !== "open")
    .sort((a, b) => a.matchDate.localeCompare(b.matchDate))
    .map((bet) => {
      total += bet.actualIncome - bet.actualOutflow;
      return {
        date: bet.matchDate,
        value: total,
      };
    });
}

function groupSum(items, keyFn, valueKey) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, (map.get(key) || 0) + Number(item[valueKey] || 0));
  }
  return [...map].map(([name, value]) => ({ name, value }));
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function empty(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function sum(items, key) {
  return items.reduce((acc, item) => acc + Number(key ? item[key] : item || 0), 0);
}

function finite(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function money(value) {
  return MONEY.format(Number(value || 0));
}

function signedMoney(value) {
  const amount = Number(value || 0);
  return `${amount >= 0 ? "+" : "-"}${money(Math.abs(amount))}`;
}

function formatPct(value) {
  return `${NUMBER.format(Number(value || 0) * 100)}%`;
}

function shortName(name) {
  return String(name).length > 12 ? `${String(name).slice(0, 12)}…` : String(name);
}

function makeId() {
  return `id_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeSvg(value) {
  return escapeHtml(value);
}
