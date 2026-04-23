import { useState, useRef, useEffect } from "react";
import KNOWLEDGE_BASE from "@data/knowledgeBase.json";

// ============================================================
// V3: Function Call版本
// 在V2(RAG)基础上，新增：
// - 3个计算函数（养老金测算、缺口分析、方案推荐）
// - AI自动识别意图并调用函数
// - UI展示函数调用过程
// ============================================================

const MINIMAX_API_KEY = "YOUR_MINIMAX_API_KEY";
const MINIMAX_API_URL = "https://api.minimax.io/v1/chat/completions";
const MINIMAX_MODEL = "MiniMax-M2";

// ============================================================
// 🧮 计算函数（精确计算，不依赖AI估算）
// ============================================================

// 各城市社平工资数据（2024年，简化版）
const CITY_AVG_SALARY = {
  北京: 13438, 上海: 12895, 广州: 11262, 深圳: 12547,
  杭州: 11281, 成都: 8817, 武汉: 9192, 南京: 11072,
  重庆: 7900, 西安: 8280, 天津: 9450, 苏州: 10680,
  默认: 8900,
};

// 计发月数
const PAYMENT_MONTHS = { 50: 195, 55: 170, 60: 139, 65: 101 };

// 函数1: 基本养老金测算
function calcBasicPension(params) {
  const { age, gender, salary, city, yearsWorked } = params;

  // 确定退休年龄（简化：男60，女55）
  const retireAge = gender === "男" ? 60 : 55;
  const currentAge = age;
  const workYearsTotal = yearsWorked || (retireAge - currentAge + (currentAge > 22 ? currentAge - 22 : 0));
  const paymentYears = Math.min(workYearsTotal, retireAge - 22);

  // 当地社平工资
  const cityKey = Object.keys(CITY_AVG_SALARY).find((k) => city?.includes(k)) || "默认";
  const avgSalary = CITY_AVG_SALARY[cityKey];

  // 缴费指数 = 个人月薪 / 社平工资（封顶3，保底0.6）
  const rawIndex = salary / avgSalary;
  const payIndex = Math.max(0.6, Math.min(3, rawIndex));

  // 基础养老金 = 社平工资 × (1+缴费指数) / 2 × 缴费年限 × 1%
  const basicPension = avgSalary * (1 + payIndex) / 2 * paymentYears * 0.01;

  // 个人账户累计 = 月薪 × 8% × 12 × 缴费年限（简化，未计利息）
  const personalAccount = salary * 0.08 * 12 * paymentYears;

  // 计发月数
  const months = PAYMENT_MONTHS[retireAge] || 139;
  const personalPension = personalAccount / months;

  // 合计
  const totalPension = basicPension + personalPension;

  return {
    functionName: "养老金测算",
    input: { age, gender, salary, city, paymentYears, retireAge },
    result: {
      城市社平工资: avgSalary,
      缴费指数: Math.round(payIndex * 100) / 100,
      缴费年限: paymentYears,
      法定退休年龄: retireAge,
      基础养老金: Math.round(basicPension),
      个人账户余额: Math.round(personalAccount),
      计发月数: months,
      个人账户养老金: Math.round(personalPension),
      养老金合计: Math.round(totalPension),
    },
  };
}

// 函数2: 养老缺口分析
function calcPensionGap(params) {
  const { salary, totalPension, targetRate } = params;
  const rate = targetRate || 0.7;
  const targetPension = salary * rate;
  const gap = targetPension - totalPension;

  return {
    functionName: "养老缺口分析",
    input: { 当前月薪: salary, 目标替代率: `${rate * 100}%`, 预计养老金: totalPension },
    result: {
      目标月养老金: Math.round(targetPension),
      预计基本养老金: Math.round(totalPension),
      月缺口: Math.round(Math.max(0, gap)),
      年缺口: Math.round(Math.max(0, gap) * 12),
      缺口状态: gap > 0 ? `每月缺口 ¥${Math.round(gap)}` : "已达标 ✅",
      建议补充渠道: gap > 0 ? "个人养老金账户 + 商业养老年金险" : "可考虑提高目标替代率至80%",
    },
  };
}

// 函数3: 补充方案推荐
function calcSupplementPlan(params) {
  const { age, gap, retireAge } = params;
  const yearsToRetire = (retireAge || 60) - age;
  const monthlyGap = gap;

  // 方案1: 个人养老金账户
  const annualPersonal = 12000;
  const personalTotal = annualPersonal * yearsToRetire;
  const personalMonthly = personalTotal / (PAYMENT_MONTHS[retireAge || 60] || 139);

  // 方案2: 商业养老年金（假设月缴2000，预定利率3%）
  const monthlyPremium = 2000;
  const commercialTotal = monthlyPremium * 12 * Math.min(yearsToRetire, 20);
  const commercialMonthly = commercialTotal * 0.03 / 12 + commercialTotal / ((retireAge || 60) - age + 20) / 12;

  // 方案3: 组合方案
  const comboMonthly = personalMonthly + commercialMonthly;
  const coverageRate = Math.min(100, Math.round((comboMonthly / monthlyGap) * 100));

  return {
    functionName: "补充方案推荐",
    input: { 年龄: age, 月缺口: monthlyGap, 距退休年数: yearsToRetire },
    result: {
      "方案一_个人养老金": {
        年缴费: `¥${annualPersonal}`,
        累计投入: `¥${personalTotal.toLocaleString()}`,
        预估月领: `¥${Math.round(personalMonthly)}`,
        税收优惠: "缴费时抵扣个税，领取时按3%征税",
      },
      "方案二_商业养老年金": {
        月缴费: `¥${monthlyPremium}`,
        累计投入: `¥${commercialTotal.toLocaleString()}`,
        预估月领: `¥${Math.round(commercialMonthly)}`,
        特点: "保证领取20年，终身领取",
      },
      "方案三_组合推荐": {
        组合月领: `¥${Math.round(comboMonthly)}`,
        缺口覆盖率: `${coverageRate}%`,
        评估: coverageRate >= 80 ? "可有效填补养老缺口 ✅" : "建议适当增加缴费金额",
      },
    },
  };
}

// ============================================================
// 🔍 意图识别 + 参数提取（前端简化版）
// ============================================================
function detectIntent(message, conversationHistory) {
  const msg = message.toLowerCase();

  // 从对话历史中提取用户信息
  const allText = conversationHistory.map((m) => m.content).join(" ") + " " + message;
  const ageMatch = allText.match(/(\d{2})\s*岁/);
  const salaryMatch = allText.match(/(\d+\.?\d*)\s*[万w]/i) || allText.match(/月[薪收入工资]+\s*(\d+)/);
  const cityMatch = allText.match(/(北京|上海|广州|深圳|杭州|成都|武汉|南京|重庆|西安|天津|苏州)/);
  const genderMatch = allText.match(/(男|女)/);

  const age = ageMatch ? parseInt(ageMatch[1]) : null;
  let salary = null;
  if (salaryMatch) {
    salary = parseFloat(salaryMatch[1]);
    if (salary < 100) salary = salary * 10000; // "1.5万" -> 15000
  }
  const city = cityMatch ? cityMatch[1] : null;
  const gender = genderMatch ? genderMatch[1] : null;

  // 判断是否有足够信息进行计算
  const hasBasicInfo = age && salary && gender;

  // 意图识别
  if (hasBasicInfo && (msg.includes("算") || msg.includes("测") || msg.includes("多少") || msg.includes("领"))) {
    return { intent: "calculate", params: { age, salary, city, gender } };
  }
  if (hasBasicInfo && (msg.includes("缺口") || msg.includes("够不够") || msg.includes("差") || msg.includes("不够"))) {
    return { intent: "gap", params: { age, salary, city, gender } };
  }
  if (hasBasicInfo && (msg.includes("方案") || msg.includes("推荐") || msg.includes("补充") || msg.includes("怎么补"))) {
    return { intent: "recommend", params: { age, salary, city, gender } };
  }

  // 包含基本信息但没有明确意图 -> 做完整分析
  if (hasBasicInfo) {
    return { intent: "full_analysis", params: { age, salary, city, gender } };
  }

  return { intent: "chat", params: {} };
}

// 执行函数调用
function executeFunctionCall(intent, params) {
  const results = [];

  if (intent === "calculate" || intent === "full_analysis") {
    const pensionResult = calcBasicPension(params);
    results.push(pensionResult);

    if (intent === "full_analysis") {
      const gapResult = calcPensionGap({
        salary: params.salary,
        totalPension: pensionResult.result.养老金合计,
      });
      results.push(gapResult);

      if (gapResult.result.月缺口 > 0) {
        const planResult = calcSupplementPlan({
          age: params.age,
          gap: gapResult.result.月缺口,
          retireAge: pensionResult.result.法定退休年龄,
        });
        results.push(planResult);
      }
    }
  }

  if (intent === "gap") {
    const pensionResult = calcBasicPension(params);
    results.push(pensionResult);
    const gapResult = calcPensionGap({
      salary: params.salary,
      totalPension: pensionResult.result.养老金合计,
    });
    results.push(gapResult);
  }

  if (intent === "recommend") {
    const pensionResult = calcBasicPension(params);
    const gapResult = calcPensionGap({
      salary: params.salary,
      totalPension: pensionResult.result.养老金合计,
    });
    results.push(gapResult);
    if (gapResult.result.月缺口 > 0) {
      const planResult = calcSupplementPlan({
        age: params.age,
        gap: gapResult.result.月缺口,
        retireAge: pensionResult.result.法定退休年龄,
      });
      results.push(planResult);
    }
  }

  return results;
}

// ============================================================
// RAG检索（同V2）
// ============================================================
function retrieveKnowledge(query) {
  const queryLower = query.toLowerCase();
  const scored = KNOWLEDGE_BASE.map((doc) => {
    let score = 0;
    doc.keywords.forEach((kw) => {
      if (queryLower.includes(kw)) score += 3;
    });
    return { ...doc, score };
  });
  return scored.filter((d) => d.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
}

// ============================================================
// System Prompt（含函数调用结果）
// ============================================================
function buildSystemPrompt(retrievedDocs, functionResults) {
  let prompt = `你是"安享养老"的AI规划助手，帮用户做养老金测算和咨询。

## 对话规则
- 用户打招呼时，热情回应并简要介绍你能做什么
- 用户问养老相关问题但没给信息时，说明需要什么，给出示例："比如：女，28岁，北京，月薪1.5万"
- 收到计算结果后，用通俗易懂的语言解读数据，突出关键数字
- 每次回复不超过300字
- 用emoji让对话亲切
- 不要在一轮对话中问超过一个问题

## 重要：计算结果解读
如果下方有【计算结果】，请基于这些精确数据来回答，不要自己重新计算。
用通俗的语言解读这些数字，告诉用户意味着什么，并给出建议。`;

  if (functionResults && functionResults.length > 0) {
    prompt += `\n\n## 【计算结果】（由计算引擎精确计算，请直接引用这些数据）\n`;
    functionResults.forEach((fr) => {
      prompt += `\n### ${fr.functionName}\n`;
      prompt += `输入参数：${JSON.stringify(fr.input, null, 2)}\n`;
      prompt += `计算结果：${JSON.stringify(fr.result, null, 2)}\n`;
    });
  }

  if (retrievedDocs.length > 0) {
    prompt += `\n\n## 【参考资料】\n`;
    retrievedDocs.forEach((doc, i) => {
      prompt += `\n### 资料${i + 1}：${doc.title}（${doc.category}）\n${doc.content}\n`;
    });
  }

  return prompt;
}

// ============================================================
// Demo响应
// ============================================================
const DEMO_RESPONSES = [
  {
    text: `您好！我是您的养老规划助手 😊

我可以帮您：
- 🧮 精确测算养老金
- 📊 分析养老缺口
- 💡 推荐补充方案

请告诉我您的基本信息，比如：女，28岁，北京，月薪1.5万`,
    sources: [],
    functionCalls: [],
  },
];

const QUICK_QUESTIONS = [
  { icon: "🧮", text: "我是女生，28岁，在北京工作，月薪1.5万，帮我算养老金" },
  { icon: "📊", text: "分析一下我的养老缺口" },
  { icon: "💡", text: "推荐养老方案" },
  { icon: "📋", text: "社保断缴怎么办" },
];

const CATEGORY_COLORS = {
  政策法规: { bg: "#e6f7ff", color: "#0958d9", border: "#91caff" },
  计算规则: { bg: "#fff7e6", color: "#d46b08", border: "#ffd591" },
  公司产品: { bg: "#f6ffed", color: "#389e0d", border: "#b7eb8f" },
  常见问题: { bg: "#f9f0ff", color: "#722ed1", border: "#d3adf7" },
};

// ============================================================
// Main Component
// ============================================================
export default function PensionAIv3() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "您好！我是**安享养老**智能规划助手 🏡\n\n我可以帮您：\n- 🧮 精确测算养老金（Function Call计算引擎）\n- 📊 分析养老缺口\n- 💡 推荐补充方案\n- 📋 解答政策问题（RAG知识库）\n\n告诉我您的年龄、性别、月薪和城市，我来帮您算~",
      sources: [],
      retrievedDocs: [],
      functionCalls: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [demoIndex, setDemoIndex] = useState(0);
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiKey, setApiKey] = useState(MINIMAX_API_KEY);
  const [isUsingRealApi, setIsUsingRealApi] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function callMiniMaxAPI(userMessages, retrievedDocs, functionResults) {
    const systemPrompt = buildSystemPrompt(retrievedDocs, functionResults);
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...userMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const response = await fetch(MINIMAX_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) throw new Error(`API Error: ${response.status}`);

    const data = await response.json();
    let content = data.choices[0].message.content;
    content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    return content;
  }

  async function handleSend(text) {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const retrievedDocs = retrieveKnowledge(messageText);
    const { intent, params } = detectIntent(messageText, messages);
    const functionResults = intent !== "chat" ? executeFunctionCall(intent, params) : [];

    const newMessages = [
      ...messages,
      { role: "user", content: messageText, sources: [], retrievedDocs: [], functionCalls: [] },
    ];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      let reply;
      let sources = retrievedDocs.map((d) => ({ title: d.title, category: d.category }));

      if (isUsingRealApi && apiKey !== "YOUR_MINIMAX_API_KEY") {
        reply = await callMiniMaxAPI(newMessages, retrievedDocs, functionResults);
      } else {
        await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
        if (functionResults.length > 0) {
          const pr = functionResults.find((f) => f.functionName === "养老金测算");
          const gr = functionResults.find((f) => f.functionName === "养老缺口分析");
          const sr = functionResults.find((f) => f.functionName === "补充方案推荐");
          let text = "";
          if (pr) {
            text += `根据您的信息，帮您精确测算了一下 🧮\n\n`;
            text += `📊 **基本养老金预估：**\n`;
            text += `- 基础养老金：约 ¥${pr.result.基础养老金.toLocaleString()}/月\n`;
            text += `- 个人账户养老金：约 ¥${pr.result.个人账户养老金.toLocaleString()}/月\n`;
            text += `- **合计：约 ¥${pr.result.养老金合计.toLocaleString()}/月**\n`;
          }
          if (gr) {
            text += `\n💡 **养老缺口：**\n`;
            text += `- 目标养老金（70%替代率）：¥${gr.result.目标月养老金.toLocaleString()}/月\n`;
            text += `- **${gr.result.缺口状态}**\n`;
          }
          if (sr) {
            text += `\n🎯 **推荐组合方案：**\n`;
            text += `- 个人养老金 + 商业年金组合\n`;
            text += `- 预估可覆盖 **${sr.result.方案三_组合推荐.缺口覆盖率}** 的缺口\n`;
          }
          text += `\n⚠️ 以上由计算引擎精确计算，非AI估算。实际以社保部门核定为准。`;
          reply = text;
        } else {
          const demo = DEMO_RESPONSES[demoIndex % DEMO_RESPONSES.length];
          reply = demo.text;
          setDemoIndex((i) => i + 1);
        }
      }

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: reply,
          sources,
          retrievedDocs,
          functionCalls: functionResults,
        },
      ]);
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: `抱歉，连接出现问题：${err.message}\n\n请检查API Key或切换到演示模式。`,
          sources: [],
          retrievedDocs: [],
          functionCalls: [],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function toggleSection(key) {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function renderContent(text) {
    return text.split("\n").map((line, i) => {
      let processed = line
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#d4380d">$1</strong>')
        .replace(/\*(.*?)\*/g, "<em>$1</em>");
      if (line.startsWith("- ")) processed = "　• " + processed.slice(2);
      processed = processed.replace(/\[来源[：:][^\]]*\]/g, "");
      return (
        <span key={i}>
          <span dangerouslySetInnerHTML={{ __html: processed }} />
          {i < text.split("\n").length - 1 && <br />}
        </span>
      );
    });
  }

  // ============================================================
  // Function Call结果卡片
  // ============================================================
  function renderFunctionCard(fc, idx, msgIdx) {
    const key = `fc-${msgIdx}-${idx}`;
    const isExpanded = expandedSections[key];
    return (
      <div key={idx} style={styles.fcCard}>
        <div style={styles.fcHeader} onClick={() => toggleSection(key)}>
          <span style={styles.fcIcon}>⚡</span>
          <span style={styles.fcName}>调用了 {fc.functionName}</span>
          <span style={styles.fcToggle}>{isExpanded ? "▲" : "▼"}</span>
        </div>
        {isExpanded && (
          <div style={styles.fcBody}>
            <div style={styles.fcSection}>
              <div style={styles.fcSectionTitle}>📥 输入参数</div>
              {Object.entries(fc.input).map(([k, v]) => (
                <div key={k} style={styles.fcRow}>
                  <span style={styles.fcKey}>{k}</span>
                  <span style={styles.fcValue}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                </div>
              ))}
            </div>
            <div style={styles.fcSection}>
              <div style={styles.fcSectionTitle}>📤 计算结果</div>
              {Object.entries(fc.result).map(([k, v]) => (
                <div key={k} style={styles.fcRow}>
                  <span style={styles.fcKey}>{k}</span>
                  <span style={styles.fcValue}>
                    {typeof v === "object" ? JSON.stringify(v, null, 1) : String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <div style={styles.bgGradient} />

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}><span style={styles.logoIcon}>🏡</span></div>
          <div>
            <div style={styles.headerTitle}>安享养老 · AI规划助手</div>
            <div style={styles.headerSub}>
              {isUsingRealApi ? "🟢 API已连接" : "🟡 演示模式"}
              {" · "}<span style={{ color: "#0958d9" }}>RAG</span>
              {" + "}<span style={{ color: "#d4380d" }}>Function Call</span>
            </div>
          </div>
        </div>
        <button style={styles.settingsBtn} onClick={() => setShowApiModal(true)}>⚙️</button>
      </div>

      {/* Stats */}
      <div style={styles.statBanner}>
        <div style={styles.statItem}>
          <div style={styles.statValue}>{KNOWLEDGE_BASE.length}</div>
          <div style={styles.statLabel}>知识库文档</div>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.statItem}>
          <div style={styles.statValue}>3</div>
          <div style={styles.statLabel}>计算函数</div>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.statItem}>
          <div style={styles.statValue}>V3</div>
          <div style={styles.statLabel}>RAG+FC</div>
        </div>
      </div>

      {/* Chat */}
      <div style={styles.chatArea}>
        {messages.map((msg, idx) => (
          <div key={idx}>
            <div style={{ ...styles.msgRow, justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              {msg.role === "assistant" && <div style={styles.avatarBot}>🤖</div>}
              <div style={msg.role === "user" ? styles.bubbleUser : styles.bubbleBot}>
                <div style={styles.msgText}>{renderContent(msg.content)}</div>

                {/* Function Call Cards */}
                {msg.role === "assistant" && msg.functionCalls && msg.functionCalls.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    {msg.functionCalls.map((fc, fi) => renderFunctionCard(fc, fi, idx))}
                  </div>
                )}

                {/* Sources */}
                {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                  <div style={styles.sourcesArea}>
                    <div style={styles.sourcesHeader} onClick={() => toggleSection(`src-${idx}`)}>
                      <span>📚</span>
                      <span style={styles.sourcesLabel}>参考了{msg.sources.length}份资料</span>
                      <span style={styles.sourcesToggle}>{expandedSections[`src-${idx}`] ? "▲" : "▼"}</span>
                    </div>
                    {expandedSections[`src-${idx}`] && (
                      <div style={styles.sourcesList}>
                        {msg.sources.map((src, si) => {
                          const c = CATEGORY_COLORS[src.category] || CATEGORY_COLORS["常见问题"];
                          return (
                            <div key={si} style={styles.sourceItem}>
                              <span style={{ ...styles.sourceTag, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                                {src.category}
                              </span>
                              <span style={styles.sourceTitle}>{src.title}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {msg.role === "user" && <div style={styles.avatarUser}>👤</div>}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ ...styles.msgRow, justifyContent: "flex-start" }}>
            <div style={styles.avatarBot}>🤖</div>
            <div style={styles.bubbleBot}>
              <div style={styles.typingArea}>
                <div style={styles.typingIndicator}>
                  <span style={{ ...styles.typingDot, animationDelay: "0s" }} />
                  <span style={{ ...styles.typingDot, animationDelay: "0.2s" }} />
                  <span style={{ ...styles.typingDot, animationDelay: "0.4s" }} />
                </div>
                <span style={styles.typingText}>正在调用计算引擎...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions */}
      {messages.length <= 1 && (
        <div style={styles.quickArea}>
          {QUICK_QUESTIONS.map((q, i) => (
            <button key={i} style={styles.quickBtn} onClick={() => handleSend(q.text)}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
              <span style={styles.quickIcon}>{q.icon}</span>
              <span style={styles.quickText}>{q.text}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={styles.inputArea}>
        <div style={styles.inputWrapper}>
          <input style={styles.input} value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="输入您的养老规划问题..." disabled={isLoading} />
          <button style={{ ...styles.sendBtn, opacity: input.trim() && !isLoading ? 1 : 0.4 }}
            onClick={() => handleSend()} disabled={!input.trim() || isLoading}>➤</button>
        </div>
        <div style={styles.poweredBy}>Powered by MiniMax AI + RAG + Function Call · V3</div>
      </div>

      {/* Modal */}
      {showApiModal && (
        <div style={styles.modalOverlay} onClick={() => setShowApiModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>⚙️ API 设置</div>
            <div style={styles.modalDesc}>
              输入 MiniMax API Key 启用真实AI对话。<br />
              <span style={{ fontSize: 12, color: "#999" }}>platform.minimax.io → API Keys</span>
            </div>
            <input style={styles.modalInput}
              value={apiKey === "YOUR_MINIMAX_API_KEY" ? "" : apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入 MiniMax API Key..." />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button style={styles.modalBtnPrimary}
                onClick={() => { setIsUsingRealApi(true); setShowApiModal(false); }}>连接 API</button>
              <button style={styles.modalBtnSecondary}
                onClick={() => { setIsUsingRealApi(false); setApiKey("YOUR_MINIMAX_API_KEY"); setShowApiModal(false); }}>演示模式</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap');
        @keyframes typingBounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-6px); opacity: 1; } }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        input::placeholder { color: #bfbfbf; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e8e8e8; border-radius: 4px; }
      `}</style>
    </div>
  );
}

// ============================================================
// Styles
// ============================================================
const styles = {
  root: { fontFamily: "'Noto Sans SC', -apple-system, sans-serif", width: "100%", maxWidth: 480, height: "100vh", margin: "0 auto", display: "flex", flexDirection: "column", background: "#faf7f4", position: "relative", overflow: "hidden" },
  bgGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 280, background: "linear-gradient(135deg, #fff1e6 0%, #ffe4cc 40%, #ffd6b0 100%)", zIndex: 0 },
  header: { position: "relative", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px" },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logo: { width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, #d4380d 0%, #fa541c 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(212,56,13,0.3)" },
  logoIcon: { fontSize: 22 },
  headerTitle: { fontSize: 17, fontWeight: 700, color: "#1a1a1a" },
  headerSub: { fontSize: 11, color: "#8c6d52", marginTop: 1 },
  settingsBtn: { background: "rgba(255,255,255,0.7)", border: "none", borderRadius: 12, width: 40, height: 40, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  statBanner: { position: "relative", zIndex: 10, margin: "4px 20px 12px", padding: "14px 20px", background: "linear-gradient(135deg, #d4380d 0%, #fa8c16 100%)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 20, boxShadow: "0 6px 24px rgba(212,56,13,0.25)" },
  statItem: { textAlign: "center" },
  statValue: { fontSize: 18, fontWeight: 700, color: "#fff" },
  statLabel: { fontSize: 10, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  statDivider: { width: 1, height: 32, background: "rgba(255,255,255,0.3)" },
  chatArea: { position: "relative", zIndex: 10, flex: 1, overflowY: "auto", padding: "8px 16px" },
  msgRow: { display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 14, animation: "fadeSlideUp 0.35s ease-out" },
  avatarBot: { width: 34, height: 34, borderRadius: 12, background: "linear-gradient(135deg, #fff5f0, #ffe7d6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0, border: "1px solid #ffd6b0" },
  avatarUser: { width: 34, height: 34, borderRadius: 12, background: "linear-gradient(135deg, #d4380d, #fa541c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 },
  bubbleBot: { maxWidth: "82%", padding: "12px 16px", background: "#ffffff", borderRadius: "18px 18px 18px 4px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", border: "1px solid #f0e8e0" },
  bubbleUser: { maxWidth: "78%", padding: "12px 16px", background: "linear-gradient(135deg, #d4380d, #fa541c)", borderRadius: "18px 18px 4px 18px", color: "#fff", boxShadow: "0 2px 8px rgba(212,56,13,0.25)" },
  msgText: { fontSize: 14, lineHeight: 1.65, color: "inherit" },
  // Function Call Card
  fcCard: { marginTop: 8, border: "1px solid #ffe0cc", borderRadius: 12, overflow: "hidden", background: "#fff9f5" },
  fcHeader: { display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", cursor: "pointer", userSelect: "none", background: "linear-gradient(135deg, #fff5ee, #fff0e5)" },
  fcIcon: { fontSize: 14 },
  fcName: { fontSize: 12, fontWeight: 600, color: "#d4380d" },
  fcToggle: { fontSize: 10, color: "#e8a080", marginLeft: "auto" },
  fcBody: { padding: "8px 12px" },
  fcSection: { marginBottom: 8 },
  fcSectionTitle: { fontSize: 11, fontWeight: 600, color: "#8c5a3a", marginBottom: 4 },
  fcRow: { display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px solid #f5ebe3" },
  fcKey: { fontSize: 11, color: "#8c7a6a" },
  fcValue: { fontSize: 11, color: "#333", fontWeight: 500, maxWidth: "60%", textAlign: "right", whiteSpace: "pre-wrap", wordBreak: "break-all" },
  // Sources
  sourcesArea: { marginTop: 10, borderTop: "1px solid #f0e8e0", paddingTop: 8 },
  sourcesHeader: { display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" },
  sourcesLabel: { fontSize: 12, color: "#8c6d52", fontWeight: 500 },
  sourcesToggle: { fontSize: 10, color: "#bfa88a", marginLeft: "auto" },
  sourcesList: { marginTop: 8 },
  sourceItem: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  sourceTag: { fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 500, flexShrink: 0 },
  sourceTitle: { fontSize: 12, color: "#5c3a1e" },
  // Typing
  typingArea: { display: "flex", alignItems: "center", gap: 10 },
  typingIndicator: { display: "flex", gap: 5, padding: "4px 0" },
  typingDot: { width: 7, height: 7, borderRadius: "50%", background: "#d4380d", display: "inline-block", animation: "typingBounce 1.2s infinite" },
  typingText: { fontSize: 12, color: "#bfa88a" },
  // Quick
  quickArea: { position: "relative", zIndex: 10, padding: "4px 16px 8px", display: "flex", flexWrap: "wrap", gap: 8 },
  quickBtn: { display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#ffffff", border: "1px solid #f0e0d0", borderRadius: 20, cursor: "pointer", transition: "all 0.2s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", flexShrink: 0 },
  quickIcon: { fontSize: 15 },
  quickText: { fontSize: 13, color: "#5c3a1e", fontWeight: 500 },
  // Input
  inputArea: { position: "relative", zIndex: 10, padding: "10px 16px 16px", background: "rgba(250,247,244,0.95)", borderTop: "1px solid #f0e8e0" },
  inputWrapper: { display: "flex", alignItems: "center", gap: 8, background: "#ffffff", borderRadius: 24, padding: "4px 6px 4px 18px", border: "1px solid #e8ddd2", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
  input: { flex: 1, border: "none", outline: "none", fontSize: 14, background: "transparent", color: "#333", fontFamily: "'Noto Sans SC', sans-serif", padding: "10px 0" },
  sendBtn: { width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #d4380d, #fa541c)", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  poweredBy: { textAlign: "center", fontSize: 10, color: "#c4a882", marginTop: 8 },
  // Modal
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)" },
  modal: { background: "#fff", borderRadius: 20, padding: "28px 24px", width: "90%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 },
  modalDesc: { fontSize: 13, color: "#666", lineHeight: 1.6, marginBottom: 16 },
  modalInput: { width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid #e8e0d8", fontSize: 13, outline: "none", fontFamily: "monospace", background: "#faf7f4", marginBottom: 4 },
  modalBtnPrimary: { flex: 1, padding: "12px 0", borderRadius: 12, background: "linear-gradient(135deg, #d4380d, #fa541c)", border: "none", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  modalBtnSecondary: { flex: 1, padding: "12px 0", borderRadius: 12, background: "#f5f0eb", border: "1px solid #e8ddd2", color: "#5c3a1e", fontSize: 14, fontWeight: 500, cursor: "pointer" },
};
