import { useState, useRef, useEffect } from "react";
import KNOWLEDGE_BASE from "@data/knowledgeBase.json";

// ============================================================
// V5: 完整版（RAG + Function Call + Memory + Voice）
// 交互规则：
// - 文字输入 → 文字回复（不播放语音）
// - 语音输入 → 自动发送 + 自动播放语音回复
// ============================================================

const MINIMAX_API_KEY = "YOUR_MINIMAX_API_KEY";
const MINIMAX_API_URL = "https://api.minimax.io/v1/chat/completions";
const MINIMAX_TTS_URL = "https://api.minimax.io/v1/t2a_v2";
const MINIMAX_MODEL = "MiniMax-M2";
const MINIMAX_TTS_MODEL = "speech-02-hd";
const DEFAULT_VOICE_ID = "female-tianmei"; // 固定使用甜美女声

// ============================================================
// 📝 Memory（同V4）
// ============================================================
const PROFILE_STORAGE_KEY = "pension_ai_user_profile_v5";
const HISTORY_STORAGE_KEY = "pension_ai_calc_history_v5";

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
    updated.salary = val; hasUpdate = true;
  }
  const raiseMatch = message.match(/[涨加升调][薪资工资到至]+\s*(\d+\.?\d*)\s*[万w]?/i);
  if (raiseMatch) {
    let val = parseFloat(raiseMatch[1]);
    if (val < 100) val = val * 10000;
    updated.salary = val; hasUpdate = true;
  }
  const cityMatch = message.match(/(北京|上海|广州|深圳|杭州|成都|武汉|南京|重庆|西安|天津|苏州)/);
  if (cityMatch) { updated.city = cityMatch[1]; hasUpdate = true; }
  if (hasUpdate) updated.lastUpdated = new Date().toLocaleDateString("zh-CN");
  return { profile: updated, hasUpdate };
}

function isProfileComplete(profile) {
  return profile.age && profile.gender && profile.salary;
}

// ============================================================
// 🧮 Function Call（同V4）
// ============================================================
const CITY_AVG_SALARY = {
  北京: 13438, 上海: 12895, 广州: 11262, 深圳: 12547,
  杭州: 11281, 成都: 8817, 武汉: 9192, 南京: 11072,
  重庆: 7900, 西安: 8280, 天津: 9450, 苏州: 10680, 默认: 8900,
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
  return {
    functionName: "养老金测算",
    input: { age, gender, salary, city: city || "默认", paymentYears, retireAge },
    result: {
      城市社平工资: avgSalary, 缴费指数: Math.round(payIndex * 100) / 100, 缴费年限: paymentYears,
      法定退休年龄: retireAge, 基础养老金: Math.round(basicPension), 个人账户余额: Math.round(personalAccount),
      计发月数: months, 个人账户养老金: Math.round(personalPension), 养老金合计: Math.round(basicPension + personalPension),
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
      目标月养老金: Math.round(targetPension), 预计基本养老金: Math.round(totalPension),
      月缺口: Math.round(Math.max(0, gap)), 年缺口: Math.round(Math.max(0, gap) * 12),
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
      if (gr.result.月缺口 > 0) results.push(calcSupplementPlan({ age: params.age, gap: gr.result.月缺口, retireAge: pr.result.法定退休年龄 }));
    }
  }
  if (intent === "gap") {
    const pr = calcBasicPension(params); results.push(pr);
    results.push(calcPensionGap({ salary: params.salary, totalPension: pr.result.养老金合计 }));
  }
  if (intent === "recommend") {
    const pr = calcBasicPension(params);
    const gr = calcPensionGap({ salary: params.salary, totalPension: pr.result.养老金合计 }); results.push(gr);
    if (gr.result.月缺口 > 0) results.push(calcSupplementPlan({ age: params.age, gap: gr.result.月缺口, retireAge: pr.result.法定退休年龄 }));
  }
  return results;
}

// ============================================================
// 🔍 RAG
// ============================================================
function retrieveKnowledge(query) {
  const q = query.toLowerCase();
  return KNOWLEDGE_BASE.map((doc) => {
    let score = 0;
    doc.keywords.forEach((kw) => { if (q.includes(kw)) score += 3; });
    return { ...doc, score };
  }).filter((d) => d.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
}

function buildSystemPrompt(retrievedDocs, functionResults, profile, isVoice) {
  let prompt = `你是"安享养老"的AI规划助手。

## 对话规则
- 用户打招呼时热情回应并介绍能力
- 收到计算结果后用通俗语言解读，突出关键数字
- ${isVoice ? "用户语音输入，回复要口语化、简短，不超过150字，不要用markdown格式" : "回复不超过300字"}
- 用emoji让对话亲切
- 不在一轮对话中问超过一个问题
- 如有计算结果，直接引用，不要自己重算`;

  if (isProfileComplete(profile)) {
    prompt += `\n\n## 用户画像（已记住）\n年龄${profile.age}岁，${profile.gender}，月薪¥${profile.salary?.toLocaleString()}${profile.city ? `，${profile.city}` : ""}`;
  }
  if (functionResults?.length > 0) {
    prompt += `\n\n## 计算结果\n`;
    functionResults.forEach(fr => {
      prompt += `\n### ${fr.functionName}\n${JSON.stringify(fr.result, null, 2)}\n`;
    });
  }
  if (retrievedDocs.length > 0) {
    prompt += `\n\n## 参考资料\n`;
    retrievedDocs.forEach((doc, i) => {
      prompt += `\n${i + 1}. ${doc.title}：${doc.content}\n`;
    });
  }
  return prompt;
}

const QUICK_QUESTIONS = [
  { icon: "🧮", text: "我是女生28岁北京月薪1.5万帮我算养老金" },
  { icon: "📊", text: "分析我的养老缺口" },
  { icon: "💰", text: "我涨薪到2万了重新算" },
  { icon: "📋", text: "社保断缴怎么办" },
];

const CATEGORY_COLORS = {
  政策法规: { bg: "#e6f7ff", color: "#0958d9", border: "#91caff" },
  计算规则: { bg: "#fff7e6", color: "#d46b08", border: "#ffd591" },
  公司产品: { bg: "#f6ffed", color: "#389e0d", border: "#b7eb8f" },
  常见问题: { bg: "#f9f0ff", color: "#722ed1", border: "#d3adf7" },
};

// ============================================================
// Main
// ============================================================
export default function PensionAIv5() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiKey, setApiKey] = useState(MINIMAX_API_KEY);
  const [isUsingRealApi, setIsUsingRealApi] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [profile, setProfile] = useState({});
  const [showProfile, setShowProfile] = useState(false);

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [currentPlayingIdx, setCurrentPlayingIdx] = useState(null);
  const [voiceError, setVoiceError] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(true);

  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const messagesEndRef = useRef(null);
  const finalTranscriptRef = useRef("");

  // 初始化语音识别
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "zh-CN";
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }
      if (final) finalTranscriptRef.current = final;
      setInput(finalTranscriptRef.current + interim);
    };

    rec.onerror = (event) => {
      console.error("语音识别错误:", event.error);
      setIsRecording(false);
      if (event.error === "not-allowed") setVoiceError("请允许麦克风权限");
      else if (event.error === "no-speech") setVoiceError("没听到声音，请重试");
      else setVoiceError(`识别错误：${event.error}`);
      setTimeout(() => setVoiceError(""), 3000);
    };

    rec.onend = () => {
      setIsRecording(false);
      // 录音结束时，如果有识别结果，自动发送（语音模式）
      const text = finalTranscriptRef.current.trim();
      if (text) {
        finalTranscriptRef.current = "";
        setTimeout(() => handleSendRef.current(text, true), 300);
      }
    };

    recognitionRef.current = rec;
  }, []);

  // handleSend的ref，避免闭包问题
  const handleSendRef = useRef(null);

  // 初始化画像
  useEffect(() => {
    const saved = loadProfile();
    setProfile(saved);
    const welcome = isProfileComplete(saved)
      ? `欢迎回来！😊 我还记得您的信息：\n\n- 年龄：${saved.age}岁\n- 性别：${saved.gender}\n- 月薪：¥${saved.salary?.toLocaleString()}\n${saved.city ? `- 城市：${saved.city}\n` : ""}\n可以直接问我问题，或点击🎤语音交流~`
      : "您好！我是**安享养老**智能规划助手 🏡\n\n我可以帮您：\n- 🧮 精确测算养老金\n- 📊 分析养老缺口\n- 💡 推荐补充方案\n- 📋 解答政策问题\n\n支持**文字**和**语音**两种交流方式~";
    setMessages([{ role: "assistant", content: welcome, sources: [], retrievedDocs: [], functionCalls: [], isVoice: false }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ==========================================================
  // 🎤 语音输入
  // ==========================================================
  function toggleRecording() {
    if (!voiceSupported) {
      setVoiceError("浏览器不支持语音，请用Chrome");
      setTimeout(() => setVoiceError(""), 3000);
      return;
    }
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      setInput("");
      finalTranscriptRef.current = "";
      setVoiceError("");
      try {
        recognitionRef.current?.start();
        setIsRecording(true);
      } catch (e) { console.error(e); }
    }
  }

  // ==========================================================
  // 🔊 语音输出（MiniMax TTS，降级到浏览器）
  // ==========================================================
  async function playTTS(text, msgIdx) {
    const cleanText = text.replace(/[*_`#\[\]]/g, "").replace(/\n+/g, "，").substring(0, 500);

    if (!isUsingRealApi || apiKey === "YOUR_MINIMAX_API_KEY") {
      // 演示模式用浏览器TTS
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = "zh-CN";
        utterance.rate = 1.05;
        setCurrentPlayingIdx(msgIdx);
        utterance.onend = () => setCurrentPlayingIdx(null);
        utterance.onerror = () => setCurrentPlayingIdx(null);
        window.speechSynthesis.speak(utterance);
      }
      return;
    }

    try {
      setCurrentPlayingIdx(msgIdx);
      const response = await fetch(MINIMAX_TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MINIMAX_TTS_MODEL,
          text: cleanText,
          voice_setting: { voice_id: DEFAULT_VOICE_ID, speed: 1.0, vol: 1.0, pitch: 0 },
          audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3" },
        }),
      });
      if (!response.ok) throw new Error(`TTS ${response.status}`);
      const data = await response.json();
      if (data.data?.audio) {
        const audioBytes = new Uint8Array(data.data.audio.match(/.{1,2}/g).map(b => parseInt(b, 16)));
        const audioBlob = new Blob([audioBytes], { type: "audio/mp3" });
        const audioUrl = URL.createObjectURL(audioBlob);
        if (audioRef.current) audioRef.current.pause();
        audioRef.current = new Audio(audioUrl);
        audioRef.current.onended = () => setCurrentPlayingIdx(null);
        audioRef.current.play();
      }
    } catch (err) {
      console.error("TTS错误:", err);
      setCurrentPlayingIdx(null);
      // 降级到浏览器TTS
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = "zh-CN";
        window.speechSynthesis.speak(utterance);
        setCurrentPlayingIdx(msgIdx);
        utterance.onend = () => setCurrentPlayingIdx(null);
      }
    }
  }

  function stopTTS() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setCurrentPlayingIdx(null);
  }

  // ==========================================================
  // Chat Logic
  // ==========================================================
  async function callMiniMaxAPI(userMessages, retrievedDocs, functionResults, isVoice) {
    const systemPrompt = buildSystemPrompt(retrievedDocs, functionResults, profile, isVoice);
    const response = await fetch(MINIMAX_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...userMessages.map(m => ({ role: m.role, content: m.content }))],
        temperature: 0.7, max_tokens: 1000,
      }),
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  }

  async function handleSend(text, isVoice = false) {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const { profile: newProfile, hasUpdate } = extractProfileFromMessage(messageText, profile);
    if (hasUpdate) { setProfile(newProfile); saveProfile(newProfile); }
    const currentProfile = hasUpdate ? newProfile : profile;

    const retrievedDocs = retrieveKnowledge(messageText);
    const { intent, params } = detectIntent(messageText, currentProfile);
    const functionResults = intent !== "chat" ? executeFunctionCall(intent, params) : [];

    if (functionResults.length > 0) {
      const history = loadCalcHistory();
      history.push({ date: new Date().toLocaleDateString("zh-CN"), results: functionResults });
      saveCalcHistory(history);
    }

    const newMessages = [...messages, { role: "user", content: messageText, sources: [], retrievedDocs: [], functionCalls: [], isVoice }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      let reply;
      const sources = retrievedDocs.map(d => ({ title: d.title, category: d.category }));

      if (isUsingRealApi && apiKey !== "YOUR_MINIMAX_API_KEY") {
        reply = await callMiniMaxAPI(newMessages, retrievedDocs, functionResults, isVoice);
      } else {
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
        if (functionResults.length > 0) {
          const pr = functionResults.find(f => f.functionName === "养老金测算");
          const gr = functionResults.find(f => f.functionName === "养老缺口分析");
          const sr = functionResults.find(f => f.functionName === "补充方案推荐");
          let t = "";
          if (hasUpdate) t += `✅ 已更新您的信息\n\n`;
          if (pr) {
            t += `根据您的信息精确测算 🧮\n\n`;
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
          if (sr) t += `\n🎯 组合方案可覆盖 **${sr.result.方案三_组合推荐.缺口覆盖率}** 缺口`;
          if (!t) t = "您好！请告诉我您的信息，比如：女，28岁，北京，月薪1.5万";
          reply = t;
        } else {
          reply = hasUpdate
            ? `收到！已记住您的信息 ✅ 您可以问我"帮我算养老金"`
            : `请告诉我您的基本信息，我来帮您规划~`;
        }
      }

      const newMsg = { role: "assistant", content: reply, sources, retrievedDocs, functionCalls: functionResults, isVoice };
      setMessages([...newMessages, newMsg]);

      // 关键：只有语音输入才自动播放
      if (isVoice) {
        setTimeout(() => playTTS(reply, newMessages.length), 300);
      }
    } catch (err) {
      setMessages([...newMessages, {
        role: "assistant", content: `抱歉，出现问题：${err.message}`,
        sources: [], retrievedDocs: [], functionCalls: [], isVoice: false,
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  // 更新ref
  useEffect(() => { handleSendRef.current = handleSend; });

  function clearProfile() {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    setProfile({});
    setShowProfile(false);
    setMessages([{ role: "assistant", content: "已清除所有记忆 🔄\n\n请重新告诉我您的信息~", sources: [], retrievedDocs: [], functionCalls: [], isVoice: false }]);
  }

  function toggleSection(key) {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function renderContent(text) {
    return text.split("\n").map((line, i) => {
      let p = line.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#d4380d">$1</strong>').replace(/\*(.*?)\*/g, "<em>$1</em>");
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
          <span>⚡</span>
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
              {" + "}<span style={{ color: "#722ed1" }}>🎤Voice</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={styles.iconBtn} onClick={() => setShowProfile(!showProfile)}>👤</button>
          <button style={styles.iconBtn} onClick={() => setShowApiModal(true)}>⚙️</button>
        </div>
      </div>

      {/* Profile Card */}
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
            </div>
          ) : (
            <div style={styles.profileEmpty}>暂无记忆</div>
          )}
        </div>
      )}

      {/* Stats */}
      <div style={styles.statBanner}>
        <div style={styles.statItem}><div style={styles.statValue}>{KNOWLEDGE_BASE.length}</div><div style={styles.statLabel}>知识库</div></div>
        <div style={styles.statDivider} />
        <div style={styles.statItem}><div style={styles.statValue}>3</div><div style={styles.statLabel}>函数</div></div>
        <div style={styles.statDivider} />
        <div style={styles.statItem}><div style={styles.statValue}>{isProfileComplete(profile) ? "✅" : "—"}</div><div style={styles.statLabel}>记忆</div></div>
        <div style={styles.statDivider} />
        <div style={styles.statItem}><div style={styles.statValue}>🎤</div><div style={styles.statLabel}>语音</div></div>
      </div>

      {voiceError && <div style={styles.errorBar}>⚠️ {voiceError}</div>}

      {/* Chat */}
      <div style={styles.chatArea}>
        {messages.map((msg, idx) => (
          <div key={idx}>
            <div style={{ ...styles.msgRow, justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              {msg.role === "assistant" && <div style={styles.avatarBot}>🤖</div>}
              <div style={msg.role === "user" ? styles.bubbleUser : styles.bubbleBot}>
                {/* 语音标识 */}
                {msg.isVoice && msg.role === "user" && (
                  <div style={styles.voiceTag}>🎤 语音消息</div>
                )}
                <div style={styles.msgText}>{renderContent(msg.content)}</div>

                {/* 播放按钮（AI消息） */}
                {msg.role === "assistant" && (
                  <button
                    style={{ ...styles.playBtn, ...(currentPlayingIdx === idx ? styles.playBtnActive : {}) }}
                    onClick={() => currentPlayingIdx === idx ? stopTTS() : playTTS(msg.content, idx)}
                  >
                    {currentPlayingIdx === idx ? "⏸ 停止" : "🔊 朗读"}
                  </button>
                )}

                {/* Function Call Cards */}
                {msg.role === "assistant" && msg.functionCalls?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    {msg.functionCalls.map((fc, fi) => renderFunctionCard(fc, fi, idx))}
                  </div>
                )}

                {/* Sources */}
                {msg.role === "assistant" && msg.sources?.length > 0 && (
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
                <span style={styles.typingText}>思考中...</span>
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
            <button key={i} style={styles.quickBtn} onClick={() => handleSend(q.text, false)}>
              <span style={styles.quickIcon}>{q.icon}</span>
              <span style={styles.quickText}>{q.text}</span>
            </button>
          ))}
        </div>
      )}

      {/* Recording Indicator */}
      {isRecording && (
        <div style={styles.recordingHint}>
          🔴 正在聆听... 说完会自动发送并语音回复
        </div>
      )}

      {/* Input */}
      <div style={styles.inputArea}>
        <div style={styles.inputWrapper}>
          <button
            style={{ ...styles.micBtn, ...(isRecording ? styles.micBtnActive : {}) }}
            onClick={toggleRecording}
            title={isRecording ? "点击停止" : "点击语音输入"}
          >
            {isRecording ? "⏹" : "🎤"}
          </button>
          <input
            style={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend(null, false)}
            placeholder={isRecording ? "正在聆听..." : (isProfileComplete(profile) ? "输入文字或点🎤语音" : "输入您的养老规划问题...")}
            disabled={isLoading || isRecording}
          />
          <button
            style={{ ...styles.sendBtn, opacity: input.trim() && !isLoading ? 1 : 0.4 }}
            onClick={() => handleSend(null, false)}
            disabled={!input.trim() || isLoading}
          >➤</button>
        </div>
        <div style={styles.poweredBy}>
          文字→文字回复 · 🎤语音→语音回复 · V5
        </div>
      </div>

      {/* API Modal */}
      {showApiModal && (
        <div style={styles.modalOverlay} onClick={() => setShowApiModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>⚙️ API 设置</div>
            <div style={{ fontSize: 12, color: "#999", marginBottom: 12 }}>
              连接API后，TTS使用MiniMax高质量音色。<br />
              未连接时使用浏览器原生TTS（免费但音色一般）。
            </div>
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
        @keyframes recordPulse { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,77,79,0.7); } 50% { transform: scale(1.08); box-shadow: 0 0 0 8px rgba(255,77,79,0); } }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        input::placeholder { color: #bfbfbf; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #e8e8e8; border-radius: 4px; }
      `}</style>
    </div>
  );
}

const styles = {
  root: { fontFamily: "'Noto Sans SC', -apple-system, sans-serif", width: "100%", maxWidth: 480, height: "100vh", margin: "0 auto", display: "flex", flexDirection: "column", background: "#faf7f4", position: "relative", overflow: "hidden" },
  bgGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 280, background: "linear-gradient(135deg, #fff1e6 0%, #ffe4cc 40%, #ffd6b0 100%)", zIndex: 0 },
  header: { position: "relative", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px" },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logo: { width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, #d4380d 0%, #fa541c 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(212,56,13,0.3)" },
  logoIcon: { fontSize: 22 },
  headerTitle: { fontSize: 16, fontWeight: 700, color: "#1a1a1a" },
  headerSub: { fontSize: 10, color: "#8c6d52", marginTop: 1 },
  iconBtn: { background: "rgba(255,255,255,0.7)", border: "none", borderRadius: 12, width: 40, height: 40, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  profileCard: { position: "relative", zIndex: 10, margin: "0 20px 8px", padding: "14px 16px", background: "#fff", borderRadius: 16, border: "1px solid #e8f5e9", boxShadow: "0 2px 8px rgba(56,142,60,0.08)" },
  profileHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  profileTitle: { fontSize: 14, fontWeight: 600, color: "#2e7d32" },
  clearBtn: { fontSize: 11, color: "#e53935", background: "none", border: "1px solid #ffcdd2", borderRadius: 8, padding: "3px 10px", cursor: "pointer" },
  profileGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  profileItem: { display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#f1f8e9", borderRadius: 8 },
  profileLabel: { fontSize: 12, color: "#689f38" },
  profileValue: { fontSize: 12, fontWeight: 600, color: "#33691e" },
  profileEmpty: { fontSize: 12, color: "#aaa", textAlign: "center", padding: 8 },
  statBanner: { position: "relative", zIndex: 10, margin: "4px 20px 12px", padding: "12px 16px", background: "linear-gradient(135deg, #d4380d 0%, #fa8c16 100%)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, boxShadow: "0 6px 24px rgba(212,56,13,0.25)" },
  statItem: { textAlign: "center" },
  statValue: { fontSize: 16, fontWeight: 700, color: "#fff" },
  statLabel: { fontSize: 9, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  statDivider: { width: 1, height: 28, background: "rgba(255,255,255,0.3)" },
  errorBar: { margin: "0 20px 8px", padding: "8px 14px", background: "#fff2e8", border: "1px solid #ffd591", borderRadius: 10, color: "#d46b08", fontSize: 12 },
  chatArea: { position: "relative", zIndex: 10, flex: 1, overflowY: "auto", padding: "8px 16px" },
  msgRow: { display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 14, animation: "fadeSlideUp 0.35s ease-out" },
  avatarBot: { width: 34, height: 34, borderRadius: 12, background: "linear-gradient(135deg, #fff5f0, #ffe7d6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0, border: "1px solid #ffd6b0" },
  avatarUser: { width: 34, height: 34, borderRadius: 12, background: "linear-gradient(135deg, #d4380d, #fa541c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 },
  bubbleBot: { maxWidth: "82%", padding: "12px 16px", background: "#ffffff", borderRadius: "18px 18px 18px 4px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", border: "1px solid #f0e8e0" },
  bubbleUser: { maxWidth: "78%", padding: "12px 16px", background: "linear-gradient(135deg, #d4380d, #fa541c)", borderRadius: "18px 18px 4px 18px", color: "#fff", boxShadow: "0 2px 8px rgba(212,56,13,0.25)" },
  msgText: { fontSize: 14, lineHeight: 1.65, color: "inherit" },
  voiceTag: { fontSize: 10, background: "rgba(255,255,255,0.25)", color: "#fff", padding: "2px 8px", borderRadius: 8, display: "inline-block", marginBottom: 6 },
  playBtn: { marginTop: 8, padding: "4px 12px", background: "#faf7f4", border: "1px solid #e8ddd2", borderRadius: 12, fontSize: 11, color: "#8c5a3a", cursor: "pointer" },
  playBtnActive: { background: "#fff3e8", border: "1px solid #fa8c16", color: "#d4380d" },
  fcCard: { marginTop: 8, border: "1px solid #ffe0cc", borderRadius: 12, overflow: "hidden", background: "#fff9f5" },
  fcHeader: { display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", cursor: "pointer", background: "linear-gradient(135deg, #fff5ee, #fff0e5)" },
  fcName: { fontSize: 12, fontWeight: 600, color: "#d4380d" },
  fcToggle: { fontSize: 10, color: "#e8a080", marginLeft: "auto" },
  fcBody: { padding: "8px 12px" },
  fcSection: { marginBottom: 8 },
  fcSectionTitle: { fontSize: 11, fontWeight: 600, color: "#8c5a3a", marginBottom: 4 },
  fcRow: { display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px solid #f5ebe3" },
  fcKey: { fontSize: 11, color: "#8c7a6a" },
  fcValue: { fontSize: 11, color: "#333", fontWeight: 500, maxWidth: "60%", textAlign: "right", whiteSpace: "pre-wrap", wordBreak: "break-all" },
  sourcesArea: { marginTop: 10, borderTop: "1px solid #f0e8e0", paddingTop: 8 },
  sourcesHeader: { display: "flex", alignItems: "center", gap: 6, cursor: "pointer" },
  sourcesLabel: { fontSize: 12, color: "#8c6d52", fontWeight: 500 },
  sourcesToggle: { fontSize: 10, color: "#bfa88a", marginLeft: "auto" },
  sourcesList: { marginTop: 8 },
  sourceItem: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  sourceTag: { fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 500, flexShrink: 0 },
  sourceTitle: { fontSize: 12, color: "#5c3a1e" },
  typingArea: { display: "flex", alignItems: "center", gap: 10 },
  typingIndicator: { display: "flex", gap: 5, padding: "4px 0" },
  typingDot: { width: 7, height: 7, borderRadius: "50%", background: "#d4380d", display: "inline-block", animation: "typingBounce 1.2s infinite" },
  typingText: { fontSize: 12, color: "#bfa88a" },
  quickArea: { position: "relative", zIndex: 10, padding: "4px 16px 8px", display: "flex", flexWrap: "wrap", gap: 8 },
  quickBtn: { display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#ffffff", border: "1px solid #f0e0d0", borderRadius: 20, cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", flexShrink: 0 },
  quickIcon: { fontSize: 15 },
  quickText: { fontSize: 13, color: "#5c3a1e", fontWeight: 500 },
  recordingHint: { position: "relative", zIndex: 10, margin: "0 20px 6px", padding: "8px 14px", background: "#fff1f0", border: "1px solid #ffccc7", borderRadius: 12, color: "#cf1322", fontSize: 12, textAlign: "center" },
  inputArea: { position: "relative", zIndex: 10, padding: "10px 16px 16px", background: "rgba(250,247,244,0.95)", borderTop: "1px solid #f0e8e0" },
  inputWrapper: { display: "flex", alignItems: "center", gap: 6, background: "#ffffff", borderRadius: 24, padding: "4px 6px", border: "1px solid #e8ddd2", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
  micBtn: { width: 38, height: 38, borderRadius: "50%", background: "#fff3e8", border: "1px solid #ffd591", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" },
  micBtnActive: { background: "#ff4d4f", border: "1px solid #cf1322", color: "#fff", animation: "recordPulse 1.2s infinite" },
  input: { flex: 1, border: "none", outline: "none", fontSize: 14, background: "transparent", color: "#333", fontFamily: "'Noto Sans SC', sans-serif", padding: "8px 4px" },
  sendBtn: { width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #d4380d, #fa541c)", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  poweredBy: { textAlign: "center", fontSize: 10, color: "#c4a882", marginTop: 8 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)" },
  modal: { background: "#fff", borderRadius: 20, padding: "28px 24px", width: "90%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 },
  modalInput: { width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid #e8e0d8", fontSize: 13, outline: "none", fontFamily: "monospace", background: "#faf7f4" },
  modalBtnPrimary: { flex: 1, padding: "12px 0", borderRadius: 12, background: "linear-gradient(135deg, #d4380d, #fa541c)", border: "none", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  modalBtnSecondary: { flex: 1, padding: "12px 0", borderRadius: 12, background: "#f5f0eb", border: "1px solid #e8ddd2", color: "#5c3a1e", fontSize: 14, fontWeight: 500, cursor: "pointer" },
};
