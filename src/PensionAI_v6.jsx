import { useState, useRef, useEffect } from "react";
import KNOWLEDGE_BASE from "@data/knowledgeBase.json";

// ============================================================
// V6: 数字人版本
// 在V5基础上新增：
// - 🤖 2D卡通数字人形象（SVG动画）
// - 👄 AI说话时嘴巴同步动
// - 😊 眨眼、呼吸等待机动画
// ============================================================

const MINIMAX_API_KEY = "YOUR_MINIMAX_API_KEY";
const MINIMAX_API_URL = "https://api.minimax.io/v1/chat/completions";
const MINIMAX_TTS_URL = "https://api.minimax.io/v1/t2a_v2";
const MINIMAX_MODEL = "MiniMax-M2";
const MINIMAX_TTS_MODEL = "speech-02-hd";
const DEFAULT_VOICE_ID = "female-tianmei";

// ============================================================
// 🤖 数字人组件
// ============================================================
function DigitalAvatar({ isSpeaking, isListening, isThinking }) {
  const [mouthOpen, setMouthOpen] = useState(0);
  const [blink, setBlink] = useState(false);

  // 嘴巴动画（说话时）
  useEffect(() => {
    if (!isSpeaking) {
      setMouthOpen(0);
      return;
    }
    const interval = setInterval(() => {
      setMouthOpen(Math.random() * 0.8 + 0.2);
    }, 120);
    return () => clearInterval(interval);
  }, [isSpeaking]);

  // 眨眼动画
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 150);
    }, 3500 + Math.random() * 2000);
    return () => clearInterval(blinkInterval);
  }, []);

  // 状态文字
  const statusText = isSpeaking ? "正在回答..." : isListening ? "正在聆听..." : isThinking ? "思考中..." : "我在这里~";
  const statusColor = isSpeaking ? "#d4380d" : isListening ? "#cf1322" : isThinking ? "#0958d9" : "#8c6d52";

  return (
    <div style={avatarStyles.wrapper}>
      {/* 背景光晕 */}
      <div style={{
        ...avatarStyles.glow,
        background: isSpeaking
          ? "radial-gradient(circle, rgba(250,140,22,0.3), transparent)"
          : isListening
            ? "radial-gradient(circle, rgba(255,77,79,0.3), transparent)"
            : "radial-gradient(circle, rgba(255,200,150,0.2), transparent)",
      }} />

      {/* SVG数字人 */}
      <svg viewBox="0 0 200 200" style={avatarStyles.svg}>
        {/* 头发背景 */}
        <ellipse cx="100" cy="85" rx="72" ry="68" fill="#6b3410" />

        {/* 脸 */}
        <ellipse cx="100" cy="100" rx="58" ry="62" fill="#ffe0c7" />

        {/* 头发前方刘海 */}
        <path d="M 42 80 Q 60 55, 100 50 Q 140 55, 158 80 Q 150 72, 130 75 Q 115 62, 100 65 Q 85 62, 70 75 Q 50 72, 42 80 Z" fill="#6b3410" />

        {/* 腮红 */}
        <ellipse cx="72" cy="115" rx="10" ry="6" fill="#ffb6a0" opacity="0.6" />
        <ellipse cx="128" cy="115" rx="10" ry="6" fill="#ffb6a0" opacity="0.6" />

        {/* 左眼 */}
        {blink ? (
          <path d="M 72 95 Q 80 97, 88 95" stroke="#3d2817" strokeWidth="2" fill="none" strokeLinecap="round" />
        ) : (
          <>
            <ellipse cx="80" cy="95" rx="6" ry="8" fill="#3d2817" />
            <circle cx="82" cy="93" r="2" fill="#fff" />
          </>
        )}

        {/* 右眼 */}
        {blink ? (
          <path d="M 112 95 Q 120 97, 128 95" stroke="#3d2817" strokeWidth="2" fill="none" strokeLinecap="round" />
        ) : (
          <>
            <ellipse cx="120" cy="95" rx="6" ry="8" fill="#3d2817" />
            <circle cx="122" cy="93" r="2" fill="#fff" />
          </>
        )}

        {/* 眉毛 */}
        <path d="M 70 82 Q 80 78, 90 82" stroke="#5d2f0f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M 110 82 Q 120 78, 130 82" stroke="#5d2f0f" strokeWidth="2.5" fill="none" strokeLinecap="round" />

        {/* 鼻子 */}
        <path d="M 100 105 L 97 118 Q 100 121, 103 118 Z" fill="#f5b896" opacity="0.6" />

        {/* 嘴巴（动画） */}
        {isSpeaking ? (
          <ellipse cx="100" cy={135 + mouthOpen * 2} rx={8 + mouthOpen * 4} ry={2 + mouthOpen * 8} fill="#c53e3e" />
        ) : isListening ? (
          <circle cx="100" cy="135" r="4" fill="#d4380d" />
        ) : (
          <path d="M 90 135 Q 100 140, 110 135" stroke="#c53e3e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        )}

        {/* 耳朵装饰（耳环） */}
        <circle cx="42" cy="105" r="3" fill="#ffd700" />
        <circle cx="158" cy="105" r="3" fill="#ffd700" />
      </svg>

      {/* 状态文字 */}
      <div style={{ ...avatarStyles.status, color: statusColor }}>
        <span style={{ ...avatarStyles.statusDot, background: statusColor, animation: (isSpeaking || isListening || isThinking) ? "statusPulse 1s infinite" : "none" }} />
        {statusText}
      </div>
    </div>
  );
}

const avatarStyles = {
  wrapper: { position: "relative", display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0" },
  glow: { position: "absolute", width: 160, height: 160, top: -10, borderRadius: "50%", transition: "background 0.3s" },
  svg: { width: 100, height: 100, position: "relative", zIndex: 2, filter: "drop-shadow(0 4px 12px rgba(212,56,13,0.15))" },
  status: { marginTop: 4, fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", gap: 5, transition: "color 0.3s" },
  statusDot: { width: 6, height: 6, borderRadius: "50%", transition: "background 0.3s" },
};

// ============================================================
// Memory（同V5）
// ============================================================
const PROFILE_STORAGE_KEY = "pension_ai_user_profile_v6";
const HISTORY_STORAGE_KEY = "pension_ai_calc_history_v6";

function loadProfile() {
  try { const s = localStorage.getItem(PROFILE_STORAGE_KEY); return s ? JSON.parse(s) : {}; } catch { return {}; }
}
function saveProfile(p) { localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(p)); }
function loadCalcHistory() { try { const s = localStorage.getItem(HISTORY_STORAGE_KEY); return s ? JSON.parse(s) : []; } catch { return []; } }
function saveCalcHistory(h) { localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(h.slice(-5))); }

function extractProfileFromMessage(message, currentProfile) {
  const updated = { ...currentProfile };
  let hasUpdate = false;
  const ageMatch = message.match(/(\d{2})\s*岁/);
  if (ageMatch) { updated.age = parseInt(ageMatch[1]); hasUpdate = true; }
  const genderMatch = message.match(/(男|女)/);
  if (genderMatch) { updated.gender = genderMatch[1]; hasUpdate = true; }
  const salaryMatch = message.match(/(\d+\.?\d*)\s*[万w]/i) || message.match(/月[薪收入工资]+\s*(\d+)/);
  if (salaryMatch) { let v = parseFloat(salaryMatch[1]); if (v < 100) v = v * 10000; updated.salary = v; hasUpdate = true; }
  const raiseMatch = message.match(/[涨加升调][薪资工资到至]+\s*(\d+\.?\d*)\s*[万w]?/i);
  if (raiseMatch) { let v = parseFloat(raiseMatch[1]); if (v < 100) v = v * 10000; updated.salary = v; hasUpdate = true; }
  const cityMatch = message.match(/(北京|上海|广州|深圳|杭州|成都|武汉|南京|重庆|西安|天津|苏州)/);
  if (cityMatch) { updated.city = cityMatch[1]; hasUpdate = true; }
  if (hasUpdate) updated.lastUpdated = new Date().toLocaleDateString("zh-CN");
  return { profile: updated, hasUpdate };
}

function isProfileComplete(p) { return p.age && p.gender && p.salary; }

// Function Call
const CITY_AVG_SALARY = { 北京: 13438, 上海: 12895, 广州: 11262, 深圳: 12547, 杭州: 11281, 成都: 8817, 武汉: 9192, 南京: 11072, 重庆: 7900, 西安: 8280, 天津: 9450, 苏州: 10680, 默认: 8900 };
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
  return {
    functionName: "养老金测算",
    input: { age, gender, salary, city: city || "默认", paymentYears, retireAge },
    result: {
      城市社平工资: avgSalary, 缴费指数: Math.round(payIndex * 100) / 100, 缴费年限: paymentYears,
      法定退休年龄: retireAge, 基础养老金: Math.round(basicPension), 个人账户余额: Math.round(personalAccount),
      计发月数: months, 个人账户养老金: Math.round(personalAccount / months),
      养老金合计: Math.round(basicPension + personalAccount / months),
    },
  };
}

function calcPensionGap(params) {
  const { salary, totalPension } = params;
  const targetPension = salary * 0.7;
  const gap = targetPension - totalPension;
  return {
    functionName: "养老缺口分析",
    input: { 当前月薪: salary, 目标替代率: "70%", 预计养老金: totalPension },
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
  const personalTotal = 12000 * yearsToRetire;
  const personalMonthly = personalTotal / (PAYMENT_MONTHS[retireAge || 60] || 139);
  const commercialTotal = 2000 * 12 * Math.min(yearsToRetire, 20);
  const commercialMonthly = commercialTotal * 0.03 / 12 + commercialTotal / ((retireAge || 60) - age + 20) / 12;
  const comboMonthly = personalMonthly + commercialMonthly;
  const coverageRate = Math.min(100, Math.round((comboMonthly / gap) * 100));
  return {
    functionName: "补充方案推荐",
    input: { 年龄: age, 月缺口: gap, 距退休年数: yearsToRetire },
    result: {
      "方案一_个人养老金": { 年缴费: "¥12000", 累计投入: `¥${personalTotal.toLocaleString()}`, 预估月领: `¥${Math.round(personalMonthly)}` },
      "方案二_商业养老年金": { 月缴费: "¥2000", 累计投入: `¥${commercialTotal.toLocaleString()}`, 预估月领: `¥${Math.round(commercialMonthly)}` },
      "方案三_组合推荐": { 组合月领: `¥${Math.round(comboMonthly)}`, 缺口覆盖率: `${coverageRate}%` },
    },
  };
}

function detectIntent(message, profile) {
  const msg = message.toLowerCase();
  const params = { ...profile };
  const has = isProfileComplete(params);
  if (has && (msg.includes("算") || msg.includes("测") || msg.includes("多少") || msg.includes("领"))) return { intent: "calculate", params };
  if (has && (msg.includes("缺口") || msg.includes("够不够") || msg.includes("差") || msg.includes("不够"))) return { intent: "gap", params };
  if (has && (msg.includes("方案") || msg.includes("推荐") || msg.includes("补充"))) return { intent: "recommend", params };
  if (has && !msg.includes("什么") && !msg.includes("吗") && !msg.includes("怎么办")) return { intent: "full_analysis", params };
  return { intent: "chat", params };
}

function executeFunctionCall(intent, params) {
  const r = [];
  if (intent === "calculate" || intent === "full_analysis") {
    const pr = calcBasicPension(params); r.push(pr);
    if (intent === "full_analysis") {
      const gr = calcPensionGap({ salary: params.salary, totalPension: pr.result.养老金合计 }); r.push(gr);
      if (gr.result.月缺口 > 0) r.push(calcSupplementPlan({ age: params.age, gap: gr.result.月缺口, retireAge: pr.result.法定退休年龄 }));
    }
  }
  if (intent === "gap") {
    const pr = calcBasicPension(params); r.push(pr);
    r.push(calcPensionGap({ salary: params.salary, totalPension: pr.result.养老金合计 }));
  }
  if (intent === "recommend") {
    const pr = calcBasicPension(params);
    const gr = calcPensionGap({ salary: params.salary, totalPension: pr.result.养老金合计 }); r.push(gr);
    if (gr.result.月缺口 > 0) r.push(calcSupplementPlan({ age: params.age, gap: gr.result.月缺口, retireAge: pr.result.法定退休年龄 }));
  }
  return r;
}

function retrieveKnowledge(query) {
  const q = query.toLowerCase();
  return KNOWLEDGE_BASE.map((d) => {
    let s = 0;
    d.keywords.forEach((kw) => { if (q.includes(kw)) s += 3; });
    return { ...d, score: s };
  }).filter((d) => d.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
}

function buildSystemPrompt(retrievedDocs, functionResults, profile, isVoice) {
  let p = `你是"安享养老"的AI规划助手。
## 规则
- 用户打招呼时热情回应并介绍能力
- 收到计算结果后用通俗语言解读
- ${isVoice ? "语音输入，回复口语化，150字内，不用markdown" : "回复不超过300字"}
- 用emoji让对话亲切
- 一轮对话只问一个问题`;
  if (isProfileComplete(profile)) p += `\n\n## 用户画像\n${profile.age}岁，${profile.gender}，月薪¥${profile.salary}${profile.city ? `，${profile.city}` : ""}`;
  if (functionResults?.length > 0) p += `\n\n## 计算结果\n${functionResults.map(fr => `${fr.functionName}: ${JSON.stringify(fr.result)}`).join("\n")}`;
  if (retrievedDocs.length > 0) p += `\n\n## 参考资料\n${retrievedDocs.map(d => `${d.title}: ${d.content}`).join("\n")}`;
  return p;
}

const QUICK_QUESTIONS = [
  { icon: "🧮", text: "我是女生28岁北京月薪1.5万帮我算养老金" },
  { icon: "📊", text: "分析我的养老缺口" },
  { icon: "💰", text: "我涨薪到2万了" },
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
export default function PensionAIv6() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiKey, setApiKey] = useState(MINIMAX_API_KEY);
  const [isUsingRealApi, setIsUsingRealApi] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [profile, setProfile] = useState({});
  const [showProfile, setShowProfile] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentPlayingIdx, setCurrentPlayingIdx] = useState(null);
  const [voiceError, setVoiceError] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(true);

  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const messagesEndRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const handleSendRef = useRef(null);

  // 语音识别
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceSupported(false); return; }
    const rec = new SR();
    rec.lang = "zh-CN"; rec.continuous = false; rec.interimResults = true;
    rec.onresult = (event) => {
      let interim = "", final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t; else interim += t;
      }
      if (final) finalTranscriptRef.current = final;
      setInput(finalTranscriptRef.current + interim);
    };
    rec.onerror = (event) => {
      setIsRecording(false);
      if (event.error === "not-allowed") setVoiceError("请允许麦克风权限");
      else if (event.error === "no-speech") setVoiceError("没听到声音，请重试");
      else setVoiceError(`错误：${event.error}`);
      setTimeout(() => setVoiceError(""), 3000);
    };
    rec.onend = () => {
      setIsRecording(false);
      const text = finalTranscriptRef.current.trim();
      if (text) {
        finalTranscriptRef.current = "";
        setTimeout(() => handleSendRef.current(text, true), 300);
      }
    };
    recognitionRef.current = rec;
  }, []);

  // 画像初始化
  useEffect(() => {
    const saved = loadProfile();
    setProfile(saved);
    const welcome = isProfileComplete(saved)
      ? `欢迎回来！😊 我还记得您的信息：\n\n- 年龄：${saved.age}岁\n- 性别：${saved.gender}\n- 月薪：¥${saved.salary?.toLocaleString()}\n${saved.city ? `- 城市：${saved.city}\n` : ""}\n可以文字或语音跟我交流~`
      : "您好！我是**安享养老**AI规划助手 🏡\n\n我可以帮您：\n- 🧮 精确测算养老金\n- 📊 分析养老缺口\n- 💡 推荐补充方案\n\n支持**文字**和**语音**两种交流方式~";
    setMessages([{ role: "assistant", content: welcome, sources: [], retrievedDocs: [], functionCalls: [], isVoice: false }]);
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function toggleRecording() {
    if (!voiceSupported) { setVoiceError("浏览器不支持语音"); setTimeout(() => setVoiceError(""), 3000); return; }
    if (isRecording) recognitionRef.current?.stop();
    else {
      setInput(""); finalTranscriptRef.current = ""; setVoiceError("");
      try { recognitionRef.current?.start(); setIsRecording(true); } catch (e) { console.error(e); }
    }
  }

  async function playTTS(text, msgIdx) {
    const cleanText = text.replace(/[*_`#\[\]]/g, "").replace(/\n+/g, "，").substring(0, 500);
    if (!isUsingRealApi || apiKey === "YOUR_MINIMAX_API_KEY") {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(cleanText);
        u.lang = "zh-CN"; u.rate = 1.05;
        setCurrentPlayingIdx(msgIdx);
        u.onend = () => setCurrentPlayingIdx(null);
        u.onerror = () => setCurrentPlayingIdx(null);
        window.speechSynthesis.speak(u);
      }
      return;
    }
    try {
      setCurrentPlayingIdx(msgIdx);
      const r = await fetch(MINIMAX_TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MINIMAX_TTS_MODEL, text: cleanText,
          voice_setting: { voice_id: DEFAULT_VOICE_ID, speed: 1.0, vol: 1.0, pitch: 0 },
          audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3" },
        }),
      });
      if (!r.ok) throw new Error(`TTS ${r.status}`);
      const data = await r.json();
      if (data.data?.audio) {
        const bytes = new Uint8Array(data.data.audio.match(/.{1,2}/g).map(b => parseInt(b, 16)));
        const blob = new Blob([bytes], { type: "audio/mp3" });
        const url = URL.createObjectURL(blob);
        if (audioRef.current) audioRef.current.pause();
        audioRef.current = new Audio(url);
        audioRef.current.onended = () => setCurrentPlayingIdx(null);
        audioRef.current.play();
      }
    } catch (err) {
      console.error("TTS:", err);
      setCurrentPlayingIdx(null);
      if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(cleanText);
        u.lang = "zh-CN";
        setCurrentPlayingIdx(msgIdx);
        u.onend = () => setCurrentPlayingIdx(null);
        window.speechSynthesis.speak(u);
      }
    }
  }

  function stopTTS() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setCurrentPlayingIdx(null);
  }

  async function callMiniMaxAPI(userMessages, retrievedDocs, functionResults, isVoice) {
    const sp = buildSystemPrompt(retrievedDocs, functionResults, profile, isVoice);
    const r = await fetch(MINIMAX_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        messages: [{ role: "system", content: sp }, ...userMessages.map(m => ({ role: m.role, content: m.content }))],
        temperature: 0.7, max_tokens: 1000,
      }),
    });
    if (!r.ok) throw new Error(`API ${r.status}`);
    const data = await r.json();
    return data.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  }

  async function handleSend(text, isVoice = false) {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const { profile: np, hasUpdate } = extractProfileFromMessage(messageText, profile);
    if (hasUpdate) { setProfile(np); saveProfile(np); }
    const cp = hasUpdate ? np : profile;

    const rd = retrieveKnowledge(messageText);
    const { intent, params } = detectIntent(messageText, cp);
    const fr = intent !== "chat" ? executeFunctionCall(intent, params) : [];

    if (fr.length > 0) {
      const h = loadCalcHistory();
      h.push({ date: new Date().toLocaleDateString("zh-CN"), results: fr });
      saveCalcHistory(h);
    }

    const newMessages = [...messages, { role: "user", content: messageText, sources: [], retrievedDocs: [], functionCalls: [], isVoice }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      let reply;
      const sources = rd.map(d => ({ title: d.title, category: d.category }));
      if (isUsingRealApi && apiKey !== "YOUR_MINIMAX_API_KEY") {
        reply = await callMiniMaxAPI(newMessages, rd, fr, isVoice);
      } else {
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
        if (fr.length > 0) {
          const pr = fr.find(f => f.functionName === "养老金测算");
          const gr = fr.find(f => f.functionName === "养老缺口分析");
          const sr = fr.find(f => f.functionName === "补充方案推荐");
          let t = "";
          if (hasUpdate) t += `✅ 已更新您的信息\n\n`;
          if (pr) {
            t += `根据您的信息精确测算 🧮\n\n📊 **养老金预估：**\n`;
            t += `- 基础养老金：¥${pr.result.基础养老金.toLocaleString()}/月\n`;
            t += `- 个人账户养老金：¥${pr.result.个人账户养老金.toLocaleString()}/月\n`;
            t += `- **合计：¥${pr.result.养老金合计.toLocaleString()}/月**\n`;
          }
          if (gr) t += `\n💡 **缺口：** ${gr.result.缺口状态}\n`;
          if (sr) t += `\n🎯 组合方案可覆盖 **${sr.result.方案三_组合推荐.缺口覆盖率}** 缺口`;
          if (!t) t = "您好！请告诉我您的信息，比如：女，28岁，北京，月薪1.5万";
          reply = t;
        } else {
          reply = hasUpdate ? `收到！已记住 ✅ 可以问我"帮我算养老金"` : `请告诉我您的基本信息~`;
        }
      }

      const newMsg = { role: "assistant", content: reply, sources, retrievedDocs: rd, functionCalls: fr, isVoice };
      setMessages([...newMessages, newMsg]);
      if (isVoice) setTimeout(() => playTTS(reply, newMessages.length), 300);
    } catch (err) {
      setMessages([...newMessages, { role: "assistant", content: `抱歉：${err.message}`, sources: [], retrievedDocs: [], functionCalls: [], isVoice: false }]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { handleSendRef.current = handleSend; });

  function clearProfile() {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    setProfile({}); setShowProfile(false);
    setMessages([{ role: "assistant", content: "已清除所有记忆 🔄", sources: [], retrievedDocs: [], functionCalls: [], isVoice: false }]);
  }

  function toggleSection(key) { setExpandedSections((p) => ({ ...p, [key]: !p[key] })); }

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

  const isSpeaking = currentPlayingIdx !== null;

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
              {" · RAG+FC+Memory+Voice+"}
              <span style={{ color: "#d4380d" }}>🤖Avatar</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={styles.iconBtn} onClick={() => setShowProfile(!showProfile)}>👤</button>
          <button style={styles.iconBtn} onClick={() => setShowApiModal(true)}>⚙️</button>
        </div>
      </div>

      {/* 🤖 数字人形象 */}
      <DigitalAvatar
        isSpeaking={isSpeaking}
        isListening={isRecording}
        isThinking={isLoading}
      />

      {/* Profile Card */}
      {showProfile && (
        <div style={styles.profileCard}>
          <div style={styles.profileHeader}>
            <span style={styles.profileTitle}>🧠 用户记忆</span>
            <button style={styles.clearBtn} onClick={clearProfile}>清除</button>
          </div>
          {isProfileComplete(profile) ? (
            <div style={styles.profileGrid}>
              <div style={styles.profileItem}><span style={styles.profileLabel}>年龄</span><span style={styles.profileValue}>{profile.age}岁</span></div>
              <div style={styles.profileItem}><span style={styles.profileLabel}>性别</span><span style={styles.profileValue}>{profile.gender}</span></div>
              <div style={styles.profileItem}><span style={styles.profileLabel}>月薪</span><span style={styles.profileValue}>¥{profile.salary?.toLocaleString()}</span></div>
              <div style={styles.profileItem}><span style={styles.profileLabel}>城市</span><span style={styles.profileValue}>{profile.city || "—"}</span></div>
            </div>
          ) : (<div style={styles.profileEmpty}>暂无记忆</div>)}
        </div>
      )}

      {voiceError && <div style={styles.errorBar}>⚠️ {voiceError}</div>}

      {/* Chat */}
      <div style={styles.chatArea}>
        {messages.map((msg, idx) => (
          <div key={idx}>
            <div style={{ ...styles.msgRow, justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              {msg.role === "assistant" && <div style={styles.avatarBot}>🤖</div>}
              <div style={msg.role === "user" ? styles.bubbleUser : styles.bubbleBot}>
                {msg.isVoice && msg.role === "user" && (<div style={styles.voiceTag}>🎤 语音消息</div>)}
                <div style={styles.msgText}>{renderContent(msg.content)}</div>

                {msg.role === "assistant" && (
                  <button
                    style={{ ...styles.playBtn, ...(currentPlayingIdx === idx ? styles.playBtnActive : {}) }}
                    onClick={() => currentPlayingIdx === idx ? stopTTS() : playTTS(msg.content, idx)}
                  >
                    {currentPlayingIdx === idx ? "⏸ 停止" : "🔊 朗读"}
                  </button>
                )}

                {msg.role === "assistant" && msg.functionCalls?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    {msg.functionCalls.map((fc, fi) => renderFunctionCard(fc, fi, idx))}
                  </div>
                )}

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
                          return (<div key={si} style={styles.sourceItem}>
                            <span style={{ ...styles.sourceTag, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{src.category}</span>
                            <span style={styles.sourceTitle}>{src.title}</span>
                          </div>);
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

      {isRecording && <div style={styles.recordingHint}>🔴 正在聆听...</div>}

      <div style={styles.inputArea}>
        <div style={styles.inputWrapper}>
          <button
            style={{ ...styles.micBtn, ...(isRecording ? styles.micBtnActive : {}) }}
            onClick={toggleRecording}
          >{isRecording ? "⏹" : "🎤"}</button>
          <input
            style={styles.input} value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend(null, false)}
            placeholder={isRecording ? "正在聆听..." : "输入文字或点🎤语音"}
            disabled={isLoading || isRecording}
          />
          <button
            style={{ ...styles.sendBtn, opacity: input.trim() && !isLoading ? 1 : 0.4 }}
            onClick={() => handleSend(null, false)}
            disabled={!input.trim() || isLoading}
          >➤</button>
        </div>
        <div style={styles.poweredBy}>V6 · Digital Avatar + Voice + Memory + FC + RAG</div>
      </div>

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
        @keyframes recordPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes statusPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
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
  header: { position: "relative", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px 8px" },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logo: { width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #d4380d 0%, #fa541c 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(212,56,13,0.3)" },
  logoIcon: { fontSize: 20 },
  headerTitle: { fontSize: 15, fontWeight: 700, color: "#1a1a1a" },
  headerSub: { fontSize: 10, color: "#8c6d52", marginTop: 1 },
  iconBtn: { background: "rgba(255,255,255,0.7)", border: "none", borderRadius: 10, width: 36, height: 36, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  profileCard: { position: "relative", zIndex: 10, margin: "4px 20px 8px", padding: "12px 14px", background: "#fff", borderRadius: 14, border: "1px solid #e8f5e9", boxShadow: "0 2px 8px rgba(56,142,60,0.08)" },
  profileHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  profileTitle: { fontSize: 13, fontWeight: 600, color: "#2e7d32" },
  clearBtn: { fontSize: 10, color: "#e53935", background: "none", border: "1px solid #ffcdd2", borderRadius: 6, padding: "2px 8px", cursor: "pointer" },
  profileGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
  profileItem: { display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#f1f8e9", borderRadius: 6 },
  profileLabel: { fontSize: 11, color: "#689f38" },
  profileValue: { fontSize: 11, fontWeight: 600, color: "#33691e" },
  profileEmpty: { fontSize: 11, color: "#aaa", textAlign: "center", padding: 6 },
  errorBar: { margin: "0 20px 8px", padding: "6px 12px", background: "#fff2e8", border: "1px solid #ffd591", borderRadius: 10, color: "#d46b08", fontSize: 11 },
  chatArea: { position: "relative", zIndex: 10, flex: 1, overflowY: "auto", padding: "4px 16px" },
  msgRow: { display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 12, animation: "fadeSlideUp 0.35s ease-out" },
  avatarBot: { width: 30, height: 30, borderRadius: 10, background: "linear-gradient(135deg, #fff5f0, #ffe7d6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0, border: "1px solid #ffd6b0" },
  avatarUser: { width: 30, height: 30, borderRadius: 10, background: "linear-gradient(135deg, #d4380d, #fa541c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 },
  bubbleBot: { maxWidth: "82%", padding: "10px 14px", background: "#ffffff", borderRadius: "16px 16px 16px 4px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", border: "1px solid #f0e8e0" },
  bubbleUser: { maxWidth: "78%", padding: "10px 14px", background: "linear-gradient(135deg, #d4380d, #fa541c)", borderRadius: "16px 16px 4px 16px", color: "#fff", boxShadow: "0 2px 8px rgba(212,56,13,0.25)" },
  msgText: { fontSize: 13, lineHeight: 1.6, color: "inherit" },
  voiceTag: { fontSize: 10, background: "rgba(255,255,255,0.25)", color: "#fff", padding: "2px 8px", borderRadius: 8, display: "inline-block", marginBottom: 4 },
  playBtn: { marginTop: 6, padding: "3px 10px", background: "#faf7f4", border: "1px solid #e8ddd2", borderRadius: 10, fontSize: 10, color: "#8c5a3a", cursor: "pointer" },
  playBtnActive: { background: "#fff3e8", border: "1px solid #fa8c16", color: "#d4380d" },
  fcCard: { marginTop: 6, border: "1px solid #ffe0cc", borderRadius: 10, overflow: "hidden", background: "#fff9f5" },
  fcHeader: { display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", cursor: "pointer", background: "linear-gradient(135deg, #fff5ee, #fff0e5)" },
  fcName: { fontSize: 11, fontWeight: 600, color: "#d4380d" },
  fcToggle: { fontSize: 9, color: "#e8a080", marginLeft: "auto" },
  fcBody: { padding: "6px 10px" },
  fcSection: { marginBottom: 6 },
  fcSectionTitle: { fontSize: 10, fontWeight: 600, color: "#8c5a3a", marginBottom: 3 },
  fcRow: { display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px solid #f5ebe3" },
  fcKey: { fontSize: 10, color: "#8c7a6a" },
  fcValue: { fontSize: 10, color: "#333", fontWeight: 500, maxWidth: "60%", textAlign: "right", whiteSpace: "pre-wrap", wordBreak: "break-all" },
  sourcesArea: { marginTop: 8, borderTop: "1px solid #f0e8e0", paddingTop: 6 },
  sourcesHeader: { display: "flex", alignItems: "center", gap: 5, cursor: "pointer" },
  sourcesLabel: { fontSize: 11, color: "#8c6d52", fontWeight: 500 },
  sourcesToggle: { fontSize: 9, color: "#bfa88a", marginLeft: "auto" },
  sourcesList: { marginTop: 6 },
  sourceItem: { display: "flex", alignItems: "center", gap: 6, marginBottom: 4 },
  sourceTag: { fontSize: 9, padding: "2px 6px", borderRadius: 8, fontWeight: 500, flexShrink: 0 },
  sourceTitle: { fontSize: 11, color: "#5c3a1e" },
  typingArea: { display: "flex", alignItems: "center", gap: 8 },
  typingIndicator: { display: "flex", gap: 4, padding: "2px 0" },
  typingDot: { width: 6, height: 6, borderRadius: "50%", background: "#d4380d", display: "inline-block", animation: "typingBounce 1.2s infinite" },
  typingText: { fontSize: 11, color: "#bfa88a" },
  quickArea: { position: "relative", zIndex: 10, padding: "4px 16px 6px", display: "flex", flexWrap: "wrap", gap: 6 },
  quickBtn: { display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "#ffffff", border: "1px solid #f0e0d0", borderRadius: 18, cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", flexShrink: 0 },
  quickIcon: { fontSize: 14 },
  quickText: { fontSize: 12, color: "#5c3a1e", fontWeight: 500 },
  recordingHint: { position: "relative", zIndex: 10, margin: "0 20px 6px", padding: "6px 12px", background: "#fff1f0", border: "1px solid #ffccc7", borderRadius: 10, color: "#cf1322", fontSize: 11, textAlign: "center" },
  inputArea: { position: "relative", zIndex: 10, padding: "8px 16px 14px", background: "rgba(250,247,244,0.95)", borderTop: "1px solid #f0e8e0" },
  inputWrapper: { display: "flex", alignItems: "center", gap: 6, background: "#ffffff", borderRadius: 22, padding: "3px 5px", border: "1px solid #e8ddd2", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
  micBtn: { width: 36, height: 36, borderRadius: "50%", background: "#fff3e8", border: "1px solid #ffd591", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" },
  micBtnActive: { background: "#ff4d4f", border: "1px solid #cf1322", color: "#fff", animation: "recordPulse 1.2s infinite" },
  input: { flex: 1, border: "none", outline: "none", fontSize: 13, background: "transparent", color: "#333", fontFamily: "'Noto Sans SC', sans-serif", padding: "8px 4px" },
  sendBtn: { width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #d4380d, #fa541c)", border: "none", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  poweredBy: { textAlign: "center", fontSize: 9, color: "#c4a882", marginTop: 6 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)" },
  modal: { background: "#fff", borderRadius: 20, padding: "28px 24px", width: "90%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 12 },
  modalInput: { width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid #e8e0d8", fontSize: 13, outline: "none", fontFamily: "monospace", background: "#faf7f4" },
  modalBtnPrimary: { flex: 1, padding: "12px 0", borderRadius: 12, background: "linear-gradient(135deg, #d4380d, #fa541c)", border: "none", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  modalBtnSecondary: { flex: 1, padding: "12px 0", borderRadius: 12, background: "#f5f0eb", border: "1px solid #e8ddd2", color: "#5c3a1e", fontSize: 14, fontWeight: 500, cursor: "pointer" },
};
