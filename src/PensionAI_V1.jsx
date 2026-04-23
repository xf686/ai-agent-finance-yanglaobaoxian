//test123
import { useState, useRef, useEffect } from "react";

// ============================================================
// 🔑 MiniMax API Configuration
// ============================================================
// MiniMax supports OpenAI-compatible format:
//   POST https://api.minimax.io/v1/chat/completions
//   Authorization: Bearer YOUR_API_KEY
//   Model: "MiniMax-M2" or "MiniMax-M2.1"
//
// To use this demo with real MiniMax API:
// 1. Get your API key from https://platform.minimax.io
// 2. Replace MINIMAX_API_KEY below
// 3. Ensure CORS is handled (use a proxy in production)
// ============================================================

const MINIMAX_API_KEY = "YOUR_MINIMAX_API_KEY"; // ← 替换为你的MiniMax API Key
const MINIMAX_API_URL = "https://api.minimax.io/v1/chat/completions";
const MINIMAX_MODEL = "MiniMax-M2";

const SYSTEM_PROMPT = `你是"安享养老"智能规划助手，一个专业、亲切的养老金规划顾问AI。你的职责是帮助用户进行养老金规划和测算。

核心能力：
1. 【退休年龄规划】根据用户的出生年份、性别、职业类型，计算法定退休年龄和可选的弹性退休年龄
2. 【基本养老金测算】根据缴费年限、缴费基数、当地社会平均工资，估算基本养老金月领取金额
3. 【养老缺口分析】根据用户期望的退休生活水平，计算养老资金缺口
4. 【职业年金/企业年金测算】如用户有补充养老保险，计算预期收益
5. 【个性化养老方案】综合用户情况，推荐商业养老保险、个人养老金账户等补充方案

对话风格：
- 用温暖专业的语气，像理财顾问一样和用户交流
- 主动引导用户提供必要信息（年龄、收入、所在城市等）
- 给出具体数字和计算过程，让用户感到可信
- 每次回复控制在200字以内，简洁清晰
- 适当使用emoji让对话更亲切
- 如果用户没有提供足够信息，友善地询问

计算公式参考（简化版）：
- 基础养老金 = 当地上年度社平工资 × (1 + 个人平均缴费指数) ÷ 2 × 缴费年限 × 1%
- 个人账户养老金 = 个人账户储存额 ÷ 计发月数（60岁退休为139个月）
- 养老金替代率目标：建议达到退休前收入的70%-80%

注意事项：
- 提醒用户这是估算，实际以社保部门核定为准
- 涉及具体产品推荐时，建议用户咨询专业顾问
- 回答要简短精炼，不要一次说太多`;

// Simulated response for demo mode (when no API key)
const DEMO_RESPONSES = [
  `您好！我是您的养老规划助手 😊 很高兴为您服务！

要帮您做养老规划，我需要了解一些基本信息：
1. 您的**年龄**和**性别**是？
2. 目前**月收入**大概是多少？
3. 在哪个**城市**工作呢？

告诉我这些，我就能帮您算算退休后能领多少养老金~`,

  `明白啦！根据您的情况，我来帮您算一下 🧮

📊 **基本养老金预估：**
- 基础养老金：约 ¥3,200/月
- 个人账户养老金：约 ¥1,800/月
- **合计月领取：约 ¥5,000/月**

💡 **养老缺口分析：**
按照退休前收入70%的替代率目标，您的目标养老金约 ¥10,500/月，目前存在约 **¥5,500/月** 的缺口。

建议通过以下方式补充：
1. 个人养老金账户（每年¥12,000额度）
2. 商业养老保险
3. 基金定投

需要我详细算算哪种方案最适合您吗？`,

  `好的，我帮您对比一下三种补充方案 📋

**方案一：个人养老金账户**
- 每年缴存 ¥12,000，享受税收优惠
- 预计30年后积累约 ¥58万
- 每月可多领约 ¥4,170

**方案二：商业养老年金险**
- 每月缴费 ¥2,000，缴20年
- 60岁起每月领取约 ¥3,500
- 保证领取20年

**方案三：组合方案（推荐 ⭐）**
- 个人养老金 + 指数基金定投
- 预计可填补90%的养老缺口

建议您优先开通个人养老金账户，享受节税福利。需要我帮您规划具体的缴费计划吗？`,

  `根据您的情况，我制定了一份 **专属养老计划** 📝

🎯 **目标：** 60岁退休，月养老金达到 ¥10,500

📅 **执行计划：**
- **立即**：开通个人养老金账户，每月定存¥1,000
- **每月**：基金定投¥1,500（沪深300+中证500组合）
- **每年**：检视一次养老规划，动态调整

💰 **预期效果：**
- 基本养老金：¥5,000/月
- 个人养老金：¥4,170/月
- 基金定投收益：¥2,800/月
- **合计：约¥11,970/月** ✅ 超额达标！

⚠️ 以上为估算值，实际收益会有波动。建议您也可以咨询我们的专业顾问获得更详细的方案。

还有其他问题吗？😊`,
];

// ============================================================
// Quick Question Chips
// ============================================================
const QUICK_QUESTIONS = [
  { icon: "🧮", text: "帮我算养老金" },
  { icon: "📊", text: "分析养老缺口" },
  { icon: "💡", text: "推荐养老方案" },
  { icon: "📅", text: "退休年龄规划" },
];

// ============================================================
// Main App Component
// ============================================================
export default function PensionAIAssistant() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "您好！我是**安享养老**智能规划助手 🏡\n\n我可以帮您：\n- 🧮 测算养老金\n- 📊 分析养老缺口\n- 💡 推荐养老方案\n- 📅 规划退休年龄\n\n请告诉我您的需求，或点击下方快捷按钮开始~",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [demoIndex, setDemoIndex] = useState(0);
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiKey, setApiKey] = useState(MINIMAX_API_KEY);
  const [isUsingRealApi, setIsUsingRealApi] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --------------------------------------------------------
  // Call MiniMax API (OpenAI-compatible format)
  // --------------------------------------------------------
  async function callMiniMaxAPI(userMessages) {
    const apiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
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
    // 过滤MiniMax思考过程（多种格式）
    content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    // 如果回复中有明显的"正式回复"分隔，取后半部分
    const markers = ['您好！', '您好!', '你好！', '你好!', '好的，', '好的!', '明白了', '根据您', '为您', '帮您'];
    for (const marker of markers) {
      const idx = content.indexOf(marker);
      if (idx > 50) {
        content = content.substring(idx);
        break;
      }
    }
    return content;
  }

  // --------------------------------------------------------
  // Handle send message
  // --------------------------------------------------------
  async function handleSend(text) {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const newMessages = [...messages, { role: "user", content: messageText }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      let reply;
      if (isUsingRealApi && apiKey !== "YOUR_MINIMAX_API_KEY") {
        reply = await callMiniMaxAPI(newMessages);
      } else {
        // Demo mode with simulated responses
        await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));
        reply = DEMO_RESPONSES[demoIndex % DEMO_RESPONSES.length];
        setDemoIndex((i) => i + 1);
      }
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: `抱歉，连接出现问题：${err.message}\n\n请检查API Key是否正确，或切换到演示模式体验。`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  // --------------------------------------------------------
  // Simple Markdown-like renderer
  // --------------------------------------------------------
  function renderContent(text) {
    return text.split("\n").map((line, i) => {
      let processed = line
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#d4380d">$1</strong>')
        .replace(/\*(.*?)\*/g, "<em>$1</em>");
      if (line.startsWith("- ")) {
        processed = "　• " + processed.slice(2);
      }
      return (
        <span key={i}>
          <span dangerouslySetInnerHTML={{ __html: processed }} />
          {i < text.split("\n").length - 1 && <br />}
        </span>
      );
    });
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={styles.root}>
      {/* Background gradient */}
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
            </div>
          </div>
        </div>
        <button style={styles.settingsBtn} onClick={() => setShowApiModal(true)}>
          ⚙️
        </button>
      </div>

      {/* Stat Banner */}
      <div style={styles.statBanner}>
        <div style={styles.statItem}>
          <div style={styles.statValue}>796,841</div>
          <div style={styles.statLabel}>累计资金盈余(元)</div>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.statItem}>
          <div style={styles.statValue}>58-85岁</div>
          <div style={styles.statLabel}>规划退休区间</div>
        </div>
      </div>

      {/* Chat Area */}
      <div style={styles.chatArea}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              ...styles.msgRow,
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            {msg.role === "assistant" && (
              <div style={styles.avatarBot}>🤖</div>
            )}
            <div
              style={
                msg.role === "user" ? styles.bubbleUser : styles.bubbleBot
              }
            >
              <div style={styles.msgText}>{renderContent(msg.content)}</div>
            </div>
            {msg.role === "user" && <div style={styles.avatarUser}>👤</div>}
          </div>
        ))}

        {isLoading && (
          <div style={{ ...styles.msgRow, justifyContent: "flex-start" }}>
            <div style={styles.avatarBot}>🤖</div>
            <div style={styles.bubbleBot}>
              <div style={styles.typingIndicator}>
                <span style={{ ...styles.typingDot, animationDelay: "0s" }} />
                <span style={{ ...styles.typingDot, animationDelay: "0.2s" }} />
                <span style={{ ...styles.typingDot, animationDelay: "0.4s" }} />
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

      {/* Input Area */}
      <div style={styles.inputArea}>
        <div style={styles.inputWrapper}>
          <input
            ref={inputRef}
            style={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="输入您的养老规划问题..."
            disabled={isLoading}
          />
          <button
            style={{
              ...styles.sendBtn,
              opacity: input.trim() && !isLoading ? 1 : 0.4,
            }}
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
          >
            ➤
          </button>
        </div>
        <div style={styles.poweredBy}>
          Powered by MiniMax AI · 仅供演示
        </div>
      </div>

      {/* API Settings Modal */}
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
            <div style={styles.modalDesc}>
              <span style={{ fontSize: 12, color: "#999" }}>
                模型：{MINIMAX_MODEL} | 端点：{MINIMAX_API_URL}
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                style={styles.modalBtnPrimary}
                onClick={() => {
                  setIsUsingRealApi(true);
                  setShowApiModal(false);
                }}
              >
                连接 API
              </button>
              <button
                style={styles.modalBtnSecondary}
                onClick={() => {
                  setIsUsingRealApi(false);
                  setApiKey("YOUR_MINIMAX_API_KEY");
                  setShowApiModal(false);
                }}
              >
                使用演示模式
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for animations */}
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
        
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
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
  root: {
    fontFamily: "'Noto Sans SC', -apple-system, sans-serif",
    width: "100%",
    maxWidth: 480,
    height: "100vh",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    background: "#faf7f4",
    position: "relative",
    overflow: "hidden",
  },
  bgGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    background: "linear-gradient(135deg, #fff1e6 0%, #ffe4cc 40%, #ffd6b0 100%)",
    zIndex: 0,
  },
  // Header
  header: {
    position: "relative",
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px 12px",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: "linear-gradient(135deg, #d4380d 0%, #fa541c 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 14px rgba(212,56,13,0.3)",
  },
  logoIcon: {
    fontSize: 22,
    filter: "brightness(1.2)",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: "#1a1a1a",
    letterSpacing: "0.3px",
  },
  headerSub: {
    fontSize: 11,
    color: "#8c6d52",
    marginTop: 1,
  },
  settingsBtn: {
    background: "rgba(255,255,255,0.7)",
    border: "none",
    borderRadius: 12,
    width: 40,
    height: 40,
    fontSize: 18,
    cursor: "pointer",
    backdropFilter: "blur(10px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  // Stat Banner
  statBanner: {
    position: "relative",
    zIndex: 10,
    margin: "4px 20px 12px",
    padding: "14px 20px",
    background: "linear-gradient(135deg, #d4380d 0%, #fa8c16 100%)",
    borderRadius: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    boxShadow: "0 6px 24px rgba(212,56,13,0.25)",
  },
  statItem: {
    textAlign: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: 700,
    color: "#fff",
    letterSpacing: "0.5px",
  },
  statLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    background: "rgba(255,255,255,0.3)",
  },
  // Chat
  chatArea: {
    position: "relative",
    zIndex: 10,
    flex: 1,
    overflowY: "auto",
    padding: "8px 16px",
  },
  msgRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 14,
    animation: "fadeSlideUp 0.35s ease-out",
  },
  avatarBot: {
    width: 34,
    height: 34,
    borderRadius: 12,
    background: "linear-gradient(135deg, #fff5f0, #ffe7d6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 17,
    flexShrink: 0,
    border: "1px solid #ffd6b0",
  },
  avatarUser: {
    width: 34,
    height: 34,
    borderRadius: 12,
    background: "linear-gradient(135deg, #d4380d, #fa541c)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 17,
    flexShrink: 0,
  },
  bubbleBot: {
    maxWidth: "78%",
    padding: "12px 16px",
    background: "#ffffff",
    borderRadius: "18px 18px 18px 4px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    border: "1px solid #f0e8e0",
  },
  bubbleUser: {
    maxWidth: "78%",
    padding: "12px 16px",
    background: "linear-gradient(135deg, #d4380d, #fa541c)",
    borderRadius: "18px 18px 4px 18px",
    color: "#fff",
    boxShadow: "0 2px 8px rgba(212,56,13,0.25)",
  },
  msgText: {
    fontSize: 14,
    lineHeight: 1.65,
    color: "inherit",
  },
  typingIndicator: {
    display: "flex",
    gap: 5,
    padding: "4px 0",
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#d4380d",
    display: "inline-block",
    animation: "typingBounce 1.2s infinite",
  },
  // Quick Questions
  quickArea: {
    position: "relative",
    zIndex: 10,
    padding: "4px 16px 8px",
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  quickBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    background: "#ffffff",
    border: "1px solid #f0e0d0",
    borderRadius: 20,
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    flexShrink: 0,
  },
  quickIcon: {
    fontSize: 15,
  },
  quickText: {
    fontSize: 13,
    color: "#5c3a1e",
    fontWeight: 500,
  },
  // Input
  inputArea: {
    position: "relative",
    zIndex: 10,
    padding: "10px 16px 16px",
    background: "rgba(250,247,244,0.95)",
    backdropFilter: "blur(10px)",
    borderTop: "1px solid #f0e8e0",
  },
  inputWrapper: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#ffffff",
    borderRadius: 24,
    padding: "4px 6px 4px 18px",
    border: "1px solid #e8ddd2",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  input: {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: 14,
    background: "transparent",
    color: "#333",
    fontFamily: "'Noto Sans SC', sans-serif",
    padding: "10px 0",
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #d4380d, #fa541c)",
    border: "none",
    color: "#fff",
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "all 0.2s ease",
  },
  poweredBy: {
    textAlign: "center",
    fontSize: 10,
    color: "#c4a882",
    marginTop: 8,
  },
  // Modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    backdropFilter: "blur(4px)",
  },
  modal: {
    background: "#fff",
    borderRadius: 20,
    padding: "28px 24px",
    width: "90%",
    maxWidth: 380,
    boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1a1a1a",
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 13,
    color: "#666",
    lineHeight: 1.6,
    marginBottom: 16,
  },
  modalInput: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid #e8e0d8",
    fontSize: 13,
    outline: "none",
    fontFamily: "monospace",
    background: "#faf7f4",
    marginBottom: 4,
  },
  modalBtnPrimary: {
    flex: 1,
    padding: "12px 0",
    borderRadius: 12,
    background: "linear-gradient(135deg, #d4380d, #fa541c)",
    border: "none",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  modalBtnSecondary: {
    flex: 1,
    padding: "12px 0",
    borderRadius: 12,
    background: "#f5f0eb",
    border: "1px solid #e8ddd2",
    color: "#5c3a1e",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },
};