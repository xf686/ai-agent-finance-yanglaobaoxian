import { useState, useRef, useEffect } from "react";
import KNOWLEDGE_BASE from "@data/knowledgeBase.json";

// ============================================================
// V2: RAG版本 - 外置知识库 + 关键词检索 + 来源展示
// ============================================================

const MINIMAX_API_KEY = "YOUR_MINIMAX_API_KEY";
const MINIMAX_API_URL = "https://api.minimax.io/v1/chat/completions";
const MINIMAX_MODEL = "MiniMax-M2";

// ============================================================
// 🔍 RAG检索函数
// ============================================================
function retrieveKnowledge(query) {
  const queryLower = query.toLowerCase();
  const scored = KNOWLEDGE_BASE.map((doc) => {
    let score = 0;
    doc.keywords.forEach((kw) => {
      if (queryLower.includes(kw)) {
        score += 3;
      }
    });
    if (queryLower.includes(doc.title.substring(0, 4))) {
      score += 2;
    }
    return { ...doc, score };
  });

  return scored
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// ============================================================
// System Prompt（动态注入检索结果）
// ============================================================
function buildSystemPrompt(retrievedDocs) {
  let prompt = `你是"安享养老"的AI规划助手，帮用户做养老金测算和咨询。

## 对话规则
- 用户打招呼时，热情回应并简要介绍你能做什么，然后问用户想了解哪方面
- 用户问养老相关问题但没给信息时，用一句话说明需要什么，给出示例："比如：女，28岁，北京，月薪1.5万"
- 收到用户信息后，直接开始计算，不要再反复确认
- 每次回复不超过300字，简洁有力
- 用emoji让对话亲切，但不要过多
- 回答必须基于下方【参考资料】中的内容，不要编造信息
- 引用参考资料时，在回答末尾标注来源，格式：[来源：资料标题]

## 计算能力
- 基础养老金 = 当地社平工资 × (1+缴费指数) ÷ 2 × 缴费年限 × 1%
- 个人账户养老金 = 个人账户余额 ÷ 计发月数（60岁=139，55岁=170，50岁=195）
- 养老替代率目标：退休前收入的70%-80%

## 注意
- 结果为估算，提醒用户以社保部门为准
- 推荐产品时据实介绍，不夸大收益
- 不要在一轮对话中问超过一个问题`;

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
    text: `您好！我是您的养老规划助手 😊 很高兴为您服务！

我可以帮您：
- 🧮 测算养老金能领多少
- 📊 分析养老缺口
- 💡 推荐适合的养老方案
- 📋 解答养老保险政策问题

请问您想了解哪方面呢？`,
    sources: [],
  },
  {
    text: `根据您的情况，帮您测算一下 🧮

📊 **基本养老金预估：**
- 基础养老金：约 ¥3,200/月
- 个人账户养老金：约 ¥1,800/月
- **合计月领取：约 ¥5,000/月**

💡 **养老缺口分析：**
按照70%替代率目标，您的目标养老金约 ¥10,500/月，目前存在约 **¥5,500/月** 的缺口。

建议通过个人养老金账户和商业养老保险来补充。需要我详细介绍吗？`,
    sources: [
      { title: "养老金计算公式", category: "计算规则" },
      { title: "养老金替代率说明", category: "常见问题" },
    ],
  },
  {
    text: `为您推荐两款产品对比 📋

**安享一生养老年金险：**
- 月缴¥2,000，缴20年
- 60岁起月领约¥4,200，终身领取
- 保证领取20年，预定利率3.0%

**金色晚年万能型养老险：**
- 灵活追加，最低¥1,000起
- 保底利率2.0%，当前结算3.8%
- 满5年后可随时部分领取

⭐ 建议：求稳定选安享一生，求灵活选金色晚年。也可以组合搭配。`,
    sources: [
      { title: "安享一生养老年金险", category: "公司产品" },
      { title: "金色晚年万能型养老险", category: "公司产品" },
    ],
  },
];

const QUICK_QUESTIONS = [
  { icon: "🧮", text: "帮我算养老金" },
  { icon: "📊", text: "分析养老缺口" },
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
export default function PensionAIv2() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "您好！我是**安享养老**智能规划助手 🏡\n\n我可以帮您：\n- 🧮 测算养老金\n- 📊 分析养老缺口\n- 💡 推荐养老方案\n- 📋 解答政策问题\n\n我内置了养老保险政策、产品条款和常见问题知识库，为您提供有据可依的回答~",
      sources: [],
      retrievedDocs: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [demoIndex, setDemoIndex] = useState(0);
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiKey, setApiKey] = useState(MINIMAX_API_KEY);
  const [isUsingRealApi, setIsUsingRealApi] = useState(false);
  const [expandedSources, setExpandedSources] = useState({});
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function callMiniMaxAPI(userMessages, retrievedDocs) {
    const systemPrompt = buildSystemPrompt(retrievedDocs);
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

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;
    content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    return content;
  }

  async function handleSend(text) {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const retrievedDocs = retrieveKnowledge(messageText);

    const newMessages = [
      ...messages,
      { role: "user", content: messageText, sources: [], retrievedDocs: [] },
    ];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      let reply;
      let sources = [];

      if (isUsingRealApi && apiKey !== "YOUR_MINIMAX_API_KEY") {
        reply = await callMiniMaxAPI(newMessages, retrievedDocs);
        sources = retrievedDocs.map((d) => ({
          title: d.title,
          category: d.category,
        }));
      } else {
        await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));
        const demo = DEMO_RESPONSES[demoIndex % DEMO_RESPONSES.length];
        reply = demo.text;
        sources = demo.sources;
        setDemoIndex((i) => i + 1);
      }

      setMessages([
        ...newMessages,
        { role: "assistant", content: reply, sources, retrievedDocs },
      ]);
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: `抱歉，连接出现问题：${err.message}\n\n请检查API Key是否正确，或切换到演示模式体验。`,
          sources: [],
          retrievedDocs: [],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function toggleSource(msgIdx) {
    setExpandedSources((prev) => ({ ...prev, [msgIdx]: !prev[msgIdx] }));
  }

  function renderContent(text) {
    return text.split("\n").map((line, i) => {
      let processed = line
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#d4380d">$1</strong>')
        .replace(/\*(.*?)\*/g, "<em>$1</em>");
      if (line.startsWith("- ")) {
        processed = "　• " + processed.slice(2);
      }
      processed = processed.replace(/\[来源[：:][^\]]*\]/g, "");
      return (
        <span key={i}>
          <span dangerouslySetInnerHTML={{ __html: processed }} />
          {i < text.split("\n").length - 1 && <br />}
        </span>
      );
    });
  }

  return (
    <div style={styles.root}>
      <div style={styles.bgGradient} />

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>🏡</span>
          </div>
          <div>
            <div style={styles.headerTitle}>安享养老 · AI规划助手</div>
            <div style={styles.headerSub}>
              {isUsingRealApi ? "🟢 MiniMax API 已连接" : "🟡 演示模式"}
              {" · "}
              <span style={{ color: "#0958d9" }}>RAG知识库已加载</span>
            </div>
          </div>
        </div>
        <button style={styles.settingsBtn} onClick={() => setShowApiModal(true)}>
          ⚙️
        </button>
      </div>

      {/* Stats Banner */}
      <div style={styles.statBanner}>
        <div style={styles.statItem}>
          <div style={styles.statValue}>{KNOWLEDGE_BASE.length}</div>
          <div style={styles.statLabel}>知识库文档数</div>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.statItem}>
          <div style={styles.statValue}>4类</div>
          <div style={styles.statLabel}>政策/产品/规则/FAQ</div>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.statItem}>
          <div style={styles.statValue}>RAG</div>
          <div style={styles.statLabel}>检索增强生成</div>
        </div>
      </div>

      {/* Chat */}
      <div style={styles.chatArea}>
        {messages.map((msg, idx) => (
          <div key={idx}>
            <div
              style={{
                ...styles.msgRow,
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              {msg.role === "assistant" && <div style={styles.avatarBot}>🤖</div>}
              <div style={msg.role === "user" ? styles.bubbleUser : styles.bubbleBot}>
                <div style={styles.msgText}>{renderContent(msg.content)}</div>

                {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                  <div style={styles.sourcesArea}>
                    <div style={styles.sourcesHeader} onClick={() => toggleSource(idx)}>
                      <span style={styles.sourcesIcon}>📚</span>
                      <span style={styles.sourcesLabel}>
                        参考了{msg.sources.length}份资料
                      </span>
                      <span style={styles.sourcesToggle}>
                        {expandedSources[idx] ? "▲" : "▼"}
                      </span>
                    </div>
                    {expandedSources[idx] && (
                      <div style={styles.sourcesList}>
                        {msg.sources.map((src, si) => {
                          const c = CATEGORY_COLORS[src.category] || CATEGORY_COLORS["常见问题"];
                          return (
                            <div key={si} style={styles.sourceItem}>
                              <span
                                style={{
                                  ...styles.sourceTag,
                                  background: c.bg,
                                  color: c.color,
                                  border: `1px solid ${c.border}`,
                                }}
                              >
                                {src.category}
                              </span>
                              <span style={styles.sourceTitle}>{src.title}</span>
                            </div>
                          );
                        })}
                        {msg.retrievedDocs && msg.retrievedDocs.length > 0 && (
                          <div style={styles.retrievedDetail}>
                            {msg.retrievedDocs.map((doc, di) => (
                              <div key={di} style={styles.retrievedItem}>
                                <div style={styles.retrievedTitle}>📄 {doc.title}</div>
                                <div style={styles.retrievedContent}>
                                  {doc.content.substring(0, 100)}...
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
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
                <span style={styles.typingText}>正在检索知识库...</span>
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
            <button
              key={i}
              style={styles.quickBtn}
              onClick={() => handleSend(q.text)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(212,56,13,0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)";
              }}
            >
              <span style={styles.quickIcon}>{q.icon}</span>
              <span style={styles.quickText}>{q.text}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={styles.inputArea}>
        <div style={styles.inputWrapper}>
          <input
            style={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="输入您的养老规划问题..."
            disabled={isLoading}
          />
          <button
            style={{ ...styles.sendBtn, opacity: input.trim() && !isLoading ? 1 : 0.4 }}
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
          >
            ➤
          </button>
        </div>
        <div style={styles.poweredBy}>Powered by MiniMax AI + RAG · V2 知识增强版</div>
      </div>

      {/* API Modal */}
      {showApiModal && (
        <div style={styles.modalOverlay} onClick={() => setShowApiModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>⚙️ API 设置</div>
            <div style={styles.modalDesc}>
              输入你的 MiniMax API Key 以启用真实AI对话。
              <br />
              <span style={{ fontSize: 12, color: "#999" }}>
                获取地址：platform.minimax.io → API Keys
              </span>
            </div>
            <input
              style={styles.modalInput}
              value={apiKey === "YOUR_MINIMAX_API_KEY" ? "" : apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入 MiniMax API Key..."
            />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                style={styles.modalBtnPrimary}
                onClick={() => { setIsUsingRealApi(true); setShowApiModal(false); }}
              >
                连接 API
              </button>
              <button
                style={styles.modalBtnSecondary}
                onClick={() => { setIsUsingRealApi(false); setApiKey("YOUR_MINIMAX_API_KEY"); setShowApiModal(false); }}
              >
                使用演示模式
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap');
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
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
  logoIcon: { fontSize: 22, filter: "brightness(1.2)" },
  headerTitle: { fontSize: 17, fontWeight: 700, color: "#1a1a1a", letterSpacing: "0.3px" },
  headerSub: { fontSize: 11, color: "#8c6d52", marginTop: 1 },
  settingsBtn: { background: "rgba(255,255,255,0.7)", border: "none", borderRadius: 12, width: 40, height: 40, fontSize: 18, cursor: "pointer", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center" },
  statBanner: { position: "relative", zIndex: 10, margin: "4px 20px 12px", padding: "14px 20px", background: "linear-gradient(135deg, #d4380d 0%, #fa8c16 100%)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 20, boxShadow: "0 6px 24px rgba(212,56,13,0.25)" },
  statItem: { textAlign: "center" },
  statValue: { fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "0.5px" },
  statLabel: { fontSize: 10, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  statDivider: { width: 1, height: 32, background: "rgba(255,255,255,0.3)" },
  chatArea: { position: "relative", zIndex: 10, flex: 1, overflowY: "auto", padding: "8px 16px" },
  msgRow: { display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 14, animation: "fadeSlideUp 0.35s ease-out" },
  avatarBot: { width: 34, height: 34, borderRadius: 12, background: "linear-gradient(135deg, #fff5f0, #ffe7d6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0, border: "1px solid #ffd6b0" },
  avatarUser: { width: 34, height: 34, borderRadius: 12, background: "linear-gradient(135deg, #d4380d, #fa541c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 },
  bubbleBot: { maxWidth: "78%", padding: "12px 16px", background: "#ffffff", borderRadius: "18px 18px 18px 4px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", border: "1px solid #f0e8e0" },
  bubbleUser: { maxWidth: "78%", padding: "12px 16px", background: "linear-gradient(135deg, #d4380d, #fa541c)", borderRadius: "18px 18px 4px 18px", color: "#fff", boxShadow: "0 2px 8px rgba(212,56,13,0.25)" },
  msgText: { fontSize: 14, lineHeight: 1.65, color: "inherit" },
  sourcesArea: { marginTop: 10, borderTop: "1px solid #f0e8e0", paddingTop: 8 },
  sourcesHeader: { display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" },
  sourcesIcon: { fontSize: 14 },
  sourcesLabel: { fontSize: 12, color: "#8c6d52", fontWeight: 500 },
  sourcesToggle: { fontSize: 10, color: "#bfa88a", marginLeft: "auto" },
  sourcesList: { marginTop: 8 },
  sourceItem: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  sourceTag: { fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 500, flexShrink: 0 },
  sourceTitle: { fontSize: 12, color: "#5c3a1e" },
  retrievedDetail: { marginTop: 8, padding: "8px 10px", background: "#faf7f4", borderRadius: 10, border: "1px solid #f0e8e0" },
  retrievedItem: { marginBottom: 8 },
  retrievedTitle: { fontSize: 11, fontWeight: 600, color: "#5c3a1e", marginBottom: 3 },
  retrievedContent: { fontSize: 11, color: "#8c7a6a", lineHeight: 1.5 },
  typingArea: { display: "flex", alignItems: "center", gap: 10 },
  typingIndicator: { display: "flex", gap: 5, padding: "4px 0" },
  typingDot: { width: 7, height: 7, borderRadius: "50%", background: "#d4380d", display: "inline-block", animation: "typingBounce 1.2s infinite" },
  typingText: { fontSize: 12, color: "#bfa88a" },
  quickArea: { position: "relative", zIndex: 10, padding: "4px 16px 8px", display: "flex", flexWrap: "wrap", gap: 8 },
  quickBtn: { display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#ffffff", border: "1px solid #f0e0d0", borderRadius: 20, cursor: "pointer", transition: "all 0.2s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", flexShrink: 0 },
  quickIcon: { fontSize: 15 },
  quickText: { fontSize: 13, color: "#5c3a1e", fontWeight: 500 },
  inputArea: { position: "relative", zIndex: 10, padding: "10px 16px 16px", background: "rgba(250,247,244,0.95)", backdropFilter: "blur(10px)", borderTop: "1px solid #f0e8e0" },
  inputWrapper: { display: "flex", alignItems: "center", gap: 8, background: "#ffffff", borderRadius: 24, padding: "4px 6px 4px 18px", border: "1px solid #e8ddd2", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
  input: { flex: 1, border: "none", outline: "none", fontSize: 14, background: "transparent", color: "#333", fontFamily: "'Noto Sans SC', sans-serif", padding: "10px 0" },
  sendBtn: { width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #d4380d, #fa541c)", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s ease" },
  poweredBy: { textAlign: "center", fontSize: 10, color: "#c4a882", marginTop: 8 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)" },
  modal: { background: "#fff", borderRadius: 20, padding: "28px 24px", width: "90%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 },
  modalDesc: { fontSize: 13, color: "#666", lineHeight: 1.6, marginBottom: 16 },
  modalInput: { width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid #e8e0d8", fontSize: 13, outline: "none", fontFamily: "monospace", background: "#faf7f4", marginBottom: 4 },
  modalBtnPrimary: { flex: 1, padding: "12px 0", borderRadius: 12, background: "linear-gradient(135deg, #d4380d, #fa541c)", border: "none", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  modalBtnSecondary: { flex: 1, padding: "12px 0", borderRadius: 12, background: "#f5f0eb", border: "1px solid #e8ddd2", color: "#5c3a1e", fontSize: 14, fontWeight: 500, cursor: "pointer" },
};
