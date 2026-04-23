import { useState, useRef, useEffect } from "react";
import KNOWLEDGE_BASE from "@data/knowledgeBase.json";

// ============================================================
// V4: Memory版本
// 在V3(RAG+Function Call)基础上，新增：
// - 用户画像持久化（localStorage）
// - 自动提取+更新画像
// - UI展示用户画像卡片
// - 画像注入prompt
// - 用户确认/修改画像
// ============================================================

const MINIMAX_API_KEY = "YOUR_MINIMAX_API_KEY";
const MINIMAX_API_URL = "https://api.minimax.io/v1/chat/completions";
const MINIMAX_MODEL = "MiniMax-M2";

// ============================================================
// 📝 用户画像管理
// ============================================================
const PROFILE_STORAGE_KEY = "pension_ai_user_profile";
const HISTORY_STORAGE_KEY = "pension_ai_calc_history";

function loadProfile() {
  try {
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}

function saveProfile(profile) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

function loadCalcHistory() {
  try {
    const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function saveCalcHistory(history) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(-5)));
}

// 从用户消息中提取画像信息
function extractProfileFromMessage(message, currentProfile) {
  const updated = { ...currentProfile };
  let hasUpdate = false;

  const ageMatch = message.match(/(\d{2})\s*岁/);
  if (ageMatch) { updated.age = parseInt(ageMatch[1]); hasUpdate = true; }

  const genderMatch = message.match(/(男|女)/);
  if (genderMatch) { updated.gender = genderMatch[1]; hasUpdate = true; }

  const salaryMatch = message.match(/(\d+\.?\d*)\s*[万w]/i) || message.match(/月[薪收入工资]+\s*(\d+)/);
  if (salaryMatch) {
    let val = parseFloat(salaryMatch[1]);
    if (val < 100) val = val * 10000;
    updated.salary = val;
    hasUpdate = true;
  }

  // 涨薪检测
  const raiseMatch = message.match(/[涨加升调][薪资工资到至]+\s*(\d+\.?\d*)\s*[万w]?/i);
  if (raiseMatch) {
    let val = parseFloat(raiseMatch[1]);
    if (val < 100) val = val * 10000;
    updated.salary = val;
    hasUpdate = true;
  }

  const cityMatch = message.match(/(北京|上海|广州|深圳|杭州|成都|武汉|南京|重庆|西安|天津|苏州)/);
  if (cityMatch) { updated.city = cityMatch[1]; hasUpdate = true; }

  if (hasUpdate) {
    updated.lastUpdated = new Date().toLocaleDateString("zh-CN");
  }

  return { profile: updated, hasUpdate };
}

// 判断画像是否完整
function isProfileComplete(profile) {
  return profile.age && profile.gender && profile.salary;
}

// ============================================================
// 🧮 计算函数（同V3）
// ============================================================
const CITY_AVG_SALARY = {
  北京: 13438, 上海: 12895, 广州: 11262, 深圳: 12547,
  杭州: 11281, 成都: 8817, 武汉: 9192, 南京: 11072,
  重庆: 7900, 西安: 8280, 天津: 9450, 苏州: 10680,
  默认: 8900,
};

const PAYMENT_MONTHS = { 50: 195, 55: 170, 60: 139, 65: 101 };

function calcBasicPension(params) {
  const { age, gender, salary, city } = params;
  const retireAge = gender === "男" ? 60 : 55;
  const paymentYears = Math.min(retireAge - 22, retireAge - age + (age > 22 ? age - 22 : 0));
  const cityKey = Object.keys(CITY_AVG_SALARY).find((k) => city?.includes(k)) || "默认";
  const avgSalary = CITY_AVG_SALARY[cityKey];
  const payIndex = Math.max(0.6, Math.min(3, salary / avgSalary));
  const basicPension = avgSalary * (1 + payIndex) / 2 * paymentYears * 0.01;
  const personalAccount = salary * 0.08 * 12 * paymentYears;
  const months = PAYMENT_MONTHS[retireAge] || 139;
  const personalPension = personalAccount / months;
  const totalPension = basicPension + personalPension;

  return {
    functionName: "养老金测算",
    input: { age, gender, salary, city: city || "默认", paymentYears, retireAge },
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
    },
  };
}

function calcSupplementPlan(params) {
  const { age, gap, retireAge } = params;
  const yearsToRetire = (retireAge || 60) - age;
  const annualPersonal = 12000;
  const personalTotal = annualPersonal * yearsToRetire;
  const personalMonthly = personalTotal / (PAYMENT_MONTHS[retireAge || 60] || 139);
  const monthlyPremium = 2000;
  const commercialTotal = monthlyPremium * 12 * Math.min(yearsToRetire, 20);
  const commercialMonthly = commercialTotal * 0.03 / 12 + commercialTotal / ((retireAge || 60) - age + 20) / 12;
  const comboMonthly = personalMonthly + commercialMonthly;
  const coverageRate = Math.min(100, Math.round((comboMonthly / gap) * 100));
  return {
    functionName: "补充方案推荐",
    input: { 年龄: age, 月缺口: gap, 距退休年数: yearsToRetire },
    result: {
      "方案一_个人养老金": { 年缴费: `¥${annualPersonal}`, 累计投入: `¥${personalTotal.toLocaleString()}`, 预估月领: `¥${Math.round(personalMonthly)}` },
      "方案二_商业养老年金": { 月缴费: `¥${monthlyPremium}`, 累计投入: `¥${commercialTotal.toLocaleString()}`, 预估月领: `¥${Math.round(commercialMonthly)}` },
      "方案三_组合推荐": { 组合月领: `¥${Math.round(comboMonthly)}`, 缺口覆盖率: `${coverageRate}%` },
    },
  };
}

function detectIntent(message, profile) {
  const msg = message.toLowerCase();
  const params = { ...profile };
  const hasInfo = isProfileComplete(params);

  if (hasInfo && (msg.includes("算") || msg.includes("测") || msg.includes("多少") || msg.includes("领"))) return { intent: "calculate", params };
  if (hasInfo && (msg.includes("缺口") || msg.includes("够不够") || msg.includes("差") || msg.includes("不够"))) return { intent: "gap", params };
  if (hasInfo && (msg.includes("方案") || msg.includes("推荐") || msg.includes("补充"))) return { intent: "recommend", params };
  if (hasInfo && !msg.includes("什么") && !msg.includes("吗") && !msg.includes("怎么办")) return { intent: "full_analysis", params };
  return { intent: "chat", params };
}

function executeFunctionCall(intent, params) {
  const results = [];
  if (intent === "calculate" || intent === "full_analysis") {
    const pr = calcBasicPension(params); results.push(pr);
    if (intent === "full_analysis") {
      const gr = calcPensionGap({ salary: params.salary, totalPension: pr.result.养老金合计 }); results.push(gr);
      if (gr.result.月缺口 > 0) { results.push(calcSupplementPlan({ age: params.age, gap: gr.result.月缺口, retireAge: pr.result.法定退休年龄 })); }
    }
  }
  if (intent === "gap") {
    const pr = calcBasicPension(params); results.push(pr);
    results.push(calcPensionGap({ salary: params.salary, totalPension: pr.result.养老金合计 }));
  }
  if (intent === "recommend") {
    const pr = calcBasicPension(params);
    const gr = calcPensionGap({ salary: params.salary, totalPension: pr.result.养老金合计 }); results.push(gr);
    if (gr.result.月缺口 > 0) { results.push(calcSupplementPlan({ age: params.age, gap: gr.result.月缺口, retireAge: pr.result.法定退休年龄 })); }
  }
  return results;
}

// RAG
function retrieveKnowledge(query) {
  const q = query.toLowerCase();
  return KNOWLEDGE_BASE.map((doc) => {
    let score = 0;
    doc.keywords.forEach((kw) => { if (q.includes(kw)) score += 3; });
    return { ...doc, score };
  }).filter((d) => d.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
}

// Prompt
function buildSystemPrompt(retrievedDocs, functionResults, profile) {
  let prompt = `你是"安享养老"的AI规划助手。

## 对话规则
- 用户打招呼时，热情回应并简要介绍你能做什么
- 用户问养老相关问题但没给信息时，说明需要什么
- 收到计算结果后，用通俗语言解读
- 每次回复不超过300字
- 用emoji让对话亲切
- 不要在一轮对话中问超过一个问题

## 重要：如果有计算结果，直接引用数据，不要自己重新算`;

  if (isProfileComplete(profile)) {
    prompt += `\n\n## 【用户画像】（已记住，无需再次询问）\n`;
    prompt += `- 年龄：${profile.age}岁\n- 性别：${profile.gender}\n- 月薪：¥${profile.salary?.toLocaleString()}\n`;
    if (profile.city) prompt += `- 城市：${profile.city}\n`;
    prompt += `\n用户不需要重复提供这些信息，你可以直接使用。`;
  }

  if (functionResults?.length > 0) {
    prompt += `\n\n## 【计算结果】\n`;
    functionResults.forEach((fr) => {
      prompt += `\n### ${fr.functionName}\n计算结果：${JSON.stringify(fr.result, null, 2)}\n`;
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

const QUICK_QUESTIONS = [
  { icon: "🧮", text: "我是女生，28岁，在北京工作，月薪1.5万，帮我算养老金" },
  { icon: "📊", text: "分析一下我的养老缺口" },
  { icon: "💰", text: "我涨薪到2万了，重新算一下" },
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
export default function PensionAIv4() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiKey, setApiKey] = useState(MINIMAX_API_KEY);
  const [isUsingRealApi, setIsUsingRealApi] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [profile, setProfile] = useState({});
  const [showProfile, setShowProfile] = useState(false);
  const messagesEndRef = useRef(null);

  // 初始化：加载画像和欢迎语
  useEffect(() => {
    const saved = loadProfile();
    setProfile(saved);
    const welcome = isProfileComplete(saved)
      ? `欢迎回来！😊 我还记得您的信息：\n\n- 年龄：${saved.age}岁\n- 性别：${saved.gender}\n- 月薪：¥${saved.salary?.toLocaleString()}\n${saved.city ? `- 城市：${saved.city}\n` : ""}\n信息有变化可以随时告诉我，或者直接问我问题~`
      : "您好！我是**安享养老**智能规划助手 🏡\n\n我可以帮您：\n- 🧮 精确测算养老金\n- 📊 分析养老缺口\n- 💡 推荐补充方案\n\n告诉我您的年龄、性别、月薪和城市，我来帮您算~";
    setMessages([{ role: "assistant", content: welcome, sources: [], retrievedDocs: [], functionCalls: [] }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function callMiniMaxAPI(userMessages, retrievedDocs, functionResults) {
    const systemPrompt = buildSystemPrompt(retrievedDocs, functionResults, profile);
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...userMessages.map((m) => ({ role: m.role, content: m.content })),
    ];
    const response = await fetch(MINIMAX_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MINIMAX_MODEL, messages: apiMessages, temperature: 0.7, max_tokens: 1000 }),
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

    // 提取画像更新
    const { profile: newProfile, hasUpdate } = extractProfileFromMessage(messageText, profile);
    if (hasUpdate) {
      setProfile(newProfile);
      saveProfile(newProfile);
    }

    const currentProfile = hasUpdate ? newProfile : profile;
    const retrievedDocs = retrieveKnowledge(messageText);
    const { intent, params } = detectIntent(messageText, currentProfile);
    const functionResults = intent !== "chat" ? executeFunctionCall(intent, params) : [];

    // 保存计算历史
    if (functionResults.length > 0) {
      const history = loadCalcHistory();
      history.push({ date: new Date().toLocaleDateString("zh-CN"), results: functionResults });
      saveCalcHistory(history);
    }

    const newMessages = [...messages, { role: "user", content: messageText, sources: [], retrievedDocs: [], functionCalls: [] }];
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
          let t = "";
          if (hasUpdate) t += `✅ 已更新您的信息\n\n`;
          if (pr) {
            t += `根据您的信息，精确测算结果如下 🧮\n\n`;
            t += `📊 **养老金预估：**\n`;
            t += `- 基础养老金：¥${pr.result.基础养老金.toLocaleString()}/月\n`;
            t += `- 个人账户养老金：¥${pr.result.个人账户养老金.toLocaleString()}/月\n`;
            t += `- **合计：¥${pr.result.养老金合计.toLocaleString()}/月**\n`;
          }
          if (gr) {
            t += `\n💡 **养老缺口：**\n`;
            t += `- 目标（70%替代率）：¥${gr.result.目标月养老金.toLocaleString()}/月\n`;
            t += `- **${gr.result.缺口状态}**\n`;
          }
          if (sr) {
            t += `\n🎯 **推荐方案：**\n`;
            t += `- 组合方案可覆盖 **${sr.result.方案三_组合推荐.缺口覆盖率}** 的缺口\n`;
          }
          t += `\n⚠️ 计算引擎精确计算，非AI估算。`;
          reply = t;
        } else if (hasUpdate && !isProfileComplete(currentProfile)) {
          reply = `收到！已记住您的信息 ✅ 还需要一些信息才能帮您计算，请补充：${!currentProfile.age ? "\n- 年龄" : ""}${!currentProfile.gender ? "\n- 性别" : ""}${!currentProfile.salary ? "\n- 月薪" : ""}`;
        } else if (hasUpdate && isProfileComplete(currentProfile)) {
          reply = `信息已更新！😊 您可以直接说"帮我算养老金"或"分析缺口"，我会用最新信息来计算。`;
        } else {
          reply = `您好！😊 我可以帮您测算养老金、分析缺口、推荐方案。\n\n请告诉我您的基本信息，比如：女，28岁，北京，月薪1.5万`;
        }
      }

      setMessages([...newMessages, { role: "assistant", content: reply, sources, retrievedDocs, functionCalls: functionResults }]);
    } catch (err) {
      setMessages([...newMessages, {
        role: "assistant", content: `抱歉，出现问题：${err.message}`, sources: [], retrievedDocs: [], functionCalls: [],
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  function clearProfile() {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    setProfile({});
    setShowProfile(false);
    setMessages([{
      role: "assistant",
      content: "已清除所有记忆 🔄\n\n请重新告诉我您的信息，我来帮您规划~",
      sources: [], retrievedDocs: [], functionCalls: [],
    }]);
  }

  function toggleSection(key) {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function renderContent(text) {
    return text.split("\n").map((line, i) => {
      let p = line
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#d4380d">$1</strong>')
        .replace(/\*(.*?)\*/g, "<em>$1</em>");
      if (line.startsWith("- ")) p = "　• " + p.slice(2);
      p = p.replace(/\[来源[：:][^\]]*\]/g, "");
      return (<span key={i}><span dangerouslySetInnerHTML={{ __html: p }} />{i < text.split("\n").length - 1 && <br />}</span>);
    });
  }

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
                <div key={k} style={styles.fcRow}><span style={styles.fcKey}>{k}</span><span style={styles.fcValue}>{String(v)}</span></div>
              ))}
            </div>
            <div style={styles.fcSection}>
              <div style={styles.fcSectionTitle}>📤 计算结果</div>
              {Object.entries(fc.result).map(([k, v]) => (
                <div key={k} style={styles.fcRow}><span style={styles.fcKey}>{k}</span><span style={styles.fcValue}>{typeof v === "object" ? JSON.stringify(v, null, 1) : String(v)}</span></div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================
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
              {isUsingRealApi ? "🟢 API" : "🟡 演示"}
              {" · "}<span style={{ color: "#0958d9" }}>RAG</span>
              {" + "}<span style={{ color: "#d4380d" }}>FC</span>
              {" + "}<span style={{ color: "#389e0d" }}>Memory</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={styles.profileBtn} onClick={() => setShowProfile(!showProfile)}>
            {isProfileComplete(profile) ? "👤" : "👤"}
          </button>
          <button style={styles.settingsBtn} onClick={() => setShowApiModal(true)}>⚙️</button>
        </div>
      </div>

      {/* User Profile Card */}
      {showProfile && (
        <div style={styles.profileCard}>
          <div style={styles.profileHeader}>
            <span style={styles.profileTitle}>🧠 用户记忆</span>
            <button style={styles.clearBtn} onClick={clearProfile}>清除记忆</button>
          </div>
          {isProfileComplete(profile) ? (
            <div style={styles.profileGrid}>
              <div style={styles.profileItem}><span style={styles.profileLabel}>年龄</span><span style={styles.profileValue}>{profile.age}岁</span></div>
              <div style={styles.profileItem}><span style={styles.profileLabel}>性别</span><span style={styles.profileValue}>{profile.gender}</span></div>
              <div style={styles.profileItem}><span style={styles.profileLabel}>月薪</span><span style={styles.profileValue}>¥{profile.salary?.toLocaleString()}</span></div>
              <div style={styles.profileItem}><span style={styles.profileLabel}>城市</span><span style={styles.profileValue}>{profile.city || "未知"}</span></div>
              {profile.lastUpdated && (
                <div style={{ ...styles.profileItem, gridColumn: "1 / -1" }}><span style={styles.profileLabel}>更新时间</span><span style={styles.profileValue}>{profile.lastUpdated}</span></div>
              )}
            </div>
          ) : (
            <div style={styles.profileEmpty}>暂无记忆，开始对话后自动记录</div>
          )}
        </div>
      )}

      {/* Stats */}
      <div style={styles.statBanner}>
        <div style={styles.statItem}>
          <div style={styles.statValue}>{KNOWLEDGE_BASE.length}</div>
          <div style={styles.statLabel}>知识库</div>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.statItem}>
          <div style={styles.statValue}>3</div>
          <div style={styles.statLabel}>计算函数</div>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.statItem}>
          <div style={styles.statValue}>{isProfileComplete(profile) ? "✅" : "—"}</div>
          <div style={styles.statLabel}>记忆状态</div>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.statItem}>
          <div style={styles.statValue}>V4</div>
          <div style={styles.statLabel}>Memory</div>
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
                {msg.role === "assistant" && msg.functionCalls?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    {msg.functionCalls.map((fc, fi) => renderFunctionCard(fc, fi, idx))}
                  </div>
                )}
                {msg.role === "assistant" && msg.sources?.length > 0 && (
                  <div style={styles.sourcesArea}>
                    <div style={styles.sourcesHeader} onClick={() => toggleSection(`src-${idx}`)}>
                      <span>📚</span><span style={styles.sourcesLabel}>参考了{msg.sources.length}份资料</span>
                      <span style={styles.sourcesToggle}>{expandedSections[`src-${idx}`] ? "▲" : "▼"}</span>
                    </div>
                    {expandedSections[`src-${idx}`] && (
                      <div style={styles.sourcesList}>
                        {msg.sources.map((src, si) => {
                          const c = CATEGORY_COLORS[src.category] || CATEGORY_COLORS["常见问题"];
                          return (
                            <div key={si} style={styles.sourceItem}>
                              <span style={{ ...styles.sourceTag, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{src.category}</span>
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
                <span style={styles.typingText}>正在计算...</span>
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
            <button key={i} style={styles.quickBtn} onClick={() => handleSend(q.text)}>
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
            placeholder={isProfileComplete(profile) ? "直接问问题，我记得您的信息~" : "输入您的养老规划问题..."}
            disabled={isLoading} />
          <button style={{ ...styles.sendBtn, opacity: input.trim() && !isLoading ? 1 : 0.4 }}
            onClick={() => handleSend()} disabled={!input.trim() || isLoading}>➤</button>
        </div>
        <div style={styles.poweredBy}>Powered by MiniMax AI + RAG + FC + Memory · V4</div>
      </div>

      {/* API Modal */}
      {showApiModal && (
        <div style={styles.modalOverlay} onClick={() => setShowApiModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>⚙️ API 设置</div>
            <input style={styles.modalInput}
              value={apiKey === "YOUR_MINIMAX_API_KEY" ? "" : apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入 MiniMax API Key..." />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button style={styles.modalBtnPrimary} onClick={() => { setIsUsingRealApi(true); setShowApiModal(false); }}>连接 API</button>
              <button style={styles.modalBtnSecondary} onClick={() => { setIsUsingRealApi(false); setShowApiModal(false); }}>演示模式</button>
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
  profileBtn: { background: "rgba(255,255,255,0.7)", border: "none", borderRadius: 12, width: 40, height: 40, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  // Profile Card
  profileCard: { position: "relative", zIndex: 10, margin: "0 20px 8px", padding: "14px 16px", background: "#fff", borderRadius: 16, border: "1px solid #e8f5e9", boxShadow: "0 2px 8px rgba(56,142,60,0.08)" },
  profileHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  profileTitle: { fontSize: 14, fontWeight: 600, color: "#2e7d32" },
  clearBtn: { fontSize: 11, color: "#e53935", background: "none", border: "1px solid #ffcdd2", borderRadius: 8, padding: "3px 10px", cursor: "pointer" },
  profileGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  profileItem: { display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#f1f8e9", borderRadius: 8 },
  profileLabel: { fontSize: 12, color: "#689f38" },
  profileValue: { fontSize: 12, fontWeight: 600, color: "#33691e" },
  profileEmpty: { fontSize: 12, color: "#aaa", textAlign: "center", padding: 8 },
  // Stats
  statBanner: { position: "relative", zIndex: 10, margin: "4px 20px 12px", padding: "12px 16px", background: "linear-gradient(135deg, #d4380d 0%, #fa8c16 100%)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 16, boxShadow: "0 6px 24px rgba(212,56,13,0.25)" },
  statItem: { textAlign: "center" },
  statValue: { fontSize: 16, fontWeight: 700, color: "#fff" },
  statLabel: { fontSize: 9, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  statDivider: { width: 1, height: 28, background: "rgba(255,255,255,0.3)" },
  // Chat
  chatArea: { position: "relative", zIndex: 10, flex: 1, overflowY: "auto", padding: "8px 16px" },
  msgRow: { display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 14, animation: "fadeSlideUp 0.35s ease-out" },
  avatarBot: { width: 34, height: 34, borderRadius: 12, background: "linear-gradient(135deg, #fff5f0, #ffe7d6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0, border: "1px solid #ffd6b0" },
  avatarUser: { width: 34, height: 34, borderRadius: 12, background: "linear-gradient(135deg, #d4380d, #fa541c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 },
  bubbleBot: { maxWidth: "82%", padding: "12px 16px", background: "#ffffff", borderRadius: "18px 18px 18px 4px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", border: "1px solid #f0e8e0" },
  bubbleUser: { maxWidth: "78%", padding: "12px 16px", background: "linear-gradient(135deg, #d4380d, #fa541c)", borderRadius: "18px 18px 4px 18px", color: "#fff", boxShadow: "0 2px 8px rgba(212,56,13,0.25)" },
  msgText: { fontSize: 14, lineHeight: 1.65, color: "inherit" },
  // FC Card
  fcCard: { marginTop: 8, border: "1px solid #ffe0cc", borderRadius: 12, overflow: "hidden", background: "#fff9f5" },
  fcHeader: { display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", cursor: "pointer", background: "linear-gradient(135deg, #fff5ee, #fff0e5)" },
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
  sourcesHeader: { display: "flex", alignItems: "center", gap: 6, cursor: "pointer" },
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
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 12 },
  modalInput: { width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid #e8e0d8", fontSize: 13, outline: "none", fontFamily: "monospace", background: "#faf7f4" },
  modalBtnPrimary: { flex: 1, padding: "12px 0", borderRadius: 12, background: "linear-gradient(135deg, #d4380d, #fa541c)", border: "none", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  modalBtnSecondary: { flex: 1, padding: "12px 0", borderRadius: 12, background: "#f5f0eb", border: "1px solid #e8ddd2", color: "#5c3a1e", fontSize: 14, fontWeight: 500, cursor: "pointer" },
};
