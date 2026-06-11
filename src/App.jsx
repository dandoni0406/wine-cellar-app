import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './storage.js';

const STORAGE_KEY = "wine-cellar-v6";
const CY = new Date().getFullYear();
const RED = "#8B2635", GOLD = "#9A7020";
// ── WSET 시음 지표 레퍼런스 (구글시트 config 기반) ──
const T_SCALE = {
  noseIntensity:["약함","중간-","중간","중간+","강함"],
  acidity:["낮음","중간-","중간","중간+","높음"],
  tannin:["거의 없음","부드러움","중간","뻑뻑함","매우 강함"],
  body:["가벼움","다소 가벼움","중간","다소 무거움","풀 바디"],
  finish:["짧음","약간 짧음","중간","약간 김","김"],
};
const T_COLOR = {
  White:["그린 레몬","레몬","골드","앰버"],
  Red:["퍼플","루비","가넷","벽돌/타니"],
  "Rosé":["핑크","연어색","오렌지"],
  Sparkling:["레몬","골드","핑크"],
  Dessert:["골드","앰버","갈색"],
  Fortified:["루비","가넷","갈색"],
};
const T_SWEET = ["완전 드라이","드라이","살짝 단맛","반건조","중간 단맛","스위트","매우 달콤"];
const T_ALC = ["낮음","중간","높음","주정강화"];
const T_AROMA = [
  ["꽃",[["🌸","장미"],["💐","제비꽃"],["🌼","아카시아"],["🍯","인동초"],["🍊","오렌지블라썸"],["🍂","말린꽃"]]],
  ["시트러스",[["🍋","레몬"],["🟢","라임"],["🍊","자몽"],["🔸","오렌지껍질"]]],
  ["핵과/인과",[["🍏","청사과"],["🍐","배"],["🍑","복숭아"],["🥭","살구"]]],
  ["열대과일",[["🍍","파인애플"],["🥭","망고"],["🍈","리치"],["🟠","패션후르츠"]]],
  ["레드베리",[["🍓","딸기"],["🍒","라즈베리"],["🍒","레드체리"],["🔴","레드커런트"]]],
  ["블랙베리",[["🫐","블랙베리"],["🍇","블랙커런트"],["🖤","블랙체리"],["🫐","블루베리"],["🟣","자두/플럼"]]],
  ["허브",[["🌿","민트"],["🍃","유칼립투스"],["🌿","로즈마리"],["🌿","타임"],["🌱","갓자른풀"]]],
  ["채소",[["🫑","피망"],["🎋","아스파라거스"],["🍅","토마토잎"]]],
  ["스파이스",[["🧂","검은후추"],["⚪","흰후추"],["🍭","감초"],["🔨","정향"],["🪵","시나몬"]]],
  ["오크(2차)",[["🍦","바닐라"],["🥥","코코넛"],["🍞","토스트"],["🌲","시더"],["💨","스모크"],["🧈","버터/크림"],["🍪","비스킷/빵"]]],
  ["숙성(3차)",[["👞","가죽"],["🐄","외양간/고기"],["🪵","흙/숲바닥"],["🍄","버섯"],["💎","트러플"],["🚬","담배"],["✏️","흑연"],["🌰","견과"],["🍇","건과일"]]],
  ["미네랄",[["🔥","부싯돌"],["🪨","젖은돌"],["⚪","분필"]]],
];
const T_FLAVOR = [
  ["상태",[["✨","신선/아삭"],["☀️","잘익은"],["🍯","졸인/잼"],["🏜️","말린"],["🍂","산화된"]]],
  ["풍미",[["🫐","야생베리"],["🍇","검은과실"],["🍋","시트러스제스트"],["🍯","꿀/밀랍"],["🍫","다크초콜릿"],["🍫","밀크초콜릿"],["☕","커피"],["🍮","캐러멜"],["🥜","구운견과"],["🥩","감칠맛"],["🧪","약초/한약재"],["🍵","홍차"],["🏴","타르"],["✏️","흑연/광물"],["🧂","짭짤한"]]],
  ["질감",[["🍦","크리미"],["🧴","오일리"],["☁️","파우더리"],["💦","쥬시"],["⚡","거친"],["🧣","실키"],["🍷","벨벳"]]],
];
const GDRIVE_MCP = "https://drivemcp.googleapis.com/mcp/v1";
const GDRIVE_FILE = "wine-cellar-data.json";

const CRITICS = [
  { k:"bh", ab:"BH", name:"Burghound",       max:100, burg:true },
  { k:"ws", ab:"WS", name:"Wine Spectator",  max:100 },
  { k:"wa", ab:"WA", name:"Wine Advocate",   max:100 },
  { k:"vinous",ab:"VIN",name:"Vinous",       max:100 },
  { k:"js", ab:"JS", name:"James Suckling",  max:100 },
  { k:"jr", ab:"JR", name:"Jancis Robinson", max:20  },
  { k:"dec",ab:"DEC",name:"Decanter",        max:100 },
  { k:"jm", ab:"JM", name:"Jasper Morris",   max:100, burg:true },
];
const TICON = { Red:"🍷", White:"🥂", "Rosé":"🌸", Sparkling:"✨", Dessert:"🍯", Fortified:"🔮" };

const COUNTRY_KO = {
  "France":"프랑스","Italia":"이탈리아","Italy":"이탈리아","Germany":"독일",
  "Deutschland":"독일","Spain":"스페인","España":"스페인","Portugal":"포르투갈",
  "United States":"미국","USA":"미국","US":"미국","Australia":"호주",
  "New Zealand":"뉴질랜드","Argentina":"아르헨티나","Chile":"칠레",
  "South Africa":"남아공","Austria":"오스트리아","Hungary":"헝가리",
  "Greece":"그리스","Georgia":"조지아","Lebanon":"레바논","Japan":"일본","China":"중국",
};
function normCountry(c){ return COUNTRY_KO[c]||c||""; }


// Filter out AI disclaimer messages from expert notes
function isDisclaimerNote(note) {
  if (!note) return false;
  const disclaimers = ["확인할 수 없습니다","학습 데이터","권장합니다","directly confirm","cannot confirm","no tasting note","not available","데이터 내에서","공개 테이스팅 노트를","Please refer","자세한 정보를","확인 부탁","빈티지에 대한 주요"];
  return disclaimers.some(d => note.includes(d));
}

// ── AOC / Appellation categorizer ────────────────────────────────

function avgScore(wine) {
  const rat = wine.expertRatings||{};
  const scores = Object.values(rat)
    .filter(Boolean)
    .map(s => parseFloat(s))
    .filter(s => !isNaN(s) && s > 20); // exclude JR /20 scale
  if (!scores.length) return null;
  return { avg: Math.round(scores.reduce((a,b)=>a+b,0)/scores.length), count: scores.length };
}

function getAOC(wine) {
  const r  = (wine.region||"").toLowerCase();
  const sr = (wine.subRegion||"").toLowerCase();
  const c  = (wine.country||"").toLowerCase();
  const all = r + " " + sr;
  if(all.includes("burgund")||all.includes("bourgogne")||all.includes("부르고뉴")||
     ["gevrey","chambolle","vosne","nuits","puligny","meursault","chablis","beaune","pommard","volnay","marsannay","morey","macon","givry","pouilly"].some(v=>all.includes(v)))
    return "🍇 부르고뉴";
  if(all.includes("bordeaux")||all.includes("보르도")||
     ["medoc","margaux","pauillac","saint-estephe","saint-julien","saint-emilion","pomerol","sauternes","pessac","graves"].some(v=>all.includes(v)))
    return "🏰 보르도";
  if(all.includes("champagne")||all.includes("샴페인"))
    return "✨ 샴페인";
  if(all.includes("rhone")||all.includes("rhône")||all.includes("론")||
     ["chateauneuf","hermitage","cote-rotie","gigondas","condrieu","crozes"].some(v=>all.includes(v)))
    return "☀️ 론";
  if(all.includes("alsace")||all.includes("알자스")) return "🌸 알자스";
  if(all.includes("loire")||all.includes("루아르")||
     ["muscadet","sancerre","pouilly-fume","vouvray","chinon"].some(v=>all.includes(v)))
    return "🌊 루아르";
  if(c.includes("france")||c.includes("프랑스")) return "🗼 프랑스 기타";
  if(all.includes("barolo")||all.includes("barbaresco")||all.includes("barbar")||
     all.includes("piedmont")||all.includes("piemonte")||all.includes("피에몬테")||
     ["langhe","alba","asti","gavi","barbera","dolcetto"].some(v=>all.includes(v)))
    return "🌹 바롤로/피에몬테";
  if(all.includes("tuscany")||all.includes("toscana")||all.includes("토스카나")||
     ["chianti","brunello","bolgheri","montalcino","super tuscan","vino nobile"].some(v=>all.includes(v)))
    return "🦅 토스카나";
  if(c.includes("itali")||c.includes("이탈리아")) return "🇮🇹 이탈리아 기타";
  if(c.includes("german")||c.includes("독일")||
     ["mosel","rheingau","pfalz","nahe","rheinhessen"].some(v=>all.includes(v)))
    return "🏞 독일";
  if(c.includes("spain")||c.includes("스페인")||
     ["rioja","ribera","priorat","rias baixas","penedes"].some(v=>all.includes(v)))
    return "🌞 스페인";
  if(c.includes("portugal")||c.includes("포르투갈")) return "🌿 포르투갈";
  if(c.includes("united states")||c.includes("미국")||
     ["napa","sonoma","willamette","russian river"].some(v=>all.includes(v)))
    return "🇺🇸 미국";
  if(c.includes("australia")||c.includes("호주")) return "🦘 호주";
  if(c.includes("new zealand")||c.includes("뉴질랜드")) return "🥝 뉴질랜드";
  if(c.includes("argentina")||c.includes("아르헨티나")||all.includes("mendoza")) return "🌿 아르헨티나";
  if(c.includes("chile")||c.includes("칠레")) return "🌶 칠레";
  return "🌐 기타";
}

function getDrinkStatus(from, until) {
  if (!from || !until) return null;
  if (String(from).toUpperCase() === "NV") return "nv";
  const f = parseInt(from), u = parseInt(String(until).replace(/\+/g,""));
  if (isNaN(f)||isNaN(u)) return null;
  if (CY > u) return "past";
  if (CY >= f && u-CY <= 1) return "urgent";
  if (CY >= f) return "now";
  return "young";
}
const DB = {
  past:  {bg:"#FEE2E2",c:"#991B1B",l:"피크지남"},
  urgent:{bg:"#FEF3C7",c:"#92400E",l:"곧마감"},
  now:   {bg:"#D1FAE5",c:"#065F46",l:"지금적기"},
  young: {bg:"#DBEAFE",c:"#1E40AF",l:"숙성중"},
  nv:    {bg:"#F3E8FF",c:"#6B21A8",l:"NV"},
};
function cleanName(name, vintage) {
  if (!name||!vintage) return name||"";
  return name.replace(new RegExp(`\\s*${vintage}\\s*$`), "").trim();
}
function compressImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(800/img.width, 800/img.height, 1);
        canvas.width = img.width*ratio; canvas.height = img.height*ratio;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
function hasData(obj) { return obj && Object.values(obj).some(v => v && String(v).trim()); }

// ── Storage & API ─────────────────────────────────────────────────
async function loadLocal(){
  // Try current key first, then migrate from older keys
  const keys=["wine-cellar-v6","wine-cellar-v5","wine-cellar-v4","wine-cellar-v3","wine-cellar-v2","wine-cellar-v1"];
  for(const k of keys){
    try{const r=await window.storage.get(k);if(r){const d=JSON.parse(r.value);if(d.wines&&d.wines.length>0)return d;}}catch(e){}
  }
  return{wines:[],notes:[]};
}
async function saveLocal(w,n){try{await window.storage.set(STORAGE_KEY,JSON.stringify({wines:w,notes:n}));}catch(e){}}

// 기존 Base64 라벨사진을 images/{id} 별도 문서로 이전 → cellar/main 용량 축소.
// 한 번만 수행, 각 이미지 저장 성공 후에만 Base64 제거(유실 방지).
let _migrating = false;
async function migrateImages(wines, notes){
  if(_migrating || !window.storage?.setImage) return null;
  const targets = (wines||[]).filter(w => typeof w.labelPhoto==="string" && w.labelPhoto.startsWith("data:") && !w.labelPhotoId);
  if(targets.length===0) return null;
  _migrating = true;
  try {
    let changed = false;
    const updated = [...wines];
    for(const w of targets){
      try {
        const id = await window.storage.setImage(w.labelPhoto);
        if(id){
          _imgCache[id] = w.labelPhoto;
          const idx = updated.findIndex(x=>x.id===w.id);
          if(idx>=0){ updated[idx] = {...updated[idx], labelPhotoId:id, labelPhoto:""}; changed=true; }
        }
      } catch(e){ /* 이 사진은 다음 번에 재시도 */ }
    }
    if(changed){ await saveLocal(updated, notes); return updated; }
    return null;
  } finally { _migrating = false; }
}
async function callClaude(prompt, tokens, drive){
  // NOTE: Direct Anthropic API calls only work inside the Claude.ai artifact
  // sandbox (which injects auth). In this deployed standalone app there is no
  // proxy, so this will fail. Use Gemini instead: open Settings and paste a
  // free Gemini API key from https://aistudio.google.com/apikey
  throw new Error("배포 환경에서는 Claude 직접 호출이 안 됩니다. ⚙️ 설정에서 Gemini API 키를 입력해 Gemini로 전환하세요.");
}

async function callGemini(prompt, apiKey, tokens, model){
  model = model || _aiModel || "gemini-2.5-flash";
  const isPro = model.includes("pro");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const genConfig = {
    maxOutputTokens: Math.max(tokens||2000, isPro?16000:6000),
    temperature:0.15,
    responseMimeType:"application/json"   // JSON 모드 강제 → 인사말/마크다운 없이 순수 JSON, 파싱 먹통 방지
  };
  if(!isPro) genConfig.thinkingConfig = {thinkingBudget:0};  // Flash만 thinking 끔 (Pro는 thinking 필수라 끄지 않음)
  const body = JSON.stringify({ contents:[{parts:[{text:prompt}]}], generationConfig:genConfig });
  const sleep = ms => new Promise(res=>setTimeout(res,ms));
  // 503/500/일시 오류는 자동 재시도(최대 2회), 429 한도는 재시도 안 함
  let lastStatus = 0;
  for(let attempt=0; attempt<3; attempt++){
    if(attempt>0) await sleep(attempt*2000); // 2초, 4초 대기
    let r;
    try {
      r = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body });
    } catch(netErr) { lastStatus="network"; continue; } // 네트워크 일시 오류 → 재시도
    if(r.ok){
      const data = await r.json();
      if(data.error){ aiNotify("error"); throw new Error(data.error.message); }
      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = (parts.find(p => !p.thought) || parts[0])?.text || "{}";
      return {content:[{type:"text",text}]};
    }
    if(r.status===429){ aiNotify("limit"); throw new Error("RATE_LIMIT 429"); } // 한도는 즉시 중단
    lastStatus = r.status;
    if(r.status>=500 || r.status===503) continue; // 서버 일시 오류 → 재시도
    aiNotify("error", r.status); throw new Error(`Gemini HTTP ${r.status}`); // 그 외 오류는 즉시 중단
  }
  // 재시도 모두 실패
  aiNotify("error", lastStatus);
  throw new Error(`Gemini ${lastStatus} (재시도 실패)`);
}

// Unified AI caller — routes to Gemini or Claude based on settings
let _aiProvider = "gemini"; // deployed default; user supplies Gemini key in Settings
let _geminiKey = "";
let _aiModel = "gemini-2.5-flash"; // 기본 모델 (설정에서 변경)
let _ratingBoost = true;           // 평점 비었을 때 Pro로 보강
let _ratingModel = "gemini-2.5-pro"; // 보강용 모델
function setAIProvider(p, key){ _aiProvider=p; _geminiKey=key||""; }
function setAIModel(m){ if(m) _aiModel = m; }
function setRatingBoost(on, model){ _ratingBoost = !!on; if(model) _ratingModel = model; }

// AI 오류 알림 (429 한도초과 vs 일반오류 구분, 3초 디바운스)
let _lastNotify = 0;
function aiNotify(kind, status){
  const now = Date.now();
  if(now - _lastNotify < 3000) return;
  _lastNotify = now;
  if(typeof window === "undefined") return;
  if(kind === "limit"){
    window.alert("⏳ AI 호출 한도 초과\n\nGemini 무료 등급의 분당/일일 한도에 도달했습니다. (요금 청구 아님)\n잠시 후(약 1분) 다시 시도하거나, 내일 다시 시도하세요.");
  } else {
    window.alert("⚠️ AI 호출 오류" + (status?` (${status})`:"") + "\n\n네트워크 연결 또는 ⚙️설정의 Gemini 키를 확인하세요.");
  }
}

async function callAI(prompt, tokens, model){
  if(_aiProvider==="gemini" && _geminiKey.trim()){
    return callGemini(prompt, _geminiKey.trim(), tokens, model);
  }
  return callClaude(prompt, tokens, false);
}
async function aiJson(prompt, tokens, model){
  try {
    const d=await callAI(prompt,tokens||1500,model);
    const raw=d.content?.find(c=>c.type==="text")?.text||"{}";
    // Strip markdown fences (JSON 모드면 거의 불필요하나 안전망)
    const stripped=raw.replace(/```json\n?|\n?```/g,"").trim();
    try { return JSON.parse(stripped); } catch(e1) {}
    const m=stripped.match(/\{[\s\S]*\}/);
    if(m) { try { return JSON.parse(m[0]); } catch(e2) {} }
    const ma=stripped.match(/\[[\s\S]*\]/);
    if(ma) { try { return JSON.parse(ma[0]); } catch(e3) {} }
    return {};
  } catch(e) { return {}; }
}
const PRO = "gemini-2.5-pro";  // 품질 중요한 호출용
// ── AI 라벨 스캐너 (Gemini Vision) ────────────────────────────────
async function callGeminiVision(prompt, dataUrl, tokens){
  const apiKey=(_geminiKey||"").trim();
  if(!apiKey) throw new Error("설정(⚙️)에서 Gemini 키를 먼저 입력하세요");
  const mm=(dataUrl||"").match(/^data:(image\/[\w+]+);base64,(.+)$/);
  const mime=mm?.[1]||"image/jpeg", b64=mm?.[2]||"";
  if(!b64) throw new Error("이미지 데이터를 읽지 못했습니다");
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${_aiModel||"gemini-2.5-flash"}:generateContent?key=${apiKey}`;
  const body=JSON.stringify({contents:[{parts:[{text:prompt},{inline_data:{mime_type:mime,data:b64}}]}],
      generationConfig:{maxOutputTokens:Math.max(tokens||1500,4000),temperature:0.1,thinkingConfig:{thinkingBudget:0},responseMimeType:"application/json"}});
  const sleep=ms=>new Promise(res=>setTimeout(res,ms));
  let r, lastStatus=0;
  for(let attempt=0; attempt<3; attempt++){
    if(attempt>0) await sleep(attempt*2000);
    try { r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body}); }
    catch(netErr){ lastStatus="network"; continue; }
    if(r.ok) break;
    if(r.status===429) throw new Error("RATE_LIMIT 429");
    lastStatus=r.status;
    if(r.status>=500) continue;
    throw new Error(`Gemini HTTP ${r.status}`);
  }
  if(!r || !r.ok) throw new Error(`Gemini ${lastStatus} (재시도 실패)`);
  const data=await r.json();
  if(data.error) throw new Error(data.error.message);
  const parts=data.candidates?.[0]?.content?.parts||[];
  const raw=(parts.find(p=>!p.thought)||parts[0])?.text||"{}";
  const s=raw.replace(/```json\n?|\n?```/g,"").trim();
  try{return JSON.parse(s);}catch(e){const m=s.match(/\{[\s\S]*\}/);if(m){try{return JSON.parse(m[0]);}catch(e2){}}}
  return {};
}
const scanLabel = (dataUrl) => callGeminiVision(
`이 와인 라벨 사진을 보고 라벨에 실제로 적힌 정보만 읽어 JSON으로만 반환. 추측 금지, 안 보이면 빈 문자열. 마크다운 없이 순수 JSON만.
{"nameEN":"라벨의 영문 와인명(생산자+밭/마을 포함해서 가능한 완전하게)","producer":"생산자","vintage":"빈티지 연도숫자(NV면 NV)"}`, dataUrl, 1500);
function extractBlocks(blocks, wantArray){
  for(const b of blocks||[]){
    const texts=[b.text,...((b.content||[]).map(c=>c.text))].filter(Boolean);
    for(const t of texts){try{const p=JSON.parse(t.replace(/```json\n?|\n?```/g,"").trim());if(wantArray?Array.isArray(p):p.wines)return p;}catch(e){}}
  }
  return null;
}
async function saveToGDrive(w,n){await callClaude(`구글 드라이브에서 "${GDRIVE_FILE}" 파일을 찾아서 있으면 업데이트하고 없으면 생성해줘.\n${JSON.stringify({wines:w,notes:n,savedAt:new Date().toISOString()})}`,500,true);}
async function loadFromGDrive(){const d=await callClaude(`구글 드라이브에서 "${GDRIVE_FILE}" 파일을 찾아서 내용을 JSON으로만 반환해줘.`,8000,true);return extractBlocks(d.content,false);}
async function importFromSheets(){
  const d=await callClaude(`구글 드라이브에서 "Wine Inventory Management" 스프레드시트를 찾아서 읽어줘. 모든 와인 데이터를 아래 JSON 배열로만 반환. 헤더 제외, 빈 행 제외. nameKR/nameEN에 빈티지 연도 포함 금지.
[{"nameKR":"","nameEN":"","vintage":"","producer":"","country":"","region":"","subRegion":"","vineyard":"","classification":"","grapeVariety":"","wineType":"Red","purchaseDate":"","shop":"","purchasePrice":"","bottleSize":"750ml","quantity":"1","location":"","status":"In Stock","drinkFrom":"","drinkUntil":"","rating":"","marketPrice":""}]
JSON 배열만 반환, 다른 텍스트 없이.`,12000,true);
  return extractBlocks(d.content,true);
}

// Basic lookup — simple flat JSON, very reliable
const lookupWine = (name, v) => aiJson(
`당신은 WSET Diploma를 보유한 마스터 소믈리에다. 정확성에 자부심이 있어 틀린 정보 대신 빈칸을 남긴다.
와인 "${name}"${v?` (${v}빈티지)`:""}의 기본 정보를 아래 JSON으로만 반환. 마크다운 없이 순수 JSON만. nameKR/nameEN에 빈티지 포함 금지. 모든 서술(description 등)은 '~이다' 평서체로 작성(존댓말 금지). 부르고뉴면 isBurgundy=true, 보르도면 isBordeaux=true.
먼저 국가→지역→생산자를 확정한 뒤 나머지를 채울 것. (예: "Beaune/본"은 프랑스 부르고뉴이지 독일 Bonn이 아님)
추측은 치명적 오류다. 확신 80% 미만 항목은 반드시 빈 문자열로 둘 것.
사용자 입력 한글명은 부정확할 수 있으니 nameKR은 정확한 공식 한글 표기로 교정 (예: "샤또딸보"→"샤토 탈보", "본로마네"→"본 로마네").
{"nameKR":"한국어와인명","nameEN":"English name","producer":"생산자","country":"국가","region":"지역","subRegion":"세부지역","vineyard":"포도밭","classification":"등급","grapeVariety":"포도품종","wineType":"Red","drinkFrom":"시작연도숫자","drinkUntil":"종료연도숫자","description":"3문장 한국어 설명","isBurgundy":false,"isBordeaux":false,"vineyardLat":"위도소수","vineyardLon":"경도소수","vineyardZoom":"15","mapNotes":"밭위치설명","expertRatings":{"bh":"","ws":"","wa":"","vinous":"","js":"","jr":"","dec":"","jm":""}}
중요: expertRatings 각 필드는 실제 점수 숫자(예: 92)가 확인된 경우에만 입력. 없으면 반드시 빈 문자열 "" — 절대 설명 텍스트 금지.`, 2000
);

// Detailed WSET-level info — called separately from detail page
const lookupWineDetail = (name, v) => aiJson(
`와인 "${name}"${v?` (${v})`:""}의 상세 정보를 아래 JSON으로만 반환. 마크다운 없이 순수 JSON만.
{"terroir":{"soilType":"","soilDesc":"","slope":"","aspect":"","altitude":"","vineAge":"","vineyardSize":"","microclimate":"","geology":""},"producerInfo":{"founded":"","size":"","certifications":"","history":"2-3문장","philosophy":"2-3문장","approach":""},"vintageInfo":{"weather":"","harvest":"","characteristics":"2-3문장","agingPotential":""},"winemaking":{"fermentation":"","yeast":"","vessel":"","aging":"","agingVessel":"","agingTime":"","malo":"","filtration":"","sulfur":""},"expertNotes":[{"critic":"","score":"","note":"실제 시음노트를 자연스러운 한국어로 번역해서. 없으면 이 항목 자체를 배열에서 생략","year":""}]}
중요: expertNotes 배열에 정보가 없는 평론가는 포함하지 말것. note는 반드시 한국어로 번역. 안내 문구, 면책 조항 절대 금지.`, 3000
);
const lookupWineRecommendations = (name, v, region, price) => aiJson(
`와인 전문가로서 "${name}"${v?` (${v})`:""} (${region||""}${price?`, 가격대 ₩${parseInt(price).toLocaleString()}`:""})과 비슷한 와인을 추천해줘. 마크다운 없이 순수 JSON만 반환.
{"famous":[{"name":"유명 와인명 (생산자 포함)","region":"지역/국가","priceRange":"가격대 예: ₩15~20만","whySimilar":"추천 이유 1-2문장","producer":"생산자"},{"name":"","region":"","priceRange":"","whySimilar":"","producer":""}],"gems":[{"name":"숨은보석 와인명","region":"지역/국가","priceRange":"가격대","whySimilar":"추천 이유 1-2문장","producer":"생산자"},{"name":"","region":"","priceRange":"","whySimilar":"","producer":""}],"note":"전반적인 추천 코멘트 1문장"}
famous: 잘 알려진 대안 2-3개 (비슷한 등급·스타일·가격대)
gems: 덜 알려졌지만 가성비 좋거나 품질 뛰어난 와인 2-3개`, 1500
);
// 내 셀러 안에서 비슷한 와인 추천 (외부 환각 방지)
const recommendFromCellar = (wine, cellarWines, model) => {
  const others = (cellarWines||[]).filter(w => w.id !== wine.id);
  if(others.length < 2) return Promise.resolve({ items:[], _few:true });
  const g1 = s => (s||"").split(/[,/·&]| 및 /)[0].trim().toLowerCase();
  const score = w => (w.wineType===wine.wineType?2:0)
    + (normCountry(w.country)===normCountry(wine.country)?1:0)
    + ((w.region&&wine.region&&w.region===wine.region)?2:0)
    + ((g1(w.grapeVariety)&&g1(w.grapeVariety)===g1(wine.grapeVariety))?2:0);
  const sorted = [...others].sort((a,b)=>score(b)-score(a)).slice(0,60);
  const list = sorted.map(w=>`${w.id} | ${cleanName(w.nameKR||w.nameEN,w.vintage)} | ${w.producer||""} | ${w.region||""},${w.country||""} | ${w.grapeVariety||""} | ${w.wineType||""}`).join("\n");
  return aiJson(
`내 와인 셀러 목록에서 "${cleanName(wine.nameKR||wine.nameEN,wine.vintage)}" (${[wine.region,wine.grapeVariety,wine.wineType].filter(Boolean).join(", ")})와 스타일·품종·지역이 가장 비슷한 와인 2~3개를 고르세요.
반드시 아래 목록의 id만 사용. 목록에 없는 와인 절대 금지. 비슷한 게 정말 없으면 빈 배열.
목록 (id | 이름 | 생산자 | 지역,국가 | 품종 | 종류):
${list}
JSON만: {"items":[{"id":"목록의 id 그대로","whySimilar":"왜 비슷한지 한 문장"}]}`, 1500, model);
};

const lookupWineInsights = (name, v) => aiJson(
`와인 전문가 수준으로 "${name}"${v?` (${v}빈티지)`:""}에 대한 심화 정보를 아래 JSON으로만 반환. 마크다운 없이 순수 JSON만.
반드시 정확한 사실만 작성. 와인의 실제 국가·산지를 정확히 확인할 것. 확실하지 않은 항목은 빈 문자열로 두고 절대 추측하거나 지어내지 말 것.

{"hierarchy":{"description":"이 와인이 생산자 라인업에서 차지하는 위치 설명 (예: VDP.Grosse Lage > VDP.Ortswein > VDP.Gutswein 중 해당 등급)","table":[{"rank":"①","name":"최상위 와인명","category":"VDP/AOC 분류"},{"rank":"②","name":"이 와인","category":"해당 등급","isCurrent":true},{"rank":"③","name":"기본 와인","category":"엔트리 등급"}]},"classificationKey":{"title":"알아야 할 핵심 코드/시스템","items":[{"code":"코드나 용어","meaning":"설명"}]},"essentialContext":"이 와인을 이해하기 위해 반드시 알아야 할 배경 지식 2-3문장. 생산 방식 특이사항, 지역 특성, 위계 체계 등","vintageCharacter":"${v||"해당 빈티지"}년 특성 — 기상 조건, 스타일, 숙성 가능성 2문장","criticalInsight":"이 와인만의 핵심 감상 포인트 또는 구별되는 특징 2문장","peakWindow":"최적 음용 시기 (예: 2028~2038, 지금도 가능)","decanting":"디캔팅 권장 여부 및 시간","servingTemp":"적정 서빙 온도","foodPairing":["최적 페어링 음식1","음식2","음식3"],"rarityNote":"희소성/생산량/시장 접근성","funFact":"알면 흥미로운 사실 1-2문장"}`, 2500
);

// 통합 채우기 — XML 구조 + _reasoning(내장 사고) + anchor(환각 방지)
const enrichAll = (name, v, anchor, model) => {
  const a = anchor||{};
  const known = [a.producer&&`생산자: ${a.producer}`, a.country&&`국가: ${a.country}`, a.region&&`지역: ${a.region}`, a.grapeVariety&&`품종: ${a.grapeVariety}`, a.wineType&&`종류: ${a.wineType}`].filter(Boolean).join(" / ");
  return aiJson(
`<role>
당신은 WSET 디플로마 소지자이자 Burghound(앨런 미도우즈)와 Wine Advocate 수준의 분석력과 엄격함을 갖춘 최상위 와인 전문가다. 정확성에 직업적 자부심이 있어, 틀린 정보를 적느니 빈칸을 남긴다.
</role>

<task>
와인 "${name}"${v?` (${v} 빈티지)`:""}의 정보를 철저히 분석해 아래 스키마의 JSON 하나로만 반환한다.
</task>
${known?`<known_facts>\n이미 확인된 정보(반드시 이와 모순되지 않게, 이 범위 안에서 작성):\n${known}\n</known_facts>`:""}
<rules>
1. 추측 금지: 국가→지역(AOC/AVA)→생산자→포도밭 순으로 교차 검증한다. (예: "Beaune/본"은 프랑스 부르고뉴이지 독일 Bonn이 아니다.) 확신 80% 미만 항목은 반드시 빈 문자열("")로 남긴다. 추측은 치명적 오류로 간주한다.
2. 한글 표기 교정: 사용자 입력이 부정확해도 nameKR은 공식적이고 세련된 한글 명칭으로 교정한다. (예: "샤또딸보"→"샤토 탈보") nameKR/nameEN에 빈티지 숫자 포함 금지.
3. 전문가 평점/노트: expertRatings는 실제 확인된 숫자만, 없으면 "". expertNotes는 실제 존재하는 평론가만 포함하고, 면책 문구 없이 우아한 한국어 와인 용어로 번역한다.
4. JSON만: 마크다운 펜스/설명 없이 순수 JSON만 반환한다.
5. 문체: 모든 서술형 텍스트는 '~이다/~한다' 평서체(문어체)로 작성한다. 존댓말(~입니다/~습니다/~세요) 금지.
</rules>

<example>
입력: "조르주 뮈니에레 지부르 뉘 생 조르주 2021"
_reasoning 예시: "생산자는 Domaine Georges Mugneret-Gibourg, 산지는 프랑스 부르고뉴 뉘 생 조르주(Côte de Nuits). 2021은 서리 피해로 수확량 적으나 우아함이 돋보이는 빈티지. 피노 누아, 빌라주/1er 등급 확인 후 기재."
</example>

아래 스키마에 맞춰 정확히 작성. _reasoning을 가장 먼저 채워 스스로 팩트체크를 정리한 뒤 나머지를 작성하라.
[지도용 좌표] vineyardLat/vineyardLon은 지도 표시에 쓰인다. 정확한 밭 좌표를 모르면 해당 마을·세부지역·지역의 대략적 좌표라도 반드시 채운다(예: 마을 중심). 국가조차 불명확할 때만 빈칸. vineyardZoom은 밭 단위면 14~15, 마을이면 12, 지역이면 9.
{
"_reasoning":"이 와인의 국가·지역·생산자·등급에 대한 팩트체크 사고 과정을 2-3문장으로 먼저 정리",
"nameKR":"","nameEN":"","producer":"","country":"","region":"","subRegion":"","vineyard":"","classification":"","grapeVariety":"","wineType":"Red","drinkFrom":"숫자","drinkUntil":"숫자","description":"3문장 한국어","isBurgundy":false,"isBordeaux":false,"vineyardLat":"위도소수","vineyardLon":"경도소수","vineyardZoom":"15","mapNotes":"",
"expertRatings":{"bh":"","ws":"","wa":"","vinous":"","js":"","jr":"","dec":"","jm":""},
"terroir":{"soilType":"","soilDesc":"","slope":"","aspect":"","altitude":"","vineAge":"","vineyardSize":"","microclimate":"","geology":""},
"producerInfo":{"founded":"","size":"","certifications":"","history":"2-3문장","philosophy":"2-3문장","approach":""},
"vintageInfo":{"weather":"","harvest":"","characteristics":"2-3문장","agingPotential":""},
"winemaking":{"fermentation":"","yeast":"","vessel":"","aging":"","agingVessel":"","agingTime":"","malo":"","filtration":"","sulfur":""},
"expertNotes":[{"critic":"","score":"","note":"한국어 번역","year":""}],
"officialNote":"와이너리 공식 시음노트(테크니컬 시트/홈페이지 표기)를 한국어로 번역. 공식 자료가 확인되지 않으면 빈 문자열. 절대 지어내지 말 것"
}`, 6000, model);
};

// 심층 인사이트 — 별도 집중 호출(Flash가 한 주제에 집중 → 풍부·정확)
const deepInsights = (name, v, anchor, model) => {
  const a = anchor||{};
  const known = [a.producer&&`생산자:${a.producer}`, a.country&&`국가:${a.country}`, a.region&&`지역:${a.region}`, a.grapeVariety&&`품종:${a.grapeVariety}`].filter(Boolean).join(" / ");
  return aiJson(
`<role>
당신은 WSET 디플로마 소지자이자 Burghound 수준의 분석력을 갖춘 와인 전문 작가다. 와인을 심층적으로 탐구하는 애호가를 위해, 검증된 사실에 기반해 깊이 있고 풍부하게 서술한다.
</role>

<task>
와인 "${name}"${v?` (${v} 빈티지)`:""}에 대한 심층 해설을 아래 JSON으로만 반환한다.
</task>
${known?`<known_facts>\n${known}\n</known_facts>`:""}
<rules>
1. 확실한 사실은 충실하고 길게 서술하되, 모르거나 불확실한 내용은 짧게 하거나 빈 문자열("")로 둔다. 추측성 미사여구·일반론으로 분량을 채우지 마라. 거짓 정보는 치명적 오류다.
2. 먼저 _reasoning에서 이 와인의 국가·지역·생산자·품종·등급을 팩트체크한 뒤 작성한다. ("Beaune/본"은 프랑스 부르고뉴이지 독일이 아님)
3. 구체적이고 전문적으로. "좋은 와인이다" 같은 공허한 표현 대신, 왜 그런지 메커니즘과 근거를 든다.
4. 마크다운 없이 순수 JSON만.
5. 문체: 모든 서술형 텍스트는 '~이다/~한다' 평서체(문어체)로 작성한다. 존댓말(~입니다/~습니다/~세요) 금지.
</rules>

{
"_reasoning":"국가·지역·생산자·품종·등급 팩트체크 2-3문장",
"winemakingImpact":"이 와인의 경작(테루아·수확)·발효·숙성 방식이 실제로 향과 맛에 어떻게 나타나는지 인과적으로 4-6문장. 예: 새 오크 비율과 바닐라·토스트 풍미의 관계, MLF와 질감, 줄기 사용과 구조감 등. 확인된 양조 정보 기반.",
"producerStory":"생산자의 역사·철학·양조 스타일을 심층적으로 4-6문장. 설립 배경, 세대 교체, 떼루아 철학, 시그니처 스타일 등 확인된 사실 위주.",
"predictedPalate":"전문가 평가와 품종·산지·빈티지 특성을 종합해 예상되는 시음 프로파일을 4-6문장으로. 외관→향(1·2·3차)→입안(당도·산도·타닌·바디)→여운 순으로 구체적으로.",
"stories":[{"title":"소재(생산자/산지/품종 중)","content":"숨은 이야기나 알아두면 좋은 배경지식 2-3문장"}],
"essentialContext":"이 와인을 이해하기 위한 핵심 배경(등급 체계, 산지 특성 등) 3-4문장",
"hierarchy":{"description":"생산자 라인업 내 위치 설명","table":[{"rank":"①","name":"","category":"","isCurrent":false}]},
"classificationKey":{"title":"알아야 할 핵심 코드/시스템","items":[{"code":"","meaning":""}]},
"vintageCharacter":"${v||"해당"} 빈티지의 기상·작황·스타일·숙성잠재력 3-4문장",
"criticalInsight":"이 와인만의 구별되는 핵심 포인트 2-3문장",
"peakWindow":"최적 음용 시기","decanting":"디캔팅 권장 여부·시간","servingTemp":"적정 서빙 온도",
"foodPairing":["페어링1","페어링2","페어링3","페어링4"],
"rarityNote":"생산량·희소성·시장 접근성","funFact":"흥미로운 사실 1-2문장"
}`, 8000, model);
};

// 와인 1병 AI 채우기 핵심 로직 — 변경할 필드 객체 반환 (doEnrich와 일괄처리가 공유)
// 전문가 평점·노트 전용 보강 (가벼운 호출 — 평점이 비었을 때 Pro로 메움)
const lookupRatings = (name, v, model) => aiJson(
`당신은 와인 평론 데이터 전문가다. 와인 "${name}"${v?` (${v}빈티지)`:""}에 대해 주요 평론가가 매긴 실제 점수와 시음노트만 JSON으로 반환. 마크다운 없이 순수 JSON만.
실제로 확인된 점수만 입력하고, 모르는 평론가는 빈 문자열/배열로 둘 것. 절대 점수를 지어내지 말 것(틀린 점수는 치명적 오류).
expertNotes의 note는 자연스러운 한국어 평서체('~이다')로 번역. 존댓말·면책 문구 금지.
{"expertRatings":{"bh":"Burghound 점수숫자","ws":"Wine Spectator","wa":"Wine Advocate","vinous":"Vinous","js":"James Suckling","jr":"Jancis Robinson(20점만점)","dec":"Decanter","jm":"Jasper Morris"},"expertNotes":[{"critic":"평론가명","score":"점수","note":"한국어 번역","year":""}]}`,
  2500, model);

async function computeEnrich(wine, cellarWines, lite=false, model){
  const name = wine.nameKR || wine.nameEN;
  const v = wine.vintage;
  if(!name) return null;
  const r = await enrichAll(name, v, {producer:wine.producer, country:wine.country, region:wine.region, grapeVariety:wine.grapeVariety, wineType:wine.wineType}, model);
  const { insights:_ig, _reasoning, ...flat } = r;
  const notes = flat.expertNotes?.length ? flat.expertNotes : (wine.expertNotes||[]);
  let mergedRat = syncRatings(notes, {...(wine.expertRatings||{}), ...(flat.expertRatings||{})});
  let finalNotes = notes;
  // 평점 보강: 기본 모델이 Pro가 아니고, 평점이 비어있고, 보강이 켜져 있으면 Pro로 평점만 추가 조회
  const usedModel = model || _aiModel;
  const ratingsEmpty = Object.values(mergedRat).filter(x=>x&&String(x).trim()).length === 0;
  if(_ratingBoost && ratingsEmpty && !usedModel.includes("pro") && !lite){
    try{
      const rb = await lookupRatings(name, v, _ratingModel);
      const cleanRb = {};
      Object.entries(rb.expertRatings||{}).forEach(([k,val])=>{ const m=String(val||"").match(/[\d.]+(?:\s*-\s*[\d.]+)?/); if(m) cleanRb[k]=m[0].replace(/\s/g,""); });
      const rbNotes = rb.expertNotes?.length ? rb.expertNotes.filter(n=>n.note && !isDisclaimerNote(n.note)) : [];
      if(rbNotes.length && !finalNotes.length) finalNotes = rbNotes;
      mergedRat = syncRatings(finalNotes.length?finalNotes:rbNotes, {...mergedRat, ...cleanRb});
    }catch(e){}
  }
  let insights = null, rec = null;
  if(!lite){
    // 심층 인사이트 + 셀러추천 (개별 채우기에서만 — 일괄에서는 호출 절약)
    const anc = {producer:flat.producer||wine.producer, country:flat.country||wine.country, region:flat.region||wine.region, grapeVariety:flat.grapeVariety||wine.grapeVariety};
    const ins = await deepInsights(name, v, anc, model);
    const { _reasoning:_ir, ...rest } = ins; insights = rest;
    const mergedW = {...wine, region:flat.region||wine.region, grapeVariety:flat.grapeVariety||wine.grapeVariety, wineType:flat.wineType||wine.wineType, country:flat.country||wine.country};
    try { rec = await recommendFromCellar(mergedW, cellarWines, model); } catch(e){}
  }
  return {
    ...flat,
    nameKR: wine.nameKR||flat.nameKR||"",
    nameEN: wine.nameEN||flat.nameEN||"",
    vintage: wine.vintage||flat.vintage||"",
    country: normCountry(flat.country||wine.country||""),
    producer: wine.producer||flat.producer||"",
    expertRatings: mergedRat,
    terroir: {...(wine.terroir||{}), ...(flat.terroir||{})},
    producerInfo: {...(wine.producerInfo||{}), ...(flat.producerInfo||{})},
    vintageInfo: {...(wine.vintageInfo||{}), ...(flat.vintageInfo||{})},
    winemaking: {...(wine.winemaking||{}), ...(flat.winemaking||{})},
    expertNotes: finalNotes.filter(n=>!isDisclaimerNote(n.note)),
    ...(insights?{wineInsights:insights}:{}),
    ...(rec?{recommendations:rec}:{}),
  };
}
const correctWine = (name, v) => aiJson(`와인 "${name}"${v?` 빈티지 ${v}`:""}을 보정해서 JSON만. nameKR/nameEN에 빈티지 포함 금지.
{"nameKR":"","nameEN":"","vintage":"","producer":"","region":"","country":"","wineType":"Red|White|Rosé|Sparkling|Dessert|Fortified","isBurgundy":false}`, 1500);
// 자유서술 → WSET 지표 매핑용
const _aromaNames = T_AROMA.flatMap(([,items])=>items.map(([,n])=>n));
const _flavorNames = T_FLAVOR.flatMap(([,items])=>items.map(([,n])=>n));
const _chipByName = (name, groups) => {
  for(const [,items] of groups){ for(const [emoji,n] of items){ if(n===name) return `${emoji} ${name}`; } }
  return null;
};
const structNote = (txt, wine) => aiJson(`"${wine}" 시음 자유서술을 분석해 WSET 지표로 정리. 메모에 실제 나타난 것만, 없으면 빈 문자열/빈 배열. 마크다운 없이 순수 JSON만.
서술:"${txt}"
{"color":"","noseIntensity":"약함|중간-|중간|중간+|강함","sweetness":"완전 드라이|드라이|살짝 단맛|반건조|중간 단맛|스위트|매우 달콤","acidity":"낮음|중간-|중간|중간+|높음","tannin":"거의 없음|부드러움|중간|뻑뻑함|매우 강함","alcohol":"낮음|중간|높음|주정강화","body":"가벼움|다소 가벼움|중간|다소 무거움|풀 바디","finish":"짧음|약간 짧음|중간|약간 김|김","aromas":[],"flavors":[],"overallImpression":"서술을 다듬은 총평 2-3문장(평서체 ~이다, 존댓말 금지)","rating":"숫자만(서술에 점수 언급 있을때만)","repurchase":"예|보통|아니오"}
aromas는 서술에 언급된 향만 아래 목록에서 정확히 골라 배열로: ${_aromaNames.join(", ")}
flavors는 서술에 언급된 풍미·질감만 아래 목록에서 정확히 골라 배열로: ${_flavorNames.join(", ")}`);

// 내 시음노트 vs 전문가/공식 비교 분석
const compareNote = (myText, wine) => {
  const refs = [];
  (wine?.expertNotes||[]).forEach(n=>{ if(n.note) refs.push(`[${n.critic||"평론가"}${n.score?` ${n.score}`:""}] ${n.note}`); });
  if(wine?.officialNote) refs.push(`[와이너리 공식] ${wine.officialNote}`);
  const hasRef = refs.length>0;
  return aiJson(
`<role>당신은 WSET 교육자다. 학생의 시음노트를 전문가·와이너리 공식 노트와 비교해 교육적으로 분석한다.</role>
<task>
"${cleanName(wine?.nameKR||wine?.nameEN, wine?.vintage)}"에 대한 비교 분석.
[내 시음노트]
${myText}
${hasRef?`[전문가·공식 시음노트]\n${refs.join("\n")}`:`[참고 노트 없음 → ${[wine?.grapeVariety,wine?.region].filter(Boolean).join(" ")||"이 와인"}의 전형적 프로파일을 기준으로 비교]`}
</task>
<rules>
- 내 노트와 기준을 구체적으로 대조한다. 일치점·차이점을 짚되 우열을 가리지 말고 교육적으로.
- 차이가 나는 이유를 합리적으로 추정한다(디캔팅·서빙온도·빈티지/보관 상태·잔·개인 미각 민감도·표현 어휘 차이 등). 단정 대신 가능성으로 제시.
- 사실 아닌 내용 지어내기 금지. 기준 노트가 없으면 전형적 프로파일 기준임을 전제로.
- 마크다운 없이 순수 JSON만.
- 문체: 모든 서술은 '~이다/~한다' 평서체로. 존댓말 금지.
</rules>
{"summary":"내 평가가 전반적으로 얼마나 일치하는지 1-2문장","agreements":["일치한 포인트1","포인트2"],"differences":[{"aspect":"항목(예: 타닌)","mine":"내가 느낀 것","reference":"전문가/전형","why":"차이가 날 수 있는 이유"}],"learningPoint":"이 비교로 배울 점·다음에 주목할 포인트 1-2문장","hasReference":${hasRef}}`);
};

// ── Critic key extraction ────────────────────────────────────────
function criticKey(name){
  const n=(name||"").toLowerCase();
  if(n.includes("burghound")||n.includes("allen meadows"))return"bh";
  if(n.includes("wine spectator"))return"ws";
  if(n.includes("wine advocate")||n.includes("parker")||n.includes("robert parker"))return"wa";
  if(n.includes("vinous")||n.includes("galloni")||n.includes("neal martin"))return"vinous";
  if(n.includes("suckling"))return"js";
  if(n.includes("jancis")||n.includes("robinson"))return"jr";
  if(n.includes("decanter"))return"dec";
  if(n.includes("jasper morris"))return"jm";
  return null;
}
function syncRatings(expertNotes, existing){
  const merged={...(existing||{})};
  (expertNotes||[]).forEach(n=>{
    const k=criticKey(n.critic);
    if(!k)return;
    const s=(n.score||"").match(/[\d.]+(?:\s*-\s*[\d.]+)?/)?.[0];
    if(s&&!merged[k])merged[k]=s.replace(/\s/g,""); // only fill empty slots, 범위(86-88) 보존
  });
  return merged;
}

// ── SVG Map via Claude API ────────────────────────────────────────
async function generateVineyardMap(wine){
  const region=wine.region||"";
  const country=wine.country||"";
  const sub=wine.subRegion||"";
  const lat=parseFloat(wine.vineyardLat||0).toFixed(4);
  const lon=parseFloat(wine.vineyardLon||0).toFixed(4);
  const mapNote=wine.mapNotes||"";
  const prompt=`Create a wine appellation map as SVG. IMPORTANT: return ONLY the raw SVG tag — no markdown, no explanation, no code fence. Start with <svg and end with </svg>.

viewBox="0 0 500 280" xmlns="http://www.w3.org/2000/svg"
Region to map: ${region}${sub?", "+sub:""} — ${country}
Geographic note: ${mapNote}
Vineyard coordinates: ${lat}°N, ${lon}°E

MAP DESIGN — follow precisely:

BACKGROUND & FRAME
- <rect width="500" height="280" fill="#F7F3ED"/>
- Thin frame: <rect x="8" y="8" width="484" height="264" rx="3" fill="none" stroke="#D4C4A4" stroke-width="1"/>

GEOGRAPHY (use plausible shapes for the region)
- Surrounding land: large polygon, fill="#E8DCC8", stroke="#C8B090", stroke-width="0.5"
- Main appellation zone: smaller polygon, fill="#D4C4A0", fill-opacity="0.6", stroke="#A89060", stroke-width="1.2"
- River or coast if applicable: path stroke="#A8C8DC" stroke-width="2.5" fill="none"
- Hills/plateau if known: subtle polygon fill="#D0C890" fill-opacity="0.3"

VINEYARD MARKER (place accurately based on coordinates within canvas)
- Outer pulse: <circle r="18" fill="#8B2635" fill-opacity="0.12"/>
- Ring: <circle r="10" fill="none" stroke="#8B2635" stroke-width="1.5"/>
- Dot: <circle r="4" fill="#8B2635"/>

NEARBY VILLAGES (3-5 real neighbors)
- Each: <circle r="2.5" fill="#6A4030"/> plus <text font-size="8" font-family="Georgia,serif" fill="#5A3020"> label

LABELS & LEGEND
- Region name top-left: font-size="14" font-weight="bold" font-family="Georgia,serif" fill="#3A2010"
- Sub-region if any: font-size="10" font-family="Georgia,serif" fill="#6A5040" font-style="italic"
- DO NOT put the wine name on the map canvas
- Coordinates bottom-right: font-size="8" font-family="monospace" fill="#999"
- North arrow: simple ↑ text top-right, font-size="11" fill="#888"
- Country label bottom-left: font-size="8" fill="#AAA"`;

  try{
    const d=await callAI(prompt,8000);
    const txt=(d.content?.find(c=>c.type==="text")?.text||"").trim();
    if(txt.startsWith("<svg"))return txt;
    const m=txt.match(/<svg[\s\S]*<\/svg>/i);
    if(m)return m[0];
    return null;
  }catch(e){return null;}
}
// ── Map Display ──────────────────────────────────────────────────
function MapDisplay({ lat, lon, zoom, label }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const la = parseFloat(lat), lo = parseFloat(lon);
  const valid = !isNaN(la) && !isNaN(lo) && (la !== 0 || lo !== 0);

  useEffect(() => {
    if (!valid || !ref.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    const map = L.map(ref.current, { scrollWheelZoom:false }).setView([la, lo], parseInt(zoom)||12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:'© OpenStreetMap', maxZoom:18
    }).addTo(map);
    L.circleMarker([la, lo], { radius:9, fillColor:RED, color:'#fff', weight:2, fillOpacity:1 }).addTo(map);
    setTimeout(() => { try{ map.invalidateSize(); }catch(e){} }, 150);
    mapRef.current = map;
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [la, lo, zoom, valid]);

  if (!valid) {
    return (
      <div style={{borderRadius:8,border:"1px solid #e0d8cc",background:"#F7F3ED",padding:20,textAlign:"center",fontSize:12,color:"#aaa"}}>
        위치 정보가 없습니다 — "AI 정보 채우기"로 밭 좌표를 받아보세요
      </div>
    );
  }
  const osmLink = `https://www.openstreetmap.org/?mlat=${la}&mlon=${lo}#map=${parseInt(zoom)||13}/${la}/${lo}`;
  return (
    <div>
      <div ref={ref} style={{width:"100%",height:240,borderRadius:10,overflow:"hidden",border:"1px solid #e0d8cc"}}/>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
        {label ? <span style={{fontSize:11,color:"#aaa"}}>{label}</span> : <span/>}
        <a href={osmLink} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#888"}}>크게 보기 →</a>
      </div>
    </div>
  );
}

// ── 전체 셀러 지도 (모든 와인 핀) ─────────────────────────────────
const WINE_TYPE_COLOR = { Red:RED, White:"#C9A84A", "Rosé":"#E091A8", Sparkling:"#5AA0A0", Dessert:"#C77F2E", Fortified:"#7A4FA3" };
function CellarMapPage({ wines, onBack }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const pinned = wines.filter(w => {
    const la = parseFloat(w.vineyardLat), lo = parseFloat(w.vineyardLon);
    return !isNaN(la) && !isNaN(lo) && (la !== 0 || lo !== 0);
  });

  useEffect(() => {
    if (!ref.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    const map = L.map(ref.current).setView([30, 10], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:'© OpenStreetMap', maxZoom:18
    }).addTo(map);
    const pts = [];
    pinned.forEach(w => {
      const la = parseFloat(w.vineyardLat), lo = parseFloat(w.vineyardLon);
      const color = WINE_TYPE_COLOR[w.wineType] || RED;
      const m = L.circleMarker([la, lo], { radius:7, fillColor:color, color:'#fff', weight:1.5, fillOpacity:0.9 }).addTo(map);
      const nm = cleanName(w.nameKR||w.nameEN, w.vintage);
      const sub = [w.region, w.country].filter(Boolean).join(", ");
      m.bindPopup(`<div style="font-size:13px;line-height:1.5"><b>${nm}</b>${w.vintage?` <span style="color:#9A7020">${w.vintage}</span>`:""}${sub?`<br><span style="color:#888">${sub}</span>`:""}</div>`);
      pts.push([la, lo]);
    });
    if (pts.length === 1) map.setView(pts[0], 8);
    else if (pts.length > 1) { try{ map.fitBounds(pts, { padding:[40,40], maxZoom:9 }); }catch(e){} }
    setTimeout(() => { try{ map.invalidateSize(); }catch(e){} }, 150);
    mapRef.current = map;
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  return (
    <div style={{minHeight:"100vh",background:"#F7F4F0",fontFamily:"system-ui,sans-serif"}}>
      <TopBar title="🗺 셀러 지도" onBack={onBack}/>
      <div style={{padding:16,maxWidth:680,margin:"0 auto"}}>
        <div style={{fontSize:12,color:"#888",marginBottom:10}}>
          좌표가 있는 와인 {pinned.length}병 · 핀을 누르면 와인 정보가 표시됩니다
        </div>
        <div ref={ref} style={{width:"100%",height:"60vh",minHeight:380,borderRadius:12,overflow:"hidden",border:"1px solid #e0d8cc"}}/>
        {pinned.length === 0 && (
          <div style={{fontSize:12,color:"#aaa",textAlign:"center",marginTop:16,lineHeight:1.6}}>
            아직 좌표가 있는 와인이 없습니다.<br/>와인 상세에서 "AI 정보 채우기"를 하면 밭 좌표가 채워집니다.
          </div>
        )}
        <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:12,justifyContent:"center"}}>
          {Object.entries(WINE_TYPE_COLOR).map(([t,c])=>(
            <span key={t} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#888"}}>
              <span style={{width:10,height:10,borderRadius:"50%",background:c,display:"inline-block"}}/>{t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}


// ── Shared UI ─────────────────────────────────────────────────────
const IS={border:"1px solid #ddd",borderRadius:6,padding:"8px 10px",width:"100%",fontSize:13,outline:"none",background:"#fff",fontFamily:"system-ui,sans-serif",boxSizing:"border-box"};
const CS={background:"#fff",border:"1px solid #ece8e4",borderRadius:12,padding:16,marginBottom:12};
const NS={fontSize:13,color:"#555",lineHeight:1.8,background:"#faf8f5",borderRadius:8,padding:"10px 12px",marginTop:8};
const QS={fontSize:13,color:"#555",lineHeight:1.8,fontStyle:"italic",borderLeft:`3px solid ${GOLD}`,paddingLeft:12,marginTop:8};

function Badge({ from, until }) {
  const s = getDrinkStatus(from, until);
  if (!s||!DB[s]) return null;
  const {bg,c,l} = DB[s];
  return (<span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:4,background:bg,color:c}}>{l}</span>);
}
function SH({ children }) {
  return (<div style={{fontSize:11,fontWeight:700,color:RED,letterSpacing:.8,textTransform:"uppercase",marginBottom:12,paddingBottom:8,borderBottom:"1px solid #f0ece8"}}>{children}</div>);
}
function DR({ label, val }) {
  if (val===null||val===undefined||val==="") return null;
  return (
    <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f7f4f0"}}>
      <span style={{fontSize:13,color:"#888",flexShrink:0,marginRight:8}}>{label}</span>
      <span style={{fontSize:13,fontWeight:500,textAlign:"right"}}>{val}</span>
    </div>
  );
}
function PB({ children, onClick, disabled, full, xs }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{background:disabled?"#ccc":RED,color:"#fff",border:"none",borderRadius:8,padding:"10px 18px",fontWeight:600,fontSize:14,width:full?"100%":"auto",cursor:disabled?"not-allowed":"pointer",fontFamily:"system-ui,sans-serif",...(xs||{})}}>
      {children}
    </button>
  );
}
function GB({ children, onClick, xs }) {
  return (
    <button onClick={onClick}
      style={{background:"#fff",border:"1px solid #ddd",borderRadius:8,padding:"9px 16px",fontWeight:500,fontSize:13,cursor:"pointer",fontFamily:"system-ui,sans-serif",...(xs||{})}}>
      {children}
    </button>
  );
}
function TopBar({ title, onBack, right }) {
  return (
    <div style={{background:RED,color:"#fff",padding:"14px 20px",display:"flex",alignItems:"center",gap:12}}>
      {onBack && (<button onClick={onBack} style={{background:"rgba(255,255,255,.18)",border:"none",borderRadius:6,color:"#fff",fontSize:12,padding:"5px 12px",cursor:"pointer"}}>← 뒤로</button>)}
      <span style={{flex:1,fontWeight:600,fontSize:15,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</span>
      {right}
    </div>
  );
}
function Pg({ children }) { return (<div style={{padding:16,maxWidth:680,margin:"0 auto",paddingTop:20}}>{children}</div>); }
function FF({ label, value, onChange, type, placeholder, options, rows }) {
  return (
    <div style={{marginBottom:12}}>
      {label && (<div style={{fontSize:11,fontWeight:600,color:"#888",letterSpacing:.5,marginBottom:4,textTransform:"uppercase"}}>{label}</div>)}
      {options ? (<select value={value} onChange={onChange} style={IS}>{options.map(o=><option key={o}>{o}</option>)}</select>)
      : rows ? (<textarea value={value} onChange={onChange} rows={rows} placeholder={placeholder} style={{...IS,resize:"vertical"}}/>)
      : (<input value={value} onChange={onChange} type={type||"text"} placeholder={placeholder} style={IS}/>)}
    </div>
  );
}
function DeleteBtn({ onDelete }) {
  const [c, sc] = useState(false);
  if (c) {
    return (
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <span style={{fontSize:12,color:"#fff",opacity:.8}}>정말 삭제?</span>
        <button onClick={onDelete} style={{background:"#fff",color:RED,border:"none",borderRadius:6,padding:"4px 10px",fontSize:12,fontWeight:700,cursor:"pointer"}}>삭제</button>
        <button onClick={()=>sc(false)} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:6,color:"#fff",padding:"4px 10px",fontSize:12,cursor:"pointer"}}>취소</button>
      </div>
    );
  }
  return (<button onClick={()=>sc(true)} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:6,color:"rgba(255,255,255,.8)",fontSize:12,padding:"5px 12px",cursor:"pointer"}}>삭제</button>);
}
// 사진 표시 — labelPhoto(레거시 Base64) 또는 labelPhotoId(별도 문서)에서 로드. 세션 캐시.
const _imgCache = {};
function WineImg({ photo, photoId, style, alt="" }) {
  const [src, setSrc] = useState(photo || (photoId && _imgCache[photoId]) || "");
  useEffect(() => {
    let alive = true;
    if (photo) { setSrc(photo); return; }
    if (photoId) {
      if (_imgCache[photoId]) { setSrc(_imgCache[photoId]); return; }
      window.storage?.getImage?.(photoId).then(d => { if(d) _imgCache[photoId]=d; if(alive) setSrc(d||""); }).catch(()=>{});
    } else { setSrc(""); }
    return () => { alive = false; };
  }, [photo, photoId]);
  if (!src) return null;
  return <img src={src} alt={alt} style={style}/>;
}

function LabelPhoto({ photo, photoId, onUpload }) {
  const ir = useRef(null);
  const [preview, setPreview] = useState(photo || (photoId && _imgCache[photoId]) || "");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    if (photo) { setPreview(photo); return; }
    if (photoId) {
      if (_imgCache[photoId]) { setPreview(_imgCache[photoId]); return; }
      window.storage?.getImage?.(photoId).then(d => { if(d) _imgCache[photoId]=d; if(alive) setPreview(d||""); }).catch(()=>{});
    } else { setPreview(""); }
    return () => { alive = false; };
  }, [photo, photoId]);
  const hf = async e => {
    const f = e.target.files[0]; if(!f) return;
    setBusy(true);
    try {
      const dataUrl = await compressImage(f);
      setPreview(dataUrl);
      const id = await window.storage.setImage(dataUrl);
      if (id) _imgCache[id] = dataUrl;
      onUpload(id || "");
    } catch(err) { console.error(err); alert("사진 업로드 실패. 다시 시도해주세요."); }
    setBusy(false);
  };
  return (
    <div>
      {preview && (<img src={preview} alt="label" style={{width:"100%",maxHeight:300,objectFit:"contain",borderRadius:8,marginBottom:8,display:"block",background:"#f9f7f5"}}/>)}
      <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"9px",background:"#F7F4F0",border:"1px dashed #ddd",borderRadius:8,cursor:busy?"default":"pointer",fontSize:13,color:"#888"}}>
        📷 {busy?"업로드 중...":(preview?"라벨 사진 변경":"라벨 사진 추가")}
        <input ref={ir} type="file" accept="image/*" capture="environment" onChange={hf} disabled={busy} style={{display:"none"}}/>
      </label>
    </div>
  );
}

// ── WineCard ──────────────────────────────────────────────────────
function WCard({ wine, nc, onClick, extra }) {
  const [hov, sh] = useState(false);
  const rat = wine.expertRatings||{};
  const isBurg = wine.isBurgundy||["Burgundy","Bourgogne","부르고뉴"].some(r=>(wine.region||"").includes(r));
  const hasDetail=!!(wine.terroir?.soilType||wine.producerInfo?.history||wine.wineInsights);
  const isBord = wine.isBordeaux||["Bordeaux","보르도"].some(r=>(wine.region||"").includes(r));
  const avg = avgScore(wine);
  const topC = avg ? {v:avg.avg, ab:"avg"} : null;
  const isBord2 = wine.isBordeaux||["Bordeaux","보르도"].some(r=>(wine.region||"").includes(r));
  const dn = cleanName(wine.nameKR||wine.nameEN, wine.vintage);
  const isConsumed = wine.status==="Consumed";
  return (
    <div onMouseEnter={()=>sh(true)} onMouseLeave={()=>sh(false)} onClick={onClick}
      style={{background:"#fff",border:`1px solid ${hov?"#c4a0a8":"#ece8e4"}`,borderRadius:12,padding:16,marginBottom:10,cursor:"pointer",transition:"border-color .15s",opacity:isConsumed?.65:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{flex:1,minWidth:0,display:"flex",gap:10}}>
          <WineImg photo={wine.labelPhoto} photoId={wine.labelPhotoId} style={{width:44,height:60,objectFit:"cover",borderRadius:6,flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5,flexWrap:"wrap"}}>
              <span style={{fontSize:17}}>{TICON[wine.wineType]||"🍾"}</span>
              <span style={{fontWeight:600,fontSize:14,wordBreak:"break-word",flex:1,minWidth:0}}>{dn}</span>
              {wine.vintage && (<span style={{fontSize:13,color:GOLD,fontWeight:700}}>{wine.vintage}</span>)}
              {isConsumed && (<span style={{fontSize:11,background:"#f5f2ee",color:"#888",padding:"1px 7px",borderRadius:4}}>마심</span>)}
            </div>
            <div style={{fontSize:12,color:"#888",marginBottom:7}}>{[wine.producer,wine.region,wine.country].filter(Boolean).join(" · ")}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
              {!isConsumed && (<Badge from={wine.drinkFrom} until={wine.drinkUntil}/>)}
              {(nc||0)>0 && (<span style={{fontSize:11,background:"#D1FAE5",color:"#065F46",padding:"2px 8px",borderRadius:4}}>노트 {nc}</span>)}
              {wine.purchasePrice && (<span style={{fontSize:11,color:"#aaa"}}>₩{Number(wine.purchasePrice).toLocaleString()}</span>)}
              {wine.vineyardLat && (<span style={{fontSize:11,background:"#EFF6FF",color:"#1D4ED8",padding:"2px 8px",borderRadius:4}}>📍지도</span>)}
            </div>
          </div>
        </div>
        {topC && (
          <div style={{textAlign:"center",background:"#f9f7f5",borderRadius:10,padding:"10px 14px",marginLeft:12,flexShrink:0}}>
            <div style={{fontSize:22,fontWeight:700,color:GOLD,lineHeight:1}}>{topC.v}</div>
            <div style={{fontSize:10,fontWeight:600,color:"#bbb",marginTop:2}}>{topC.ab}</div>
          </div>
        )}
      </div>
      {extra && (<div onClick={e=>e.stopPropagation()} style={{marginTop:10}}>{extra}</div>)}
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────
function CellarTab({ wines, notes, onNav, onBatchFill, batchState }) {
  const [flt, sf] = useState("all");
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [countryFlt, setCF] = useState("all");
  const [typeFlt, setTF] = useState("all");
  const [aocFlt, setAF] = useState("all");
  const [showConsumed, setShowConsumed] = useState(false);

  const inStock = wines.filter(w=>w.status!=="Consumed");
  const consumed = wines.filter(w=>w.status==="Consumed");
  const countries = [...new Set(inStock.map(w=>w.country).filter(Boolean))].sort();
  const types = [...new Set(inStock.map(w=>w.wineType).filter(Boolean))].sort();

  // Main list: In Stock only
  let filtered = flt==="all" ? inStock : inStock.filter(w=>getDrinkStatus(w.drinkFrom,w.drinkUntil)===flt);
  if(countryFlt!=="all") filtered=filtered.filter(w=>w.country===countryFlt);
  if(typeFlt!=="all") filtered=filtered.filter(w=>w.wineType===typeFlt);
  if(aocFlt!=="all") filtered=filtered.filter(w=>getAOC(w)===aocFlt);
  if(search.trim()) {
    const q=search.toLowerCase();
    filtered=filtered.filter(w=>(w.nameKR||"").toLowerCase().includes(q)||(w.nameEN||"").toLowerCase().includes(q)||(w.producer||"").toLowerCase().includes(q)||(w.region||"").toLowerCase().includes(q));
  }
  filtered=[...filtered].sort((a,b)=>{
    if(sort==="newest") return (b.createdAt||"").localeCompare(a.createdAt||"");
    if(sort==="urgent"){
      const order={past:0,urgent:1,now:2,young:3,nv:4,null:5};
      return (order[getDrinkStatus(a.drinkFrom,a.drinkUntil)]??5)-(order[getDrinkStatus(b.drinkFrom,b.drinkUntil)]??5);
    }
    if(sort==="vintage_desc") return (parseInt(b.vintage)||0)-(parseInt(a.vintage)||0);
    if(sort==="vintage_asc") return (parseInt(a.vintage)||0)-(parseInt(b.vintage)||0);
    if(sort==="name") return (a.nameKR||a.nameEN||"").localeCompare(b.nameKR||b.nameEN||"","ko");
    if(sort==="until") return (parseInt(a.drinkUntil)||9999)-(parseInt(b.drinkUntil)||9999);
    return 0;
  });

  // Consumed: sort by date desc
  const consumedSorted = [...consumed].sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));

  const Chip=({v,cur,set,label})=>(
    <button onClick={()=>set(v)} style={{border:`1px solid ${cur===v?RED:"#ddd"}`,borderRadius:20,padding:"4px 11px",fontSize:11,fontWeight:cur===v?600:400,background:cur===v?RED:"#fff",color:cur===v?"#fff":"#666",cursor:"pointer",whiteSpace:"nowrap"}}>{label}</button>
  );

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <span style={{fontWeight:600,fontSize:15}}>내 셀러 <span style={{color:"#aaa",fontWeight:400,fontSize:13}}>({inStock.length}병)</span></span>
        <PB onClick={()=>onNav("add",{type:"cellar"})}>+ 와인 추가</PB>
      </div>

      {/* ── 일괄 AI 채우기 ── */}
      {(()=>{
        const empties = wines.filter(w=>!hasData(w.terroir)&&!w.wineInsights).length;
        if(batchState){
          const pct = Math.round(batchState.done/batchState.total*100);
          return (
            <div style={{background:"#FBF4E4",borderRadius:10,padding:"10px 14px",marginBottom:12,border:`1px solid ${GOLD}40`}}>
              <div style={{fontSize:13,fontWeight:600,color:GOLD,marginBottom:6}}>🤖 일괄 채우는 중... {batchState.done}/{batchState.total}</div>
              <div style={{height:6,background:"#eee",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:GOLD,transition:"width .3s"}}/></div>
              <div style={{fontSize:11,color:"#aaa",marginTop:5}}>앱을 닫지 마세요. 한도 회피를 위해 천천히 진행됩니다.</div>
            </div>
          );
        }
        if(empties===0) return null;
        return (
          <button onClick={onBatchFill} style={{width:"100%",background:"#FBF4E4",color:GOLD,border:`1px solid ${GOLD}40`,borderRadius:10,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:12}}>
            🤖 정보 없는 {empties}병 한번에 AI 채우기
          </button>
        );
      })()}

      {/* ── Drink timing alert ── */}
      {(()=>{
        const urgent=inStock.filter(w=>getDrinkStatus(w.drinkFrom,w.drinkUntil)==="urgent");
        const past=inStock.filter(w=>getDrinkStatus(w.drinkFrom,w.drinkUntil)==="past");
        if(urgent.length===0&&past.length===0)return null;
        return(
          <div style={{background:"linear-gradient(135deg,#FEF3C7,#FEE2E2)",borderRadius:12,padding:"12px 14px",marginBottom:12,border:"1px solid #F5D89A"}}>
            <div style={{fontSize:13,fontWeight:700,color:"#92400E",marginBottom:6}}>🔔 지금 챙겨야 할 와인</div>
            {past.length>0&&<div style={{fontSize:12,color:"#991B1B",marginBottom:3}}>🔴 피크 지남 {past.length}병 — 서둘러 드세요</div>}
            {urgent.length>0&&<div style={{fontSize:12,color:"#92400E"}}>🟡 올해~내년 마감 {urgent.length}병{urgent.length<=3?` — ${urgent.map(w=>cleanName(w.nameKR||w.nameEN,"")).join(", ")}`:""}</div>}
            <button onClick={()=>{sf("urgent");}} style={{marginTop:8,background:"#fff",border:"1px solid #F5D89A",borderRadius:6,padding:"4px 10px",fontSize:11,color:"#92400E",fontWeight:600,cursor:"pointer"}}>긴급 와인 보기 →</button>
          </div>
        );
      })()}

      {/* Search */}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 이름, 생산자, 지역 검색..."
        style={{...IS,marginBottom:10,fontSize:13}}/>

      {/* Drink status filter — In Stock only, no 마심 chip */}
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
        {[["all","전체"],["now","지금"],["urgent","긴급"],["past","피크지남"],["young","숙성중"]].map(([k,l])=>{
          const cnt=k==="all"?inStock.length:inStock.filter(w=>getDrinkStatus(w.drinkFrom,w.drinkUntil)===k).length;
          return <Chip key={k} v={k} cur={flt} set={sf} label={`${l}(${cnt})`}/>;
        })}
      </div>

      {/* Country + Type + AOC filter */}
      {countries.length>1&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
        <Chip v="all" cur={countryFlt} set={setCF} label="🌍 전체"/>
        {countries.map(c=><Chip key={c} v={c} cur={countryFlt} set={setCF} label={c}/>)}
      </div>}
      {types.length>1&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
        <Chip v="all" cur={typeFlt} set={setTF} label="🍾 전체"/>
        {types.map(t=><Chip key={t} v={t} cur={typeFlt} set={setTF} label={`${TICON[t]||"🍾"} ${t}`}/>)}
      </div>}
      {(()=>{const aocs=[...new Set(inStock.map(w=>getAOC(w)))].sort();return aocs.length>1&&(
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
          <Chip v="all" cur={aocFlt} set={setAF} label="🌍 AOC 전체"/>
          {aocs.map(a=><Chip key={a} v={a} cur={aocFlt} set={setAF} label={a}/>)}
        </div>
      );})()}

      {/* Sort */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <span style={{fontSize:11,color:"#aaa",flexShrink:0}}>정렬:</span>
        <select value={sort} onChange={e=>setSort(e.target.value)} style={{fontSize:12,border:"1px solid #ddd",borderRadius:6,padding:"4px 8px",background:"#fff",color:"#555"}}>
          <option value="newest">최근 추가순</option>
          <option value="urgent">음용 적기순</option>
          <option value="until">마감 임박순</option>
          <option value="vintage_desc">빈티지 최신순</option>
          <option value="vintage_asc">빈티지 오래된순</option>
          <option value="name">이름순</option>
        </select>
        <span style={{fontSize:11,color:"#aaa"}}>{filtered.length}병</span>
      </div>

      {/* In Stock wine list */}
      {filtered.length===0
        ? <div style={{textAlign:"center",color:"#bbb",padding:48}}>{inStock.length===0?"와인을 추가해보세요 🍷":"검색 결과 없음"}</div>
        : filtered.map(w => <WCard key={w.id} wine={w} nc={notes.filter(n=>n.wineId===w.id).length} onClick={()=>onNav("detail",{wine:w})}/>)
      }

      {/* ── Consumed section (collapsible) ── */}
      {consumed.length > 0 && (
        <div style={{marginTop:24}}>
          <button onClick={()=>setShowConsumed(v=>!v)}
            style={{width:"100%",background:"#f5f2ee",border:"none",borderRadius:10,padding:"11px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",textAlign:"left"}}>
            <span style={{fontSize:13,fontWeight:600,color:"#888"}}>🍷 마신 와인 <span style={{fontSize:12,fontWeight:400}}>({consumed.length}병)</span></span>
            <span style={{fontSize:13,color:"#aaa"}}>{showConsumed?"▲ 접기":"▼ 펼치기"}</span>
          </button>
          {showConsumed && (
            <div style={{marginTop:8}}>
              {consumedSorted.map(w => (
                <div key={w.id} style={{opacity:.75}}>
                  <WCard wine={w} nc={notes.filter(n=>n.wineId===w.id).length} onClick={()=>onNav("detail",{wine:w})}/>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function TastingTab({ notes, wines, onNav }) {
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <span style={{fontWeight:600,fontSize:15}}>시음노트 <span style={{color:"#aaa",fontWeight:400}}>({notes.length})</span></span>
        <PB onClick={()=>onNav("tasting",{})}>+ 노트 작성</PB>
      </div>
      {notes.length===0 ? (<div style={{textAlign:"center",color:"#bbb",padding:48}}>마신 와인을 기록해보세요 📝</div>)
      : [...notes].reverse().map(note => {
        const w = wines.find(x=>x.id===note.wineId);
        return (
          <div key={note.id} onClick={()=>onNav("note",{note})} style={{...CS,cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
              {(note.notePhotoId || w?.labelPhoto || w?.labelPhotoId) && (
                <WineImg photo={w?.labelPhoto} photoId={note.notePhotoId || w?.labelPhotoId}
                  style={{width:46,height:60,objectFit:"cover",borderRadius:6,flexShrink:0}}/>
              )}
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:5,flexWrap:"wrap"}}>
                  <span>{TICON[w?.wineType]||"🍾"}</span>
                  <span style={{fontWeight:600,fontSize:14}}>{cleanName(note.wineName,note.vintage)}</span>
                  {note.vintage && (<span style={{color:GOLD,fontWeight:600,fontSize:13}}>{note.vintage}</span>)}
                  {note.taster && (<span style={{fontSize:10,fontWeight:700,borderRadius:10,padding:"1px 7px",background:note.taster==="아내"?"#E8F5E9":"#FDF1F2",color:note.taster==="아내"?"#2E7D32":RED}}>{note.taster}</span>)}
                </div>
                <div style={{fontSize:12,color:"#888",marginBottom:note.overallImpression?4:0}}>{note.date}{note.location?` · ${note.location}`:""}</div>
                {note.overallImpression && (<div style={{fontSize:12,color:"#666",lineHeight:1.5}}>{note.overallImpression.slice(0,90)}…</div>)}
              </div>
              {note.rating && (<div style={{fontSize:22,fontWeight:700,color:GOLD,flexShrink:0,marginLeft:4}}>{note.rating}</div>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
function WishlistTab({ wines, onNav, onMove }) {
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <span style={{fontWeight:600,fontSize:15}}>관심 와인 <span style={{color:"#aaa",fontWeight:400}}>({wines.length})</span></span>
        <PB onClick={()=>onNav("add",{type:"wishlist"})}>+ 와인 추가</PB>
      </div>
      {wines.length===0 ? (<div style={{textAlign:"center",color:"#bbb",padding:48}}>관심 있는 와인을 저장해두세요 ❤️</div>)
      : wines.map(w => (
        <WCard key={w.id} wine={w} onClick={()=>onNav("detail",{wine:w})}
          extra={<button onClick={()=>onMove(w.id)} style={{background:"#065F46",color:"#fff",border:"none",borderRadius:6,fontSize:12,fontWeight:600,padding:"5px 12px",cursor:"pointer"}}>셀러로 이동 →</button>}/>
      ))}
    </div>
  );
}

// ── Add Wine Page ─────────────────────────────────────────────────
const emptyWine = () => ({
  nameKR:"",nameEN:"",vintage:"",producer:"",country:"",region:"",subRegion:"",vineyard:"",classification:"",grapeVariety:"",wineType:"Red",
  drinkFrom:"",drinkUntil:"",description:"",isBurgundy:false,
  vineyardLat:"",vineyardLon:"",vineyardZoom:"",mapNotes:"",
  terroir:{soilType:"",soilDesc:"",slope:"",aspect:"",altitude:"",vineAge:"",vineyardSize:"",microclimate:"",geology:""},
  producerInfo:{founded:"",size:"",certifications:"",history:"",philosophy:"",approach:""},
  vintageInfo:{weather:"",harvest:"",characteristics:"",agingPotential:""},
  winemaking:{fermentation:"",yeast:"",vessel:"",aging:"",agingVessel:"",agingTime:"",malo:"",filtration:"",sulfur:""},
  expertNotes:[],
  expertRatings:{bh:"",ws:"",wa:"",vinous:"",js:"",jr:"",dec:"",jm:""},
  purchaseDate:"",shop:"",purchasePrice:"",bottleSize:"750ml",quantity:"1",location:"",notes:"",
  labelPhoto:"",status:"In Stock"
});

function AddWinePage({ type, onAdd, onBack }) {
  const [step, ss] = useState("search");
  const [q, sq] = useState(""), [v, sv] = useState(""), [loading, sl] = useState(false);
  const [form, sf] = useState(emptyWine());
  const [filling, setFilling] = useState(false);
  const upF = k => e => sf(p=>({...p,[k]:e.target.value}));

  async function doFill() {
    const name = form.nameKR||form.nameEN;
    if (!name) return;
    setFilling(true);
    try {
      const info = await lookupWine(name, form.vintage);
      sf(p => ({
        ...p, ...info,
        nameKR: p.nameKR||info.nameKR||"",
        nameEN: p.nameEN||info.nameEN||"",
        vintage: p.vintage||info.vintage||"",
        expertRatings: {...(p.expertRatings||{}),...(info.expertRatings||{})},
      }));
      // Then load detailed info
      const detail = await lookupWineDetail(name, form.vintage);
      sf(p => ({
        ...p,
        terroir: {...(p.terroir||{}),...(detail.terroir||{})},
        producerInfo: {...(p.producerInfo||{}),...(detail.producerInfo||{})},
        vintageInfo: {...(p.vintageInfo||{}),...(detail.vintageInfo||{})},
        winemaking: {...(p.winemaking||{}),...(detail.winemaking||{})},
        expertNotes: detail.expertNotes||p.expertNotes||[],
      }));
    } catch(e) {}
    setFilling(false);
  }
  const upR = k => e => sf(p=>({...p,expertRatings:{...p.expertRatings,[k]:e.target.value}}));

  async function doLookup(query, vintage, extra) {
    const qq = (typeof query==="string" && query) ? query : q;
    const vv = (typeof vintage==="string") ? vintage : v;
    sl(true);
    try {
      const info = await lookupWine(qq, vv);
      sf(p => ({
        ...p, ...(extra||{}),
        nameKR: info.nameKR || qq,
        nameEN: info.nameEN || "",
        vintage: vv || info.vintage || "",
        producer: info.producer || "",
        country: normCountry(info.country) || "",
        region: info.region || "",
        subRegion: info.subRegion || "",
        vineyard: info.vineyard || "",
        classification: info.classification || "",
        grapeVariety: info.grapeVariety || "",
        wineType: info.wineType || "Red",
        drinkFrom: info.drinkFrom || "",
        drinkUntil: info.drinkUntil || "",
        description: info.description || "",
        isBurgundy: info.isBurgundy || false,
        vineyardLat: info.vineyardLat || "",
        vineyardLon: info.vineyardLon || "",
        vineyardZoom: info.vineyardZoom || "15",
        mapNotes: info.mapNotes || "",
        expertRatings: {...(p.expertRatings||{}), ...(info.expertRatings||{})},
      }));
      ss("form");
    } catch(e) {
      // Show error and still go to form with just the name
      sf(p=>({...p, ...(extra||{}), nameKR:qq, vintage:vv, _lookupError:String(e)}));
      ss("form");
    }
    sl(false);
  }

  // ── 라벨 스캔 ──
  const scanRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState("");
  async function onScanPick(e){
    const f=e.target.files?.[0]; if(!f) return;
    setScanErr(""); setScanning(true);
    try{
      const dataUrl=await compressImage(f);
      const res=await scanLabel(dataUrl);
      const name=res.nameEN||res.producer;
      if(!name){ setScanErr("라벨에서 와인명을 못 읽었어요. 더 선명한 사진으로 다시 찍거나 직접 검색하세요."); setScanning(false); return; }
      sq(name); if(res.vintage) sv(String(res.vintage));
      const imgId = await window.storage.setImage?.(dataUrl);
      if(imgId) _imgCache[imgId]=dataUrl;
      await doLookup(name, res.vintage?String(res.vintage):"", {labelPhotoId:imgId||""});
    }catch(err){ setScanErr(String(err.message||err)); }
    setScanning(false);
    if(scanRef.current) scanRef.current.value="";
  }

  return (
    <div style={{minHeight:"100vh",background:"#F7F4F0",fontFamily:"system-ui,sans-serif"}}>
      <TopBar title={type==="cellar"?"🍾 셀러에 추가":"❤️ 관심 와인 추가"} onBack={onBack}/>
      <Pg>
        {step==="search" ? (
          <div style={CS}>
            <SH>와인 검색</SH>
            <FF label="와인 이름 *" value={q} onChange={e=>sq(e.target.value)} placeholder="예: Chambolle-Musigny Les Amoureuses"/>
            <FF label="빈티지 (선택)" value={v} onChange={e=>sv(e.target.value)} placeholder="예: 2019"/>
            <div style={{display:"flex",gap:10,marginTop:4}}>
              <PB onClick={()=>doLookup()} disabled={loading||!q.trim()} xs={{flex:1}}>{loading?"🤖 검색 중...":"🤖 AI로 와인 정보 불러오기"}</PB>
              <GB onClick={()=>{sf(p=>({...p,nameKR:q,vintage:v}));ss("form");}}>직접 입력</GB>
            </div>
            <div style={{borderTop:"1px solid #eee",marginTop:14,paddingTop:14}}>
              <div style={{fontSize:12,color:"#888",marginBottom:8}}>또는 라벨 사진으로 자동 인식 📸</div>
              <input ref={scanRef} type="file" accept="image/*" onChange={onScanPick} style={{display:"none"}}/>
              <PB onClick={()=>scanRef.current?.click()} disabled={scanning} full xs={{background:scanning?"#ccc":GOLD}}>
                {scanning?"📸 라벨 읽는 중...":"📸 라벨 사진 스캔"}
              </PB>
              {scanErr && <div style={{fontSize:11,color:"#991B1B",marginTop:6,lineHeight:1.5}}>{scanErr}</div>}
            </div>
          </div>
        ) : (
          <div>
            <button onClick={()=>ss("search")} style={{background:"none",border:"none",fontSize:13,color:"#888",marginBottom:12,padding:0,cursor:"pointer"}}>← 다시 검색</button>
            {form._lookupError && (
              <div style={{background:"#FEE2E2",border:"1px solid #FCA5A5",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#991B1B"}}>
                ⚠️ AI 조회 오류: {form._lookupError}. 필드를 직접 입력하거나 다시 시도해주세요.
              </div>
            )}
            <div style={CS}><SH>📷 라벨 사진</SH><LabelPhoto photo={form.labelPhoto} photoId={form.labelPhotoId} onUpload={id=>sf(p=>({...p,labelPhotoId:id,labelPhoto:""}))}/></div>
            <div style={CS}>
              <SH>기본 정보</SH>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <FF label="한국어 이름" value={form.nameKR} onChange={upF("nameKR")}/><FF label="영문 이름" value={form.nameEN} onChange={upF("nameEN")}/>
                <FF label="빈티지" value={form.vintage} onChange={upF("vintage")}/><FF label="종류" value={form.wineType} onChange={upF("wineType")} options={["Red","White","Rosé","Sparkling","Dessert","Fortified"]}/>
              </div>
              {/* AI fill button — shown when name filled but producer empty */}
              {(form.nameKR||form.nameEN) && !form.producer && (
                <button onClick={doFill} disabled={filling} style={{width:"100%",padding:"11px",background:filling?"#e8d8a0":GOLD,color:"#fff",border:"none",borderRadius:8,fontWeight:600,fontSize:14,cursor:"pointer",marginTop:4,marginBottom:4}}>
                  {filling ? "🤖 AI가 정보를 찾는 중..." : "🤖 AI로 나머지 정보 자동완성"}
                </button>
              )}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <FF label="생산자" value={form.producer} onChange={upF("producer")}/><FF label="국가" value={form.country} onChange={upF("country")}/>
                <FF label="지역" value={form.region} onChange={upF("region")}/><FF label="세부지역" value={form.subRegion} onChange={upF("subRegion")}/>
                <FF label="포도밭" value={form.vineyard} onChange={upF("vineyard")}/><FF label="등급" value={form.classification} onChange={upF("classification")}/>
                <FF label="음용 From" value={form.drinkFrom} onChange={upF("drinkFrom")} placeholder="2026"/><FF label="음용 Until" value={form.drinkUntil} onChange={upF("drinkUntil")} placeholder="2040"/>
              </div>
              <FF label="포도품종" value={form.grapeVariety} onChange={upF("grapeVariety")}/>
              {form.description && (<div style={NS}>{form.description}</div>)}
            </div>
            {form.vineyardLat&&form.vineyardLon && (
              <div style={CS}>
                <SH>📍 포도밭 위치</SH>
                {form.mapNotes && (<div style={{fontSize:12,color:"#888",marginBottom:8}}>{form.mapNotes}</div>)}
                <MapDisplay lat={form.vineyardLat} lon={form.vineyardLon} zoom={form.vineyardZoom} label={form.mapNotes}/>
              </div>
            )}
            <div style={CS}>
              <SH>전문가 평점</SH>
              {form.isBurgundy && (<div style={{fontSize:12,color:GOLD,background:"#FBF4E4",padding:"7px 10px",borderRadius:6,marginBottom:12}}>★ 부르고뉴 — BH, JM 필수 확인</div>)}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {CRITICS.map(c => (
                  <div key={c.k}>
                    <div style={{fontSize:11,fontWeight:700,color:c.burg?GOLD:"#888",letterSpacing:.5,marginBottom:4,textTransform:"uppercase"}}>{c.ab}{c.burg?" ★":""}<span style={{fontWeight:400,color:"#ccc"}}> /{c.max}</span></div>
                    <input value={(form.expertRatings||{})[c.k]||""} onChange={upR(c.k)} placeholder={`/${c.max}`} style={IS}/>
                  </div>
                ))}
              </div>
            </div>
            {type==="cellar" && (
              <div style={CS}>
                <SH>구매 정보</SH>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <FF label="구매일" value={form.purchaseDate} onChange={upF("purchaseDate")} type="date"/><FF label="구매처" value={form.shop} onChange={upF("shop")} placeholder="와인샵 등"/>
                  <FF label="구매가 (원)" value={form.purchasePrice} onChange={upF("purchasePrice")} type="number"/><FF label="용량" value={form.bottleSize} onChange={upF("bottleSize")}/>
                  <FF label="수량" value={form.quantity} onChange={upF("quantity")} type="number"/><FF label="보관위치" value={form.location} onChange={upF("location")} placeholder="거실, 창고방 등"/>
                </div>
              </div>
            )}
            <FF label="메모" value={form.notes} onChange={upF("notes")} rows={2} placeholder="특이사항..."/>
            <PB onClick={()=>{if(!form.nameKR&&!form.nameEN)return;onAdd(form);}} disabled={!form.nameKR&&!form.nameEN} full>
              {type==="cellar"?"🍾 셀러에 추가":"❤️ 관심 와인으로 저장"}
            </PB>
          </div>
        )}
      </Pg>
    </div>
  );
}

// ── Wine Detail Page (WSET3+ Enhanced) ───────────────────────────
function WineDetailPage({ wine, wines=[], notes, onBack, onUpdate, onDelete, onTaste, onOpenWine, googleMapsKey="", tasters=["나","아내"] }) {
  const [ed, se] = useState(false);
  const [form, sf] = useState({...wine, expertRatings:{...(wine.expertRatings||{})}});
  const [enriching, setEnriching] = useState(false);
  const [reco, setReco] = useState(wine.recommendations||null);
  const [loadingReco, setLoadingReco] = useState(false);
  async function doLoadReco(){
    setLoadingReco(true);
    try{
      const d=await recommendFromCellar(wine, wines);
      setReco(d); onUpdate({recommendations:d});
    }catch(e){}
    setLoadingReco(false);
  }
  const [insights, setInsights] = useState(wine.wineInsights||null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [subtab, setSubtab] = useState("detail");

  async function doLoadInsights(){
    setLoadingInsights(true);
    try{
      const data = await lookupWineInsights(wine.nameKR||wine.nameEN, wine.vintage);
      if(data && Object.keys(data).length > 0){
        setInsights(data);
        onUpdate({wineInsights: data});
      }
    }catch(e){}
    setLoadingInsights(false);
  }
  async function doEnrich(){
    setEnriching(true);
    try{
      const ch = await computeEnrich(wine, wines);
      if(ch){ onUpdate(ch); setInsights(ch.wineInsights||null); if(ch.recommendations) setReco(ch.recommendations); setSubtab("detail"); }
    }catch(e){}
    setEnriching(false);
  }
  async function handleMapGenerate(){
    try{
      const svg=await generateVineyardMap(wine);
      if(svg) onUpdate({vineyardSvg:svg});
      return svg;
    }catch(e){ return null; }
  }
  const upF = k => e => sf(p=>({...p,[k]:e.target.value}));
  const upR = k => e => sf(p=>({...p,expertRatings:{...p.expertRatings,[k]:e.target.value}}));
  const rat = syncRatings(wine.expertNotes, wine.expertRatings||{}); // 노트 점수 자동 반영
  const hasR = Object.values(rat).some(Boolean);
  const isBurg = wine.isBurgundy||["Burgundy","Bourgogne","부르고뉴"].some(r=>(wine.region||"").includes(r));
  const isBord = wine.isBordeaux||["Bordeaux","보르도"].some(r=>(wine.region||"").includes(r));
  const isConsumed = wine.status==="Consumed";
  const dn = cleanName(wine.nameKR||wine.nameEN, wine.vintage);
  const enUS = cleanName(wine.nameEN||"", wine.vintage);

  return (
    <div style={{minHeight:"100vh",background:"#F7F4F0",fontFamily:"system-ui,sans-serif"}}>
      <TopBar title={`${TICON[wine.wineType]||"🍾"} ${dn}`} onBack={onBack} right={
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>se(!ed)} style={{background:"rgba(255,255,255,.18)",border:"none",borderRadius:6,color:"#fff",fontSize:12,padding:"5px 12px",cursor:"pointer"}}>{ed?"취소":"수정"}</button>
          <DeleteBtn onDelete={onDelete}/>
        </div>}/>
      <Pg>
        {/* ── Hero ── */}
        <div style={CS}>
          <div style={{display:"flex",gap:12}}>
            <WineImg photo={wine.labelPhoto} photoId={wine.labelPhotoId} style={{width:80,height:110,objectFit:"contain",borderRadius:8,flexShrink:0,background:"#f9f7f5"}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:21,fontWeight:700,fontFamily:"Georgia,serif",marginBottom:4,lineHeight:1.3}}>{dn}</div>
              {wine.nameKR&&wine.nameEN && (<div style={{fontSize:13,color:"#888",marginBottom:4,fontStyle:"italic"}}>{enUS}</div>)}
              {wine.vintage && (<div style={{fontSize:17,color:GOLD,fontWeight:700,marginBottom:6}}>{wine.vintage}</div>)}
              <div style={{fontSize:13,color:"#666",marginBottom:6}}>{[wine.producer,wine.region,wine.country].filter(Boolean).join(" · ")}</div>
              {wine.classification && (<div style={{fontSize:12,color:RED,fontWeight:600,marginBottom:8}}>{wine.classification}</div>)}
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                {isConsumed ? (<span style={{fontSize:12,background:"#f5f2ee",color:"#888",padding:"3px 10px",borderRadius:20}}>마신 와인</span>) : (<Badge from={wine.drinkFrom} until={wine.drinkUntil}/>)}
                {wine.drinkFrom&&wine.drinkUntil && (<span style={{fontSize:12,color:"#aaa"}}>({wine.drinkFrom}–{wine.drinkUntil})</span>)}
              </div>
            </div>
            {isBurg&&rat.bh ? (
              <div style={{textAlign:"center",background:"#FBF4E4",borderRadius:12,padding:"10px 14px",flexShrink:0,border:`1px solid ${GOLD}40`}}>
                <div style={{fontSize:28,fontWeight:700,color:GOLD,lineHeight:1}}>{rat.bh}</div>
                <div style={{fontSize:10,fontWeight:700,color:GOLD,marginTop:2}}>BH ★</div>
                <div style={{fontSize:9,color:"#b08030"}}>Burghound</div>
              </div>
            ) : isBord&&rat.wa ? (
              <div style={{textAlign:"center",background:"#F0F4FE",borderRadius:12,padding:"10px 14px",flexShrink:0,border:"1px solid #B8CCF040"}}>
                <div style={{fontSize:28,fontWeight:700,color:"#3B5BA5",lineHeight:1}}>{rat.wa}</div>
                <div style={{fontSize:10,fontWeight:700,color:"#3B5BA5",marginTop:2}}>WA ★</div>
                <div style={{fontSize:9,color:"#3B5BA5",opacity:.7}}>Wine Advocate</div>
              </div>
            ) : hasR ? (
              <div style={{textAlign:"center",background:"#f9f7f5",borderRadius:12,padding:"10px 14px",flexShrink:0}}>
                {CRITICS.filter(c=>rat[c.k]).slice(0,1).map(c=>(
                  <div key={c.k}><div style={{fontSize:28,fontWeight:700,color:GOLD,lineHeight:1}}>{rat[c.k]}</div><div style={{fontSize:10,fontWeight:600,color:"#888",marginTop:2}}>{c.ab}</div></div>
                ))}
              </div>
            ) : null}
          </div>
          {wine.description && (<p style={{fontSize:13,color:"#555",lineHeight:1.8,marginTop:14,paddingTop:14,borderTop:"1px solid #f0ece8",marginBottom:0}}>{wine.description}</p>)}
        </div>

        {!ed ? (
          <div>
            {/* ── Basic Wine Info ── */}
            <div style={CS}>
              <SH>🍾 와인 정보</SH>
              <DR label="생산자" val={wine.producer}/><DR label="국가" val={wine.country}/>
              <DR label="지역" val={wine.region}/><DR label="세부지역" val={wine.subRegion}/>
              <DR label="포도밭" val={wine.vineyard}/><DR label="등급" val={wine.classification}/>
              <DR label="포도품종" val={wine.grapeVariety}/><DR label="용량" val={wine.bottleSize}/>
            </div>

            {/* ── AI Enrich prompt ── */}
            {/* ── AI Enrich prompt ── */}
            {!enriching&&(
              <div style={{...CS,background:"#FDFAF5",border:`1px solid ${GOLD}30`,padding:"10px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    {hasData(wine.terroir)||hasData(wine.producerInfo)
                      ? <div style={{fontSize:12,color:"#2E7D32",fontWeight:600}}>✅ AI 정보 입력됨 (상세+팁+추천)</div>
                      : <><div style={{fontSize:12,fontWeight:600,color:"#666"}}>📖 상세 정보 없음</div>
                          <div style={{fontSize:11,color:"#bbb",marginTop:1}}>상세정보·팁·셀러 추천을 한 번에 채워드려요</div></>
                    }
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button onClick={doEnrich} style={{background:RED,color:"#fff",border:"none",borderRadius:8,padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                      🤖 {hasData(wine.terroir)||hasData(wine.producerInfo)?"재조회":"AI 한번에 채우기"}
                    </button>
                    {(hasData(wine.terroir)||hasData(wine.producerInfo)||wine.wineInsights)&&(
                      <button onClick={()=>{if(window.confirm("AI가 채운 정보를 모두 초기화할까요?"))onUpdate({terroir:{},producerInfo:{},vintageInfo:{},winemaking:{},expertNotes:[],wineInsights:null})}}
                        style={{background:"#f5f5f5",color:"#999",border:"1px solid #e0e0e0",borderRadius:8,padding:"7px 10px",fontSize:11,cursor:"pointer"}} title="AI 데이터 초기화">
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {enriching&&(
              <div style={{...CS,textAlign:"center",color:GOLD,fontSize:13}}>
                🤖 AI가 상세정보·팁·셀러 추천을 한 번에 조회 중... 잠시만요.
              </div>
            )}
            {/* ── 내부 탭 ── */}
            <div style={{display:"flex",gap:4,position:"sticky",top:0,zIndex:5,background:"#F7F4F0",padding:"6px 0",marginBottom:4}}>
              {[["detail","상세"],["taste","시음노트"],["tips","팁"]].map(([k,l])=>(
                <button key={k} onClick={()=>setSubtab(k)}
                  style={{flex:1,padding:"8px 2px",fontSize:13,fontWeight:subtab===k?700:500,borderRadius:8,cursor:"pointer",border:"none",background:subtab===k?RED:"#fff",color:subtab===k?"#fff":"#888",boxShadow:subtab===k?"none":"0 1px 2px rgba(0,0,0,.04)"}}>
                  {l}
                </button>
              ))}
            </div>

            {/* ── Expert Ratings ── */}
            {subtab==="detail" && hasR && (
              <div style={CS}>
                <SH>🏅 전문가 평점</SH>

                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(78px,1fr))",gap:8}}>
                  {CRITICS.filter(c=>rat[c.k]).map(c=>{
                    const isBurgCritic=c.burg;
                    const isBordCritic=c.k==="wa";
                    const bg=isBurgCritic?"#FBF4E4":isBordCritic&&isBord?"#F0F4FE":"#f9f7f5";
                    const fg=isBurgCritic?GOLD:isBordCritic&&isBord?"#3B5BA5":"#1a1517";
                    const bd=isBurgCritic?`1px solid ${GOLD}30`:isBordCritic&&isBord?"1px solid #B8CCF040":"none";
                    return(
                      <div key={c.k} style={{background:bg,borderRadius:8,padding:"10px 8px",textAlign:"center",border:bd}}>
                        <div style={{fontSize:22,fontWeight:700,color:fg}}>{rat[c.k]}</div>
                        <div style={{fontSize:10,fontWeight:700,color:fg,marginTop:2}}>{c.ab}{(isBurgCritic||isBordCritic&&isBord)?" ★":""}</div>
                        <div style={{fontSize:9,color:"#ccc"}}>/{c.max}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Expert Tasting Notes ── */}
            {subtab==="taste" && wine.expertNotes && wine.expertNotes.filter(n=>!isDisclaimerNote(n.note)).length > 0 && (
              <div style={CS}>
                <SH>🗣 전문가 시음노트</SH>
                {wine.expertNotes.filter(n=>!isDisclaimerNote(n.note)).map((en, i) => (
                  <div key={i} style={{background:"#faf8f5",borderRadius:10,padding:14,marginBottom:10,borderLeft:`3px solid ${RED}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <div style={{fontWeight:700,fontSize:13,color:RED}}>{en.critic}</div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        {en.score && (<span style={{fontSize:15,fontWeight:700,color:GOLD}}>{en.score}</span>)}
                        {en.year && (<span style={{fontSize:11,color:"#aaa"}}>{en.year}</span>)}
                      </div>
                    </div>
                    {en.note && (<div style={{fontSize:13,color:"#555",lineHeight:1.8,fontStyle:"italic"}}>"{en.note}"</div>)}
                  </div>
                ))}
              </div>
            )}

            {/* ── Winery Official Note ── */}
            {subtab==="taste" && wine.officialNote && (
              <div style={CS}>
                <SH>🍇 와이너리 공식 시음노트</SH>
                <div style={{background:"#FBF8F4",borderRadius:10,padding:14,borderLeft:`3px solid ${GOLD}`,fontSize:13,color:"#555",lineHeight:1.8,fontStyle:"italic"}}>"{wine.officialNote}"</div>
              </div>
            )}

            {/* ── Terroir ── */}
            {subtab==="detail" && hasData(wine.terroir) && (
              <div style={CS}>
                <SH>🌿 테루아</SH>
                <DR label="토양 유형" val={wine.terroir.soilType}/>
                <DR label="경사도" val={wine.terroir.slope}/>
                <DR label="방향" val={wine.terroir.aspect}/>
                <DR label="고도" val={wine.terroir.altitude}/>
                <DR label="수령" val={wine.terroir.vineAge}/>
                <DR label="면적" val={wine.terroir.vineyardSize}/>
                <DR label="지질" val={wine.terroir.geology}/>
                {wine.terroir.soilDesc && (<div style={NS}>{wine.terroir.soilDesc}</div>)}
                {wine.terroir.microclimate && (<div style={{...NS,marginTop:6}}>🌡 {wine.terroir.microclimate}</div>)}
              </div>
            )}

            {/* ── Producer ── */}
            {subtab==="detail" && hasData(wine.producerInfo) && (
              <div style={CS}>
                <SH>🏡 생산자 — {wine.producer}</SH>
                <DR label="설립" val={wine.producerInfo.founded}/>
                <DR label="규모" val={wine.producerInfo.size}/>
                <DR label="인증" val={wine.producerInfo.certifications}/>
                {wine.producerInfo.history && (<div style={NS}>{wine.producerInfo.history}</div>)}
                {wine.producerInfo.philosophy && (<div style={QS}>"{wine.producerInfo.philosophy}"</div>)}
                {wine.producerInfo.approach && (<div style={{...NS,marginTop:6}}>{wine.producerInfo.approach}</div>)}
              </div>
            )}

            {/* ── Vintage ── */}
            {subtab==="detail" && hasData(wine.vintageInfo) && (
              <div style={CS}>
                <SH>📅 {wine.vintage} 빈티지</SH>
                <DR label="기상" val={wine.vintageInfo.weather}/>
                <DR label="수확" val={wine.vintageInfo.harvest}/>
                <DR label="숙성 잠재력" val={wine.vintageInfo.agingPotential}/>
                {wine.vintageInfo.characteristics && (<div style={NS}>{wine.vintageInfo.characteristics}</div>)}
              </div>
            )}

            {/* ── Winemaking ── */}
            {subtab==="detail" && hasData(wine.winemaking) && (
              <div style={CS}>
                <SH>⚗️ 양조</SH>
                <DR label="발효" val={wine.winemaking.fermentation}/>
                <DR label="효모" val={wine.winemaking.yeast}/>
                <DR label="발효 용기" val={wine.winemaking.vessel}/>
                <DR label="숙성 방식" val={wine.winemaking.aging}/>
                <DR label="숙성 용기" val={wine.winemaking.agingVessel}/>
                <DR label="숙성 기간" val={wine.winemaking.agingTime}/>
                <DR label="말로라틱" val={wine.winemaking.malo}/>
                <DR label="여과" val={wine.winemaking.filtration}/>
                <DR label="SO2" val={wine.winemaking.sulfur}/>
              </div>
            )}

            {/* ── Map ── */}
            {subtab==="detail" && wine.vineyardLat&&wine.vineyardLon && (
              <div style={CS}>
                <SH>📍 포도밭 위치</SH>
                {wine.mapNotes && (<div style={{fontSize:12,color:"#888",marginBottom:8}}>{wine.mapNotes}</div>)}
                <MapDisplay lat={wine.vineyardLat} lon={wine.vineyardLon} zoom={wine.vineyardZoom} label={wine.mapNotes}/>
              </div>
            )}

            {/* ── Wine Insights / Tips ── */}
            {subtab==="tips" && insights && (
            <div style={CS}>
              <SH>💡 알아두면 좋은 것</SH>
                <div>
                  {/* Hierarchy table */}
                  {insights.hierarchy?.table?.length > 0 && (
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:8,textTransform:"uppercase"}}>🍇 생산자 라인업 위계</div>
                      {insights.hierarchy.description && <div style={{fontSize:12,color:"#666",marginBottom:8,lineHeight:1.5}}>{insights.hierarchy.description}</div>}
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead>
                          <tr style={{background:"#f5f2ee"}}>
                            <th style={{padding:"5px 8px",textAlign:"left",color:"#888",fontWeight:600,width:32}}>순위</th>
                            <th style={{padding:"5px 8px",textAlign:"left",color:"#888",fontWeight:600}}>와인</th>
                            <th style={{padding:"5px 8px",textAlign:"left",color:"#888",fontWeight:600}}>분류</th>
                          </tr>
                        </thead>
                        <tbody>
                          {insights.hierarchy.table.map((row,i)=>(
                            <tr key={i} style={{background:row.isCurrent?"#FBF4E4":"transparent",borderBottom:"1px solid #f0ece8"}}>
                              <td style={{padding:"6px 8px",color:row.isCurrent?GOLD:"#888",fontWeight:row.isCurrent?700:400}}>{row.rank}</td>
                              <td style={{padding:"6px 8px",fontWeight:row.isCurrent?700:400,color:row.isCurrent?RED:"#333",wordBreak:"break-word"}}>{row.name}{row.isCurrent?" ◀ 이 와인":""}</td>
                              <td style={{padding:"6px 8px",fontSize:11,color:"#888",wordBreak:"break-word"}}>{row.category}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {/* Classification key */}
                  {insights.classificationKey?.items?.length > 0 && (
                    <div style={{marginBottom:12,background:"#F5F0E8",borderRadius:8,padding:"10px 12px"}}>
                      <div style={{fontSize:11,fontWeight:700,color:GOLD,marginBottom:8}}>🔑 {insights.classificationKey.title||"알아야 할 핵심 코드"}</div>
                      {insights.classificationKey.items.map((item,i)=>(
                        <div key={i} style={{marginBottom:i<insights.classificationKey.items.length-1?8:0}}>
                          <div style={{fontSize:12,fontWeight:700,color:RED,marginBottom:2,wordBreak:"break-word"}}>{item.code}</div>
                          <div style={{fontSize:12,color:"#555",lineHeight:1.6}}>{item.meaning}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Essential context */}
                  {insights.essentialContext && (
                    <div style={{...QS,marginBottom:12}}>{insights.essentialContext}</div>
                  )}
                  {/* Critical insight */}
                  {insights.criticalInsight && (
                    <div style={{marginBottom:12,background:"#F0F4FE",borderRadius:8,padding:"10px 12px",borderLeft:`3px solid #3B5BA5`}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#3B5BA5",marginBottom:4}}>💡 핵심 감상 포인트</div>
                      <div style={{fontSize:13,color:"#333",lineHeight:1.6}}>{insights.criticalInsight}</div>
                    </div>
                  )}
                  {insights.predictedPalate && (
                    <div style={{marginBottom:12,background:"#FBF6F2",borderRadius:8,padding:"12px 14px",borderLeft:`3px solid ${RED}`}}>
                      <div style={{fontSize:11,fontWeight:700,color:RED,marginBottom:5}}>🍷 종합 예상 시음노트</div>
                      <div style={{fontSize:13,color:"#333",lineHeight:1.7}}>{insights.predictedPalate}</div>
                    </div>
                  )}
                  {insights.winemakingImpact && (
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4,textTransform:"uppercase"}}>⚗️ 양조가 향·맛에 미치는 영향</div>
                      <div style={{fontSize:13,color:"#555",lineHeight:1.7}}>{insights.winemakingImpact}</div>
                    </div>
                  )}
                  {insights.producerStory && (
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4,textTransform:"uppercase"}}>🏛 생산자 이야기</div>
                      <div style={{fontSize:13,color:"#555",lineHeight:1.7}}>{insights.producerStory}</div>
                    </div>
                  )}
                  {/* Vintage character */}
                  {insights.vintageCharacter && (
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4,textTransform:"uppercase"}}>📅 빈티지 특성</div>
                      <div style={{fontSize:12,color:"#555",lineHeight:1.6}}>{insights.vintageCharacter}</div>
                    </div>
                  )}
                  {/* Practical info */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                    {insights.peakWindow && <div style={{background:"#FBF4E4",borderRadius:8,padding:"8px 10px"}}>
                      <div style={{fontSize:10,color:"#aaa",marginBottom:2}}>📅 최적 음용</div>
                      <div style={{fontSize:12,fontWeight:600,color:GOLD}}>{insights.peakWindow}</div>
                    </div>}
                    {insights.decanting && <div style={{background:"#F0FFF4",borderRadius:8,padding:"8px 10px"}}>
                      <div style={{fontSize:10,color:"#aaa",marginBottom:2}}>⏱ 디캔팅</div>
                      <div style={{fontSize:12,fontWeight:600}}>{insights.decanting}</div>
                    </div>}
                    {insights.servingTemp && <div style={{background:"#F0F7FF",borderRadius:8,padding:"8px 10px"}}>
                      <div style={{fontSize:10,color:"#aaa",marginBottom:2}}>🌡 서빙 온도</div>
                      <div style={{fontSize:12,fontWeight:600}}>{insights.servingTemp}</div>
                    </div>}
                    {insights.rarityNote && <div style={{background:"#f5f2ee",borderRadius:8,padding:"8px 10px"}}>
                      <div style={{fontSize:10,color:"#aaa",marginBottom:2}}>💎 희소성</div>
                      <div style={{fontSize:12}}>{insights.rarityNote}</div>
                    </div>}
                  </div>
                  {/* Food pairing */}
                  {insights.foodPairing?.length > 0 && (
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:5,textTransform:"uppercase"}}>🍽 음식 페어링</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {insights.foodPairing.map(f=><span key={f} style={{fontSize:12,background:"#f5f2ee",borderRadius:20,padding:"3px 10px"}}>{f}</span>)}
                      </div>
                    </div>
                  )}
                  {/* Fun fact */}
                  {insights.stories?.length > 0 && (
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:6,textTransform:"uppercase"}}>📚 알아두면 좋은 이야기</div>
                      {insights.stories.filter(s=>s&&s.content).map((s,i)=>(
                        <div key={i} style={{marginBottom:8,paddingLeft:10,borderLeft:`2px solid ${GOLD}40`}}>
                          {s.title && <div style={{fontSize:12,fontWeight:700,color:GOLD,marginBottom:2}}>{s.title}</div>}
                          <div style={{fontSize:12,color:"#666",lineHeight:1.6}}>{s.content}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {insights.funFact && <div style={{fontSize:12,color:"#888",fontStyle:"italic",marginBottom:6}}>💬 {insights.funFact}</div>}
                </div>
            </div>
            )}

            {/* ── My Tasting Notes ── */}
            {subtab==="taste" && notes.length > 0 && (
              <div style={CS}>
                <SH>📝 시음노트 ({notes.length})</SH>
                {[...new Set(notes.map(n=>n.taster).filter(Boolean))].length > 1 && (
                  <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                    {[...new Set(notes.map(n=>n.taster).filter(Boolean))].map(t=>(
                      <span key={t} style={{fontSize:11,background:t===tasters[0]?"#FDF1F2":"#E8F5E9",color:t===tasters[0]?RED:"#2E7D32",borderRadius:20,padding:"3px 10px",fontWeight:600}}>
                        {t} ({notes.filter(n2=>n2.taster===t).length})
                      </span>
                    ))}
                  </div>
                )}
                {(()=>{
                  // 작성자별 최신(지표 있는) 노트로 레이더 구성
                  const byTaster = {};
                  notes.filter(noteHasRadar).forEach(n=>{ const t=n.taster||"기록"; if(!byTaster[t]||(n.createdAt||n.date||"")>(byTaster[t].createdAt||byTaster[t].date||"")) byTaster[t]=n; });
                  const ents = Object.entries(byTaster).map(([t,n])=>({label:t,color:t===tasters[1]?"#2E7D32":RED,values:noteRadarValues(n)}));
                  return ents.length>0 ? (<div style={{margin:"4px 0 14px"}}><TasteRadar entries={ents}/></div>) : null;
                })()}
                {notes.map(n => (
                  <div key={n.id} style={{padding:"10px 0",borderBottom:"1px solid #f7f4f0"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:3}}>
                          {n.taster&&<span style={{fontSize:10,background:n.taster===tasters[0]?"#FDF1F2":"#E8F5E9",color:n.taster===tasters[0]?RED:"#2E7D32",borderRadius:10,padding:"1px 6px",fontWeight:700}}>{n.taster}</span>}
                          <span style={{fontSize:11,color:"#aaa"}}>{n.date||""}</span>
                        </div>
                        {n.overallImpression&&<div style={{fontSize:13,color:"#444",lineHeight:1.5}}>{n.overallImpression}</div>}
                        {n.freeText&&!n.overallImpression&&<div style={{fontSize:12,color:"#666",lineHeight:1.5}}>{n.freeText.slice(0,120)}{n.freeText.length>120?"…":""}</div>}
                      </div>
                      {n.rating&&<div style={{fontSize:20,fontWeight:700,color:GOLD,marginLeft:12,flexShrink:0}}>{n.rating}<span style={{fontSize:10,color:"#ccc"}}>/100</span></div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Label Photo ── */}
            {subtab==="detail" && (<div style={CS}><SH>📷 라벨 사진</SH><LabelPhoto photo={wine.labelPhoto} photoId={wine.labelPhotoId} onUpload={id=>onUpdate({labelPhotoId:id,labelPhoto:""})}/></div>)}

            {/* ── Recommendations ── */}
            {subtab==="tips" && reco && reco.items && reco.items.length>0 && (
            <div style={CS}>
              <SH>🍷 내 셀러의 비슷한 와인</SH>
                <div>
                    {reco.items.map((it,i)=>{
                      const w = wines.find(x=>x.id===it.id);
                      if(!w) return null;
                      return (
                        <div key={i} onClick={()=>onOpenWine&&onOpenWine(w)}
                          style={{background:"#FBF8F4",borderRadius:8,padding:"10px 12px",marginBottom:6,cursor:"pointer",border:"1px solid #f0e8de"}}>
                          <div style={{fontSize:13,fontWeight:700,color:"#333",marginBottom:2}}>
                            {cleanName(w.nameKR||w.nameEN,w.vintage)}{w.vintage?<span style={{color:GOLD,fontWeight:600}}> {w.vintage}</span>:null}
                          </div>
                          <div style={{fontSize:11,color:"#888",marginBottom:4}}>{[w.region,w.country].filter(Boolean).join(", ")}</div>
                          <div style={{fontSize:11,color:"#666",lineHeight:1.4}}>💡 {it.whySimilar}</div>
                        </div>
                      );
                    })}
                </div>
            </div>
            )}

            {/* ── Purchase ── */}
            {subtab==="detail" && wine.type==="cellar"&&(wine.purchaseDate||wine.purchasePrice||wine.location) && (
              <div style={CS}>
                <SH>🛒 구매 정보</SH>
                <DR label="구매일" val={wine.purchaseDate}/><DR label="구매처" val={wine.shop}/>
                <DR label="구매가" val={wine.purchasePrice?`₩${Number(wine.purchasePrice).toLocaleString()}`:""}/><DR label="수량" val={wine.quantity}/>
                <DR label="보관위치" val={wine.location}/>
                {wine.purchasePrice&&wine.marketPrice && (<DR label="ROI" val={`${(((Number(wine.marketPrice)-Number(wine.purchasePrice))/Number(wine.purchasePrice))*100).toFixed(1)}%`}/>)}
              </div>
            )}

            {/* ── Actions ── */}
            <div style={{display:"flex",gap:10,marginBottom:10}}>
              {!isConsumed && (<button onClick={()=>onUpdate({status:"Consumed"})} style={{flex:1,padding:"10px",background:"#FEF3C7",color:"#92400E",border:"1px solid #FCD34D",borderRadius:8,fontWeight:600,fontSize:13,cursor:"pointer"}}>🍷 마셨어요</button>)}
              {isConsumed && (<button onClick={()=>onUpdate({status:"In Stock"})} style={{flex:1,padding:"10px",background:"#f5f2ee",color:"#888",border:"1px solid #ddd",borderRadius:8,fontWeight:600,fontSize:13,cursor:"pointer"}}>↩ 셀러로 되돌리기</button>)}
              <PB onClick={onTaste} xs={{flex:1}}>📝 시음노트 추가</PB>
            </div>
            {wine.type==="wishlist" && (<PB onClick={()=>onUpdate({type:"cellar",status:"In Stock"})} full>셀러로 이동 →</PB>)}
          </div>
        ) : (
          <div>
            <div style={CS}>
              <SH>정보 수정</SH>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <FF label="한국어 이름" value={form.nameKR} onChange={upF("nameKR")}/><FF label="영문 이름" value={form.nameEN} onChange={upF("nameEN")}/>
                <FF label="빈티지" value={form.vintage} onChange={upF("vintage")}/><FF label="생산자" value={form.producer} onChange={upF("producer")}/>
                <FF label="음용 From" value={form.drinkFrom} onChange={upF("drinkFrom")}/><FF label="음용 Until" value={form.drinkUntil} onChange={upF("drinkUntil")}/>
                {wine.type==="cellar" && (<>
                  <FF label="구매가" value={form.purchasePrice} onChange={upF("purchasePrice")} type="number"/>
                  <FF label="시장가" value={form.marketPrice} onChange={upF("marketPrice")} type="number"/>
                  <FF label="보관위치" value={form.location} onChange={upF("location")}/>
                  <FF label="수량" value={form.quantity} onChange={upF("quantity")} type="number"/>
                </>)}
              </div>
            </div>
            <div style={CS}>
              <SH>전문가 평점 수정</SH>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {CRITICS.map(c => (
                  <div key={c.k}>
                    <div style={{fontSize:11,fontWeight:700,color:c.burg?GOLD:"#888",letterSpacing:.5,marginBottom:4,textTransform:"uppercase"}}>{c.ab}{c.burg?" ★":""}</div>
                    <input value={(form.expertRatings||{})[c.k]||""} onChange={upR(c.k)} placeholder={`/${c.max}`} style={IS}/>
                  </div>
                ))}
              </div>
            </div>
            <FF label="설명" value={form.description} onChange={upF("description")} rows={3}/>
            <PB onClick={()=>{onUpdate(form);se(false);}} full>💾 저장</PB>
          </div>
        )}
      </Pg>
    </div>
  );
}

// ── Add Tasting Page ──────────────────────────────────────────────
// ── WSET 시음 지표 아이콘 피커 ──
function TScale({ label, opts, value, onChange }) {
  return (
    <div style={{marginBottom:13}}>
      <div style={{fontSize:12,fontWeight:600,color:"#555",marginBottom:5}}>{label}</div>
      <div style={{display:"flex",gap:4}}>
        {opts.map((o,i)=>{ const on=value===o; return (
          <button key={o} onClick={()=>onChange(on?"":o)} style={{flex:1,padding:"6px 1px",borderRadius:7,cursor:"pointer",border:`1px solid ${on?RED:"#ddd"}`,background:on?RED:"#fff",color:on?"#fff":"#888",fontWeight:on?700:400,lineHeight:1.3}}>
            <div style={{fontSize:13}}>{i+1}</div><div style={{fontSize:9}}>{o}</div>
          </button> ); })}
      </div>
    </div>
  );
}
function TChips({ label, opts, value, onChange }) {
  return (
    <div style={{marginBottom:13}}>
      <div style={{fontSize:12,fontWeight:600,color:"#555",marginBottom:5}}>{label}</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
        {opts.map(o=>{ const on=value===o; return (
          <button key={o} onClick={()=>onChange(on?"":o)} style={{padding:"5px 11px",fontSize:12,borderRadius:20,cursor:"pointer",border:`1px solid ${on?RED:"#ddd"}`,background:on?"#FDF1F2":"#fff",color:on?RED:"#666",fontWeight:on?600:400}}>{o}</button>
        ); })}
      </div>
    </div>
  );
}
function TAroma({ label, groups, value, onChange }) {
  const sel = value||[];
  const toggle = chip => onChange(sel.includes(chip)?sel.filter(x=>x!==chip):[...sel,chip]);
  return (
    <div style={{marginBottom:13}}>
      <div style={{fontSize:12,fontWeight:600,color:"#555",marginBottom:6}}>{label}{sel.length>0&&<span style={{color:RED}}> ({sel.length})</span>}</div>
      {groups.map(([cat,items])=>(
        <div key={cat} style={{marginBottom:7}}>
          <div style={{fontSize:10,color:"#bbb",marginBottom:3}}>{cat}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {items.map(([emoji,name],i)=>{ const chip=`${emoji} ${name}`; const on=sel.includes(chip); return (
              <button key={name+i} onClick={()=>toggle(chip)} style={{padding:"4px 8px",fontSize:11,borderRadius:16,cursor:"pointer",border:`1px solid ${on?RED:"#e8e8e8"}`,background:on?"#FDF1F2":"#fff",color:on?RED:"#555",fontWeight:on?600:400}}>{emoji} {name}</button>
            ); })}
          </div>
        </div>
      ))}
    </div>
  );
}
function WSETPicker({ wset, setWset, wineType }) {
  const up = (k,v)=> setWset(p=>({...p,[k]:v}));
  const colorOpts = T_COLOR[wineType]||T_COLOR.Red;
  return (
    <div>
      <TChips label="🎨 색 (Color)" opts={colorOpts} value={wset.color} onChange={v=>up("color",v)}/>
      <TScale label="👃 향 강도 (Intensity)" opts={T_SCALE.noseIntensity} value={wset.noseIntensity} onChange={v=>up("noseIntensity",v)}/>
      <TAroma label="🌸 향 (Aromas)" groups={T_AROMA} value={wset._aromas} onChange={v=>up("_aromas",v)}/>
      <TChips label="🍬 당도 (Sweetness)" opts={T_SWEET} value={wset.sweetness} onChange={v=>up("sweetness",v)}/>
      <TScale label="🍋 산도 (Acidity)" opts={T_SCALE.acidity} value={wset.acidity} onChange={v=>up("acidity",v)}/>
      <TScale label="🍷 타닌 (Tannin)" opts={T_SCALE.tannin} value={wset.tannin} onChange={v=>up("tannin",v)}/>
      <TChips label="🥃 알코올 (Alcohol)" opts={T_ALC} value={wset.alcohol} onChange={v=>up("alcohol",v)}/>
      <TScale label="💪 바디 (Body)" opts={T_SCALE.body} value={wset.body} onChange={v=>up("body",v)}/>
      <TAroma label="👅 풍미·질감 (Flavors)" groups={T_FLAVOR} value={wset._flavors} onChange={v=>up("_flavors",v)}/>
      <TScale label="⏱ 피니쉬 (Finish)" opts={T_SCALE.finish} value={wset.finish} onChange={v=>up("finish",v)}/>
    </div>
  );
}
// wset 상태 → 노트 필드로 변환
function wsetToFields(w){
  if(!w) return {};
  return {
    ...(w.color?{color:w.color}:{}),
    ...(w.noseIntensity?{noseIntensity:w.noseIntensity}:{}),
    ...(w._aromas?.length?{noseAromas:w._aromas.join(", ")}:{}),
    ...(w.sweetness?{sweetness:w.sweetness}:{}),
    ...(w.acidity?{acidity:w.acidity}:{}),
    ...(w.tannin?{tannin:w.tannin}:{}),
    ...(w.alcohol?{alcohol:w.alcohol}:{}),
    ...(w.body?{body:w.body}:{}),
    ...(w._flavors?.length?{flavors:w._flavors.join(", ")}:{}),
    ...(w.finish?{finish:w.finish}:{}),
  };
}

function AddTastingPage({ wine, wines, onSave, onBack, tasters=["나","아내"], editNote=null }) {
  const E = editNote||{};
  const [mode, sm] = useState(editNote ? (E.wineId?"cellar":"external") : "cellar");
  const [sel, ss] = useState(editNote ? (E.wineId?wines.find(w=>w.id===E.wineId):null) : wine);
  const [wset, setWset] = useState(E._wset||{});
  const [showWset, setShowWset] = useState(!!E._wset);
  const [en, sn] = useState(E.wineId?"":(E.wineName||"")), [ev, sev] = useState(E.vintage||""), [correcting, sc] = useState(false), [corrected, scr] = useState(null);
  const [txt, st] = useState(E.freeText||""), [structured, ssr] = useState(null), [loading, sl] = useState(false);
  const [myScore, setMyScore] = useState(E.rating||"");
  const [myRepurchase, setMyRepurchase] = useState(E.repurchase||"");
  const [taster, setTaster] = useState(E.taster||tasters[0]||"나");
  const [selQuery, setSelQuery] = useState("");      // 와인 검색어
  const [strDone, setStrDone] = useState(false);     // AI 정리 완료 표시
  const [cmpDone, setCmpDone] = useState(false);     // 비교 완료 표시
  const [showCompare, setShowCompare] = useState(false); // 비교 섹션 펼침
  const [notePhotoId, setNotePhotoId] = useState(E.notePhotoId||""); // 시음 순간 사진
  const [sessionSaved, setSessionSaved] = useState(false); // 이 시음에서 이미 1병 차감했는지
  const [justSaved, setJustSaved] = useState("");           // 방금 저장된 작성자(확인 메시지)
  const [editActive, setEditActive] = useState(!!editNote); // 현재 저장이 기존 노트 수정인지(이어쓰기 넘어가면 해제)
  const [meta, sm2] = useState({date:E.date||new Date().toISOString().split("T")[0],location:E.location||"",withWhom:E.withWhom||"",foodPairing:E.foodPairing||"",decanting:E.decanting||""});
  const um = k => e => sm2(p=>({...p,[k]:e.target.value}));
  const wName = mode==="cellar" ? (sel?.nameKR||sel?.nameEN||"") : ((corrected?.nameKR||corrected?.nameEN)||en);
  const wVin = mode==="cellar" ? (sel?.vintage||"") : (corrected?.vintage||ev);
  const canSave = mode==="cellar" ? !!sel : !!en;
  async function doCorrect() { sc(true); try{scr(await correctWine(en,ev));}catch(e){} sc(false); }
  async function doStr() {
    sl(true); setStrDone(false);
    try{
      const s = await structNote(txt, wName);
      ssr(s);
      const toChips = (names, groups) => (names||[]).map(n=>_chipByName(n,groups)).filter(Boolean);
      setWset(p=>({
        ...p,
        ...(s.color?{color:s.color}:{}),
        ...(s.noseIntensity?{noseIntensity:s.noseIntensity}:{}),
        ...(s.sweetness?{sweetness:s.sweetness}:{}),
        ...(s.acidity?{acidity:s.acidity}:{}),
        ...(s.tannin?{tannin:s.tannin}:{}),
        ...(s.alcohol?{alcohol:s.alcohol}:{}),
        ...(s.body?{body:s.body}:{}),
        ...(s.finish?{finish:s.finish}:{}),
        ...(s.aromas?.length?{_aromas:toChips(s.aromas,T_AROMA)}:{}),
        ...(s.flavors?.length?{_flavors:toChips(s.flavors,T_FLAVOR)}:{}),
      }));
      setShowWset(true); setStrDone(true);
    }catch(e){}
    sl(false);
  }
  const [compare, setCompare] = useState(null);
  const [comparing, setComparing] = useState(false);
  async function doCompare(){
    setComparing(true); setCmpDone(false); setShowCompare(true);
    try{
      const refWine = mode==="cellar" ? sel : {nameKR:en, nameEN:en, vintage:ev, ...(corrected||{})};
      setCompare(await compareNote(txt, refWine)); setCmpDone(true);
    }catch(e){}
    setComparing(false);
  }
  // 라벨 스캔 (직접입력 모드)
  const scanRef = useRef(null);
  function buildNote(){
    return {
      ...(editActive?{id:editNote.id, createdAt:editNote.createdAt}:{}),
      wineId:mode==="cellar"?sel?.id:null,
      wineName:cleanName(wName,wVin),
      vintage:wVin,
      taster: taster||tasters[0]||"나",
      ...meta,
      freeText:txt,
      ...(notePhotoId?{notePhotoId}:{}),
      ...(structured||{}),
      ...wsetToFields(wset),
      _wset: wset,
      ...(myScore?{rating:myScore}:{}),
      ...(myRepurchase?{repurchase:myRepurchase}:{}),
    };
  }
  function doSave(){ if(!canSave)return; onSave(buildNote(), {skipQty:sessionSaved}); }
  // 저장하고 다른 작성자 노트 이어쓰기 (시음정보·와인 유지, 메모·지표·평가만 초기화)
  function doSaveContinue(){
    if(!canSave)return;
    const cur = taster||tasters[0]||"나";
    onSave(buildNote(), {stay:true, skipQty:sessionSaved}); // 첫 저장만 수량 차감
    setSessionSaved(true);
    setEditActive(false); // 다음 사람부터는 새 노트로 추가
    setJustSaved(cur);
    // 다음 작성자로 전환
    const others = tasters.filter(Boolean).filter(t=>t!==cur);
    if(others.length) setTaster(others[0]);
    // 입력 초기화 (와인·시음정보·사진은 유지)
    st(""); ssr(null); setWset({}); setShowWset(false); setStrDone(false);
    setMyScore(""); setMyRepurchase(""); setCompare(null); setCmpDone(false); setShowCompare(false);
    if(typeof window!=="undefined") window.scrollTo({top:0,behavior:"smooth"});
  }
  const [scanning2, setScanning2] = useState(false);
  const [scanErr2, setScanErr2] = useState("");
  async function onScanTaste(e){
    const f=e.target.files?.[0]; if(!f) return;
    setScanErr2(""); setScanning2(true);
    try{
      const dataUrl=await compressImage(f);
      const res=await scanLabel(dataUrl);
      const nm=res.nameEN||res.producer;
      if(!nm){ setScanErr2("라벨에서 와인명을 못 읽었어요. 직접 입력해주세요."); setScanning2(false); if(scanRef.current)scanRef.current.value=""; return; }
      sn(nm); if(res.vintage) sev(String(res.vintage));
      scr(await correctWine(nm, res.vintage?String(res.vintage):""));
    }catch(err){ const m=String(err.message||err); setScanErr2(m.includes("429")?"AI 한도 초과 — 잠시 후 다시 시도하세요":"스캔 실패: "+m); }
    setScanning2(false); if(scanRef.current)scanRef.current.value="";
  }
  return (
    <div style={{minHeight:"100vh",background:"#F7F4F0",fontFamily:"system-ui,sans-serif"}}>
      <TopBar title={editNote?"📝 시음노트 수정":"📝 시음노트 작성"} onBack={onBack}/>
      <Pg>
        <div style={CS}>
          <SH>와인 선택</SH>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            {[["cellar","🍾 내 셀러에서"],["external","✍️ 직접 입력 (레스토랑·지인 등)"]].map(([k,l]) => (
              <button key={k} onClick={()=>sm(k)} style={{flex:1,padding:"9px",border:`1px solid ${mode===k?RED:"#ddd"}`,borderRadius:8,fontSize:12,fontWeight:mode===k?600:400,background:mode===k?"#FDF1F2":"#fff",color:mode===k?RED:"#666",cursor:"pointer"}}>{l}</button>
            ))}
          </div>
          {mode==="cellar" ? (
            <div>
              {sel ? (
                <div style={{padding:"10px 12px",background:"#f9f7f5",borderRadius:8,display:"flex",gap:10,alignItems:"center"}}>
                  <WineImg photo={sel.labelPhoto} photoId={sel.labelPhotoId} style={{width:36,height:50,objectFit:"cover",borderRadius:4}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13}}>{cleanName(sel.nameKR||sel.nameEN,sel.vintage)}</div>
                    <div style={{fontSize:12,color:"#888"}}>{sel.vintage}{sel.region?` · ${sel.region}`:""}</div>
                  </div>
                  <button onClick={()=>{ss(null);setSelQuery("");}} style={{background:"none",border:"1px solid #ddd",borderRadius:6,padding:"5px 10px",fontSize:12,color:"#888",cursor:"pointer"}}>변경</button>
                </div>
              ) : (
                <div>
                  <input value={selQuery} onChange={e=>setSelQuery(e.target.value)} placeholder="🔍 와인 이름·생산자·지역 검색"
                    style={{...IS,marginBottom:8}}/>
                  <div style={{maxHeight:260,overflowY:"auto",border:"1px solid #f0ece6",borderRadius:8}}>
                    {(()=>{
                      const q=selQuery.trim().toLowerCase();
                      const list=wines.filter(w=>{
                        if(!q) return true;
                        return [w.nameKR,w.nameEN,w.producer,w.region,w.country].filter(Boolean).join(" ").toLowerCase().includes(q);
                      }).slice(0,50);
                      if(list.length===0) return <div style={{padding:"16px",textAlign:"center",fontSize:12,color:"#aaa"}}>검색 결과가 없습니다</div>;
                      return list.map(w=>(
                        <div key={w.id} onClick={()=>{ss(w);setSelQuery("");}}
                          style={{display:"flex",gap:10,alignItems:"center",padding:"9px 12px",borderBottom:"1px solid #f5f2ee",cursor:"pointer"}}>
                          <WineImg photo={w.labelPhoto} photoId={w.labelPhotoId} style={{width:28,height:38,objectFit:"cover",borderRadius:3,flexShrink:0}}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:600,color:"#333"}}>{cleanName(w.nameKR||w.nameEN,w.vintage)}{w.vintage?` ${w.vintage}`:""}</div>
                            <div style={{fontSize:11,color:"#999"}}>{[w.producer,w.region].filter(Boolean).join(" · ")}</div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <input ref={scanRef} type="file" accept="image/*" onChange={onScanTaste} style={{display:"none"}}/>
              <button onClick={()=>scanRef.current?.click()} disabled={scanning2} style={{width:"100%",padding:"9px",background:scanning2?"#eee":"#FBF4E4",color:GOLD,border:`1px solid ${GOLD}40`,borderRadius:8,fontSize:13,fontWeight:600,cursor:scanning2?"default":"pointer",marginBottom:10}}>
                {scanning2?"📸 라벨 읽는 중...":"📸 라벨 사진으로 자동 입력"}
              </button>
              {scanErr2 && <div style={{fontSize:11,color:"#991B1B",marginBottom:8}}>{scanErr2}</div>}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:8}}>
                <FF label="와인 이름 *" value={en} onChange={e=>sn(e.target.value)} placeholder="예: Gevrey-Chambertin"/>
                <FF label="빈티지" value={ev} onChange={e=>sev(e.target.value)} placeholder="예: 2020"/>
              </div>
              <button onClick={doCorrect} disabled={correcting||!en.trim()} style={{width:"100%",padding:"9px",background:"#F0F7FF",color:"#1D4ED8",border:"1px solid #BFDBFE",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:corrected?10:0,opacity:!en.trim()?0.5:1}}>
                {correcting?"🤖 AI 보정 중...":"🤖 AI로 와인명 보정"}
              </button>
              {corrected && (
                <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:8,padding:"10px 12px"}}>
                  <div style={{fontWeight:600,color:"#065F46",fontSize:13}}>{corrected.nameKR}</div>
                  <div style={{fontSize:12,color:"#888",marginTop:2}}>{corrected.nameEN} {corrected.vintage} · {corrected.region}</div>
                </div>
              )}
            </div>
          )}
        </div>
        <div style={CS}>
          <SH>시음 정보</SH>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FF label="날짜" value={meta.date} onChange={um("date")} type="date"/>
            <FF label="장소" value={meta.location} onChange={um("location")} placeholder="집, 레스토랑 등"/>
            <FF label="함께한 사람" value={meta.withWhom} onChange={um("withWhom")}/>
            <FF label="페어링 음식" value={meta.foodPairing} onChange={um("foodPairing")}/>
          </div>
          <FF label="디캔팅" value={meta.decanting} onChange={um("decanting")} placeholder="예: 1시간, 없음"/>
          <div style={{marginTop:6}}>
            <div style={{fontSize:11,fontWeight:600,color:"#888",letterSpacing:.5,marginBottom:6,textTransform:"uppercase"}}>📷 시음 사진 (잔·음식 등, 선택)</div>
            <LabelPhoto photoId={notePhotoId} onUpload={id=>setNotePhotoId(id)}/>
          </div>
        </div>
        {/* Taster selector */}
        {tasters.length > 1 && (
          <div style={{...CS,paddingBottom:12}}>
            <SH>👤 작성자</SH>
            <div style={{display:"flex",gap:8}}>
              {tasters.filter(Boolean).map(t=>(
                <button key={t} onClick={()=>setTaster(t)}
                  style={{flex:1,padding:"9px",border:`1px solid ${taster===t?RED:"#ddd"}`,borderRadius:8,fontSize:13,fontWeight:taster===t?700:400,background:taster===t?"#FDF1F2":"#fff",color:taster===t?RED:"#555",cursor:"pointer"}}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* 1. 시음 메모 → AI 정리 */}
        <div style={CS}>
          <SH>시음 메모 (자유 작성)</SH>
          <textarea value={txt} onChange={e=>{st(e.target.value);setStrDone(false);}} rows={6}
            placeholder={"느낌을 자유롭게 적어주세요.\n\n예: 진한 루비색, 블랙베리와 삼나무 향, 타닌 실키하고 피니쉬 길다..."}
            style={{...IS,resize:"vertical",lineHeight:1.6}}/>
          <button onClick={doStr} disabled={loading||!txt.trim()||!canSave} style={{marginTop:10,width:"100%",background:strDone?"#F0FDF4":"#F5F0FF",color:strDone?"#2E7D32":"#7B4FBF",border:`1px solid ${strDone?"#BBF7D0":"#D4B8F0"}`,borderRadius:8,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer",opacity:(!txt.trim()||!canSave)?0.5:1}}>
            {loading?"🤖 정리 중...":strDone?"✓ 정리 완료 — 다시 정리하려면 탭":"🤖 AI로 시음 노트 정리 (지표 자동 입력)"}
          </button>
          {!canSave && <div style={{fontSize:11,color:"#aaa",marginTop:6,textAlign:"center"}}>먼저 위에서 와인을 선택/입력하세요</div>}
        </div>

        {/* 2. AI 정리 결과 (메모 바로 아래) */}
        {structured && (
          <div style={{...CS,border:`1px solid ${GOLD}40`}}>
            <SH>✨ AI 정리 결과</SH>
            <div style={{fontSize:12,color:"#2E7D32",marginBottom:10}}>✓ 색·향·맛 지표가 아래 WSET에 자동 입력되었습니다 (수정 가능)</div>
            {structured.overallImpression && (<div style={{marginBottom:10}}><div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4,textTransform:"uppercase"}}>총평</div><div style={{fontSize:13,lineHeight:1.7}}>{structured.overallImpression}</div></div>)}
            <div style={{display:"flex",gap:12,alignItems:"center",marginTop:8}}>
              {structured.rating && (<div style={{fontSize:28,fontWeight:700,color:GOLD}}>{structured.rating}<span style={{fontSize:12,color:"#ccc"}}>/100</span></div>)}
              {structured.repurchase && (<span style={{fontSize:12,padding:"4px 12px",borderRadius:20,background:"#D1FAE5",color:"#065F46"}}>재구매: {structured.repurchase}</span>)}
            </div>
          </div>
        )}

        {/* 3. 시음 지표 WSET */}
        <div style={CS}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>setShowWset(s=>!s)}>
            <SH style={{marginBottom:0}}>🎯 시음 지표 (WSET)</SH>
            <span style={{fontSize:18,color:GOLD}}>{showWset?"−":"+"}</span>
          </div>
          {showWset ? (
            <div style={{marginTop:14}}>
              <WSETPicker wset={wset} setWset={setWset} wineType={mode==="cellar"?(sel?.wineType):(corrected?.wineType)}/>
            </div>
          ) : (
            <div style={{fontSize:12,color:"#aaa",marginTop:6}}>색·향·당도·산도·타닌·바디 등을 아이콘으로 기록 (선택)</div>
          )}
        </div>

        {/* 4. 평가 */}
        <div style={CS}>
          <SH>평가</SH>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:"#888",letterSpacing:.5,marginBottom:6,textTransform:"uppercase"}}>내 점수 (0–100)</div>
              <input type="number" min="0" max="100" value={myScore} onChange={e=>setMyScore(e.target.value)}
                placeholder="예: 93" style={IS}/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:"#888",letterSpacing:.5,marginBottom:6,textTransform:"uppercase"}}>재구매 의향</div>
              <div style={{display:"flex",gap:6}}>
                {["예","보통","아니오"].map(v=>(
                  <button key={v} onClick={()=>setMyRepurchase(v===myRepurchase?"":v)}
                    style={{flex:1,padding:"8px 4px",border:`1px solid ${myRepurchase===v?RED:"#ddd"}`,borderRadius:6,fontSize:12,fontWeight:myRepurchase===v?600:400,background:myRepurchase===v?RED:"#fff",color:myRepurchase===v?"#fff":"#666",cursor:"pointer"}}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 5. 전문가 비교 (보조 기능, 접이식) */}
        <div style={CS}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>setShowCompare(s=>!s)}>
            <SH style={{marginBottom:0}}>🔍 전문가와 비교 (선택)</SH>
            <span style={{fontSize:18,color:"#C2410C"}}>{showCompare?"−":"+"}</span>
          </div>
          {showCompare && (
            <div style={{marginTop:12}}>
              <button onClick={doCompare} disabled={comparing||!txt.trim()||!canSave} style={{width:"100%",background:cmpDone?"#F0FDF4":"#FFF7ED",color:cmpDone?"#2E7D32":"#C2410C",border:`1px solid ${cmpDone?"#BBF7D0":"#FED7AA"}`,borderRadius:8,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer",opacity:(!txt.trim()||!canSave)?0.5:1}}>
                {comparing?"🔍 비교 분석 중...":cmpDone?"✓ 비교 완료 — 다시 분석하려면 탭":"내 메모를 전문가·공식 노트와 비교 분석"}
              </button>
              {compare && (
                <div style={{marginTop:12}}>
                  {!compare.hasReference && <div style={{fontSize:11,color:"#C2410C",background:"#FFF7ED",borderRadius:6,padding:"6px 10px",marginBottom:10}}>※ 저장된 전문가/공식 노트가 없어 품종·산지의 전형적 프로파일과 비교했습니다.</div>}
                  {compare.summary && <div style={{fontSize:13,color:"#333",lineHeight:1.7,marginBottom:12}}>{compare.summary}</div>}
                  {compare.agreements?.length>0 && (
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#2E7D32",marginBottom:5}}>✓ 일치한 점</div>
                      {compare.agreements.map((a,i)=>(<div key={i} style={{fontSize:12,color:"#555",lineHeight:1.6,marginBottom:2}}>· {a}</div>))}
                    </div>
                  )}
                  {compare.differences?.length>0 && (
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#C2410C",marginBottom:6}}>⚖ 다르게 느낀 점</div>
                      {compare.differences.filter(d=>d&&(d.aspect||d.why)).map((d,i)=>(
                        <div key={i} style={{background:"#FFFBF5",borderRadius:8,padding:"9px 11px",marginBottom:6,border:"1px solid #f5e8d8"}}>
                          {d.aspect && <div style={{fontSize:12,fontWeight:700,color:"#9A3412",marginBottom:3}}>{d.aspect}</div>}
                          <div style={{fontSize:12,color:"#555",lineHeight:1.6}}><b>나:</b> {d.mine} <br/><b>전문가/전형:</b> {d.reference}</div>
                          {d.why && <div style={{fontSize:12,color:"#777",lineHeight:1.6,marginTop:4}}>💡 {d.why}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  {compare.learningPoint && <div style={{fontSize:12,color:"#666",lineHeight:1.7,fontStyle:"italic",background:"#FFF7ED",borderRadius:8,padding:"10px 12px"}}>📖 {compare.learningPoint}</div>}
                </div>
              )}
            </div>
          )}
        </div>
        {justSaved && (
          <div style={{...CS,background:"#F0FDF4",border:"1px solid #BBF7D0",textAlign:"center"}}>
            <div style={{fontSize:13,color:"#065F46",fontWeight:600}}>✓ {justSaved}님의 노트가 저장되었습니다</div>
            <div style={{fontSize:11,color:"#16A34A",marginTop:3}}>이어서 <b>{taster}</b>님의 노트를 작성하세요 (와인·시음정보 유지됨)</div>
          </div>
        )}
        <PB onClick={doSave} disabled={!canSave} full>
          💾 {editActive?"시음노트 수정 저장":"시음노트 저장"}
        </PB>
        {tasters.filter(Boolean).length>1 && (
          <button onClick={doSaveContinue} disabled={!canSave}
            style={{width:"100%",marginTop:10,padding:"12px",background:"#fff",color:RED,border:`1px solid ${RED}`,borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",opacity:canSave?1:0.5}}>
            💾 {editActive?"수정 저장하고 다른 사람 노트 추가":"저장하고 다른 사람 노트 이어쓰기"}
          </button>
        )}
      </Pg>
    </div>
  );
}

// ── Note Detail Page ──────────────────────────────────────────────
// ── 시음 레이더 차트 (순수 SVG, 오각형) ──
function normScale(value, opts){ const i=(opts||[]).indexOf(value); return i<0?0:(i/(opts.length-1))*5; }
const RADAR_AXES = ["당도","산도","타닌","바디","피니쉬"];
function noteRadarValues(n){
  return [
    normScale(n.sweetness, T_SWEET),
    normScale(n.acidity, T_SCALE.acidity),
    normScale(n.tannin, T_SCALE.tannin),
    normScale(n.body, T_SCALE.body),
    normScale(n.finish, T_SCALE.finish),
  ];
}
function noteHasRadar(n){ return [n.sweetness,n.acidity,n.tannin,n.body,n.finish].filter(Boolean).length>=3; }
function TasteRadar({ entries }) {
  const cx=130, cy=125, R=80, N=5;
  const ang = i => (-90 + i*(360/N)) * Math.PI/180;
  const pt = (i, r) => [cx + r*Math.cos(ang(i)), cy + r*Math.sin(ang(i))];
  const rings = [1,2,3,4,5].map(k => RADAR_AXES.map((_,i)=>pt(i, R*k/5).join(",")).join(" "));
  return (
    <div>
      <svg viewBox="0 0 260 250" style={{width:"100%",maxWidth:300,display:"block",margin:"0 auto"}}>
        {rings.map((p,i)=>(<polygon key={i} points={p} fill={i===4?"#fafafa":"none"} stroke="#ececec" strokeWidth="1"/>))}
        {RADAR_AXES.map((ax,i)=>{ const [x,y]=pt(i,R); const [lx,ly]=pt(i,R+17); return (
          <g key={ax}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="#e8e8e8" strokeWidth="1"/>
            <text x={lx} y={ly} fontSize="11" fontWeight="600" fill="#777" textAnchor="middle" dominantBaseline="middle">{ax}</text>
          </g>
        );})}
        {entries.map((e,ei)=>{
          const poly = e.values.map((v,i)=>pt(i, R*Math.max(0,Math.min(5,v))/5).join(",")).join(" ");
          return <g key={ei}><polygon points={poly} fill={e.color+"22"} stroke={e.color} strokeWidth="2"/>
            {e.values.map((v,i)=>{const[x,y]=pt(i,R*Math.max(0,Math.min(5,v))/5);return <circle key={i} cx={x} cy={y} r="2.5" fill={e.color}/>;})}
          </g>;
        })}
      </svg>
      {entries.length>1 && (
        <div style={{display:"flex",justifyContent:"center",gap:14,marginTop:4}}>
          {entries.map((e,i)=>(<span key={i} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#666"}}><span style={{width:11,height:11,borderRadius:3,background:e.color,display:"inline-block"}}/>{e.label}</span>))}
        </div>
      )}
    </div>
  );
}

function NoteDetailPage({ note, wine, onBack, onDelete, onEdit }) {
  return (
    <div style={{minHeight:"100vh",background:"#F7F4F0",fontFamily:"system-ui,sans-serif"}}>
      <TopBar title={`${TICON[wine?.wineType]||"🍾"} ${cleanName(note.wineName,note.vintage)} ${note.vintage||""}`} onBack={onBack} right={
        <div style={{display:"flex",gap:6}}>
          {onEdit && <button onClick={onEdit} style={{background:"rgba(255,255,255,.18)",border:"none",borderRadius:6,color:"#fff",fontSize:12,padding:"5px 12px",cursor:"pointer"}}>수정</button>}
          <DeleteBtn onDelete={onDelete}/>
        </div>
      }/>
      <Pg>
        {note.rating && (
          <div style={{textAlign:"center",margin:"20px 0"}}>
            <div style={{fontSize:56,fontWeight:700,color:GOLD,lineHeight:1}}>{note.rating}</div>
            <div style={{fontSize:13,color:"#aaa",marginTop:4}}>/ 100점</div>
          </div>
        )}
        {note.notePhotoId && (
          <div style={CS}>
            <WineImg photoId={note.notePhotoId} style={{width:"100%",maxHeight:320,objectFit:"contain",borderRadius:8,background:"#f9f7f5"}}/>
          </div>
        )}
        <div style={CS}>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {[note.taster&&`👤 ${note.taster}`,note.date&&`📅 ${note.date}`,note.location&&`📍 ${note.location}`,note.withWhom&&`👥 ${note.withWhom}`,note.foodPairing&&`🍽 ${note.foodPairing}`,note.decanting&&`⏱ ${note.decanting}`].filter(Boolean).map(s => (
              <span key={s} style={{fontSize:13,background:"#f5f2ee",borderRadius:8,padding:"5px 12px",color:"#666"}}>{s}</span>
            ))}
          </div>
        </div>
        <div style={CS}>
          {note.color && (<div style={{marginBottom:12}}><div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4,textTransform:"uppercase"}}>외관</div><div style={{fontSize:14,lineHeight:1.7}}>{note.color}</div></div>)}
          {(note.noseIntensity||note.noseAromas) && (<div style={{marginBottom:12}}><div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:6,textTransform:"uppercase"}}>후각 {note.noseIntensity&&<span style={{color:GOLD}}>· 강도 {note.noseIntensity}</span>}</div>
            {note.noseAromas && <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{note.noseAromas.split(/,\s*/).filter(Boolean).map((a,i)=>(<span key={i} style={{fontSize:12,background:"#FBF8F4",border:"1px solid #f0e8de",borderRadius:16,padding:"3px 10px",color:"#555"}}>{a}</span>))}</div>}
          </div>)}
          {(note.sweetness||note.tannin||note.body||note.acidity||note.alcohol||note.finish||note.flavors) && (
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:8,textTransform:"uppercase"}}>미각</div>
              {noteHasRadar(note) && <div style={{marginBottom:14}}><TasteRadar entries={[{label:note.taster||"",color:RED,values:noteRadarValues(note)}]}/></div>}
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:note.flavors?8:0}}>
                {[["당도",note.sweetness],["산도",note.acidity],["타닌",note.tannin],["알코올",note.alcohol],["바디",note.body],["피니쉬",note.finish]].filter(([,vv])=>vv).map(([kk,vv]) => (
                  <span key={kk} style={{fontSize:13,background:"#f5f2ee",borderRadius:6,padding:"4px 12px"}}>{kk}: <b style={{color:RED}}>{vv}</b></span>
                ))}
              </div>
              {note.flavors && <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{note.flavors.split(/,\s*/).filter(Boolean).map((a,i)=>(<span key={i} style={{fontSize:12,background:"#FBF8F4",border:"1px solid #f0e8de",borderRadius:16,padding:"3px 10px",color:"#555"}}>{a}</span>))}</div>}
            </div>
          )}
          {note.overallImpression && (<div><div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4,textTransform:"uppercase"}}>총평</div><div style={{fontSize:14,lineHeight:1.7}}>{note.overallImpression}</div></div>)}
        </div>
        {note.freeText && (<div style={CS}><div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:6,textTransform:"uppercase"}}>원본 메모</div><div style={{fontSize:13,color:"#888",lineHeight:1.7,fontStyle:"italic"}}>{note.freeText}</div></div>)}
        {note.repurchase && (<div style={{textAlign:"center"}}><span style={{fontSize:13,padding:"7px 20px",borderRadius:20,background:"#D1FAE5",color:"#065F46"}}>재구매 의향: {note.repurchase}</span></div>)}
      </Pg>
    </div>
  );
}


// ── Stats Tab ─────────────────────────────────────────────────────
// ── 💑 Taste Comparison ───────────────────────────────────────────
function TasteComparison({ notes, wines, tasters=["나","아내"] }) {
  const num = v => { const x=parseFloat(String(v).replace(/[^\d.]/g,"")); return isNaN(x)?null:x; };
  const ratedNotes = t => notes.filter(n => n.taster===t && num(n.rating)!==null);

  const active = tasters.filter(t => notes.some(n => n.taster===t && num(n.rating)!==null));
  if (active.length < 2) {
    return (
      <div style={CS}>
        <SH>💑 취향 비교</SH>
        <div style={{fontSize:12,color:"#aaa",lineHeight:1.6}}>
          두 사람 이상이 점수를 매긴 시음노트가 쌓이면 여기서 취향을 비교해드려요.
          {active.length===1 && ` (현재 ${active[0]}님 기록만 있어요)`}
        </div>
      </div>
    );
  }

  const A = active[0], B = active[1];
  const colA = { bg:"#FDF1F2", c:RED }, colB = { bg:"#E8F5E9", c:"#2E7D32" };
  const wineById = Object.fromEntries(wines.map(w=>[w.id,w]));

  const allRaw = [A,B].flatMap(t => ratedNotes(t).map(n=>num(n.rating)));
  const maxR = allRaw.length ? Math.max(...allRaw) : 100;
  const scale = maxR<=5 ? 20 : maxR<=10 ? 10 : maxR<=20 ? 5 : 1;
  const norm = r => r==null ? null : r*scale;

  const stat = t => {
    const rs = ratedNotes(t).map(n=>num(n.rating));
    return { count: rs.length, avg: rs.length ? rs.reduce((a,b)=>a+b,0)/rs.length : null };
  };
  const sA = stat(A), sB = stat(B);

  const lastRating = (t, wineId) => {
    const list = notes.filter(n=>n.wineId===wineId && n.taster===t && num(n.rating)!==null)
      .sort((x,y)=>(y.createdAt||"").localeCompare(x.createdAt||""));
    return list.length ? num(list[0].rating) : null;
  };
  const sharedIds = [...new Set(notes.filter(n=>n.wineId).map(n=>n.wineId))]
    .filter(id => lastRating(A,id)!==null && lastRating(B,id)!==null);
  const shared = sharedIds.map(id => {
    const ra=lastRating(A,id), rb=lastRating(B,id), w=wineById[id];
    return { id, w, ra, rb, gapN: Math.abs(norm(ra)-norm(rb)) };
  }).filter(s=>s.w);

  let agreement = null;
  if (shared.length) {
    const avgGap = shared.reduce((a,s)=>a+s.gapN,0)/shared.length;
    agreement = Math.max(0, Math.round(100 - avgGap));
  }
  const split = [...shared].filter(s=>s.gapN>0).sort((a,b)=>b.gapN-a.gapN).slice(0,5);

  const prefBy = keyFn => {
    const map = {};
    [A,B].forEach(t => ratedNotes(t).forEach(n => {
      const w = wineById[n.wineId]; if(!w) return;
      const k = keyFn(w); if(!k) return;
      map[k] = map[k] || {};
      map[k][t] = map[k][t] || { sum:0, n:0 };
      map[k][t].sum += num(n.rating); map[k][t].n++;
    }));
    return map;
  };
  const primaryGrape = w => ((w?.grapeVariety||"").split(/[,/·&]| 및 /)[0].trim() || null);
  const rows = (map, limit) => Object.entries(map)
    .map(([k,v]) => ({ k, a:v[A], b:v[B], total:(v[A]?.n||0)+(v[B]?.n||0) }))
    .sort((x,y)=>y.total-x.total)
    .slice(0, limit||99);
  const grapeRows = rows(prefBy(primaryGrape), 6);
  const typeRows  = rows(prefBy(w=>w.wineType));

  const repRate = t => {
    const ns = notes.filter(n=>n.taster===t && n.repurchase);
    if(!ns.length) return null;
    return { pct: Math.round(ns.filter(n=>n.repurchase==="예").length/ns.length*100), n: ns.length };
  };
  const rpA = repRate(A), rpB = repRate(B);

  const CmpBar = ({ label, a, b }) => {
    const av = a&&a.n ? a.sum/a.n : null, bv = b&&b.n ? b.sum/b.n : null;
    const w = x => x==null ? 0 : Math.min(x*scale, 100);
    return (
      <div style={{marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
          <span style={{fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:150}}>{label}</span>
          <span style={{color:"#bbb",fontSize:10}}>
            {a?`${av.toFixed(0)}`:"–"} · {b?`${bv.toFixed(0)}`:"–"}
          </span>
        </div>
        <div style={{display:"flex",gap:3}}>
          <div style={{flex:1,background:"#f5f2ee",borderRadius:4,height:12,overflow:"hidden"}}>
            <div style={{width:`${w(av)}%`,height:"100%",background:colA.c,opacity:.75,borderRadius:4}}/>
          </div>
          <div style={{flex:1,background:"#f5f2ee",borderRadius:4,height:12,overflow:"hidden"}}>
            <div style={{width:`${w(bv)}%`,height:"100%",background:colB.c,opacity:.75,borderRadius:4}}/>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={CS}>
      <SH>💑 취향 비교</SH>

      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {[[A,sA,colA],[B,sB,colB]].map(([t,s,col])=>(
          <div key={t} style={{flex:1,background:col.bg,borderRadius:10,padding:"10px 12px"}}>
            <div style={{fontSize:12,fontWeight:700,color:col.c,marginBottom:4}}>{t}</div>
            <div style={{fontSize:20,fontWeight:700,color:col.c,lineHeight:1}}>{s.avg!=null?s.avg.toFixed(1):"–"}</div>
            <div style={{fontSize:10,color:"#999",marginTop:2}}>평균 · 노트 {s.count}개</div>
          </div>
        ))}
      </div>

      {agreement!=null && (
        <div style={{textAlign:"center",marginBottom:14,padding:"10px",background:"#FDF8F5",borderRadius:10}}>
          <div style={{fontSize:11,color:"#999",marginBottom:2}}>취향 일치도 · 함께 마신 {shared.length}병</div>
          <div style={{fontSize:26,fontWeight:800,color:GOLD,lineHeight:1}}>{agreement}%</div>
          <div style={{fontSize:11,color:"#aaa",marginTop:3}}>
            {agreement>=80?"환상의 궁합 🥂":agreement>=60?"꽤 잘 맞아요 😊":agreement>=40?"취향이 갈리는 편 🤔":"정반대 입맛 😄"}
          </div>
        </div>
      )}

      {split.length>0 && (
        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:"#666",marginBottom:8}}>⚡ 의견이 갈린 와인</div>
          {split.map(s=>(
            <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid #f7f4f0"}}>
              <div style={{flex:1,minWidth:0,fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cleanName(s.w.nameKR||s.w.nameEN,s.w.vintage)}</div>
              <span style={{fontSize:12,fontWeight:700,color:colA.c}}>{s.ra}</span>
              <span style={{fontSize:10,color:"#ccc"}}>vs</span>
              <span style={{fontSize:12,fontWeight:700,color:colB.c}}>{s.rb}</span>
            </div>
          ))}
        </div>
      )}

      {grapeRows.length>0 && (
        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:"#666",marginBottom:8}}>🍇 품종별 선호 (평균점)</div>
          {grapeRows.map(r=><CmpBar key={r.k} label={r.k} a={r.a} b={r.b}/>)}
        </div>
      )}

      {typeRows.length>0 && (
        <div style={{marginBottom:(rpA||rpB)?14:0}}>
          <div style={{fontSize:12,fontWeight:700,color:"#666",marginBottom:8}}>🍾 종류별 선호 (평균점)</div>
          {typeRows.map(r=><CmpBar key={r.k} label={`${TICON[r.k]||"🍾"} ${r.k}`} a={r.a} b={r.b}/>)}
        </div>
      )}

      {(rpA||rpB) && (
        <div>
          <div style={{fontSize:12,fontWeight:700,color:"#666",marginBottom:8}}>🔁 재구매 성향</div>
          <div style={{display:"flex",gap:8}}>
            {[[A,rpA,colA],[B,rpB,colB]].map(([t,r,col])=>(
              <div key={t} style={{flex:1,textAlign:"center",background:col.bg,borderRadius:8,padding:"8px"}}>
                <div style={{fontSize:11,color:col.c,fontWeight:600}}>{t}</div>
                <div style={{fontSize:17,fontWeight:700,color:col.c}}>{r?`${r.pct}%`:"–"}</div>
                <div style={{fontSize:9,color:"#aaa"}}>{r?`재구매 의향 (${r.n}개)`:"기록 없음"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{marginTop:12,fontSize:10,color:"#bbb",textAlign:"center"}}>
        <span style={{color:colA.c,fontWeight:700}}>■</span> {A}
        <span style={{color:colB.c,fontWeight:700,marginLeft:10}}>■</span> {B}
      </div>
    </div>
  );
}

// ── 📜 Tasting Timeline ────────────────────────────────────────────
function TastingTimeline({ notes, wines, tasters=["나","아내"] }) {
  const wineById = Object.fromEntries(wines.map(w=>[w.id,w]));
  const num = v => { const x=parseFloat(String(v).replace(/[^\d.]/g,"")); return isNaN(x)?null:x; };
  const tColor = t => {
    const i = tasters.indexOf(t);
    return i===0 ? {bg:"#FDF1F2",c:RED} : i===1 ? {bg:"#E8F5E9",c:"#2E7D32"} : {bg:"#eee",c:"#777"};
  };

  const events = notes
    .map(n => ({ ...n, _d: (n.date || (n.createdAt||"").slice(0,10) || "") }))
    .filter(e => /^\d{4}-\d{2}/.test(e._d))
    .sort((a,b) => b._d.localeCompare(a._d));

  if (!events.length) {
    return (
      <div style={CS}>
        <SH>📜 시음 타임라인</SH>
        <div style={{fontSize:12,color:"#aaa",lineHeight:1.6}}>날짜가 기록된 시음노트가 쌓이면 여기에 시음 이력이 시간순으로 나타납니다.</div>
      </div>
    );
  }

  const byMonth = {};
  events.forEach(e => { const m=e._d.slice(0,7); byMonth[m]=(byMonth[m]||0)+1; });
  const months = Object.keys(byMonth).sort().slice(-10);
  const maxM = Math.max(...months.map(m=>byMonth[m]), 1);

  const groups = [];
  let cur = null;
  events.forEach(e => {
    const m=e._d.slice(0,7);
    if(!cur||cur.m!==m){ cur={m,items:[]}; groups.push(cur); }
    cur.items.push(e);
  });
  const monthLabel = m => { const [y,mo]=m.split("-"); return `${y}년 ${parseInt(mo,10)}월`; };
  const dayLabel = d => { const p=d.split("-"); return p.length>=3 ? `${parseInt(p[1],10)}/${parseInt(p[2],10)}` : `${parseInt(p[1]||"0",10)}월`; };
  const wineName = e => e.wineName || (wineById[e.wineId] ? cleanName(wineById[e.wineId].nameKR||wineById[e.wineId].nameEN, wineById[e.wineId].vintage) : "(와인 미상)");

  return (
    <div style={CS}>
      <SH>📜 시음 타임라인 <span style={{fontSize:11,fontWeight:400,color:"#bbb"}}>· 총 {events.length}회</span></SH>

      {months.length>1 && (
        <div style={{display:"flex",gap:3,alignItems:"flex-end",height:50,marginBottom:16,padding:"0 2px"}}>
          {months.map(m=>(
            <div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
              <span style={{fontSize:8,color:"#ccc"}}>{byMonth[m]}</span>
              <div style={{width:"100%",background:GOLD,opacity:.6,borderRadius:"3px 3px 0 0",height:`${byMonth[m]/maxM*28+2}px`}}/>
              <span style={{fontSize:8,color:"#bbb"}}>{m.slice(2).replace("-",".")}</span>
            </div>
          ))}
        </div>
      )}

      {groups.map(g=>(
        <div key={g.m} style={{marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:"#999",marginBottom:5}}>{monthLabel(g.m)}<span style={{color:"#ccc",fontWeight:400}}> · {g.items.length}회</span></div>
          {g.items.map((e,i)=>{
            const r=num(e.rating); const col=tColor(e.taster);
            return (
              <div key={(e.id||e.createdAt||"")+"-"+i} style={{display:"flex",alignItems:"center",gap:9,padding:"6px 0",borderBottom:"1px solid #f7f4f0"}}>
                <span style={{fontSize:11,color:"#bbb",width:34,flexShrink:0,textAlign:"right"}}>{dayLabel(e._d)}</span>
                <span style={{fontSize:10,fontWeight:700,color:col.c,background:col.bg,borderRadius:10,padding:"2px 7px",flexShrink:0}}>{e.taster||"?"}</span>
                <div style={{flex:1,minWidth:0,fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {wineName(e)}{e.vintage?<span style={{color:"#bbb",fontWeight:400}}> {e.vintage}</span>:null}
                  {e.foodPairing?<span style={{fontWeight:400,color:"#c4b8aa"}}> · 🍽 {e.foodPairing}</span>:null}
                </div>
                {r!=null && <span style={{fontSize:13,fontWeight:700,color:GOLD,flexShrink:0}}>{e.rating}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function StatsTab({ wines, notes, tasters=["나","아내"] }) {
  const cel = wines.filter(w=>w.type==="cellar");
  const inStock = cel.filter(w=>w.status!=="Consumed");
  const consumed = cel.filter(w=>w.status==="Consumed");
  const wis = wines.filter(w=>w.type==="wishlist");

  // Total investment
  let totalVal=0;
  inStock.forEach(w=>{const p=parseFloat(String(w.purchasePrice||"").replace(/[₩,]/g,""));if(!isNaN(p))totalVal+=p;});

  // Drink status counts
  const dsCounts={now:0,urgent:0,past:0,young:0,nv:0,none:0};
  inStock.forEach(w=>{const s=getDrinkStatus(w.drinkFrom,w.drinkUntil);dsCounts[s||"none"]++;});

  // By type
  const byType={};
  inStock.forEach(w=>{const t=w.wineType||"기타";byType[t]=(byType[t]||0)+1;});

  // By country
  const byCountry={};
  inStock.forEach(w=>{const c=w.country||"미지정";byCountry[c]=(byCountry[c]||0)+1;});
  const topCountries=Object.entries(byCountry).sort((a,b)=>b[1]-a[1]).slice(0,6);

  // Drink window by year
  const byYear={};
  const thisYear=new Date().getFullYear();
  for(let y=thisYear;y<=thisYear+10;y++)byYear[y]=0;
  inStock.forEach(w=>{
    const f=parseInt(w.drinkFrom),u=parseInt(String(w.drinkUntil||"").replace(/\+/g,""));
    if(!isNaN(f)&&!isNaN(u)){for(let y=Math.max(f,thisYear);y<=Math.min(u,thisYear+10);y++){byYear[y]=(byYear[y]||0)+1;}}
  });
  const maxYear=Math.max(...Object.values(byYear),1);

  // Top rated
  const topRated=[...inStock].filter(w=>w.expertRatings&&Object.values(w.expertRatings).some(Boolean))
    .map(w=>{const scores=Object.values(w.expertRatings||{}).filter(Boolean).map(s=>parseFloat(s)).filter(s=>s>20);const avg=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0;return{...w,avgScore:avg};})
    .sort((a,b)=>b.avgScore-a.avgScore).slice(0,5);

  const KPI=({label,value,sub})=>(
    <div style={{background:"#fff",border:"1px solid #ece8e4",borderRadius:12,padding:"14px 16px",flex:1}}>
      <div style={{fontSize:11,color:"#aaa",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>{label}</div>
      <div style={{fontSize:22,fontWeight:700,color:RED,lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:"#888",marginTop:3}}>{sub}</div>}
    </div>
  );

  const maxType=Math.max(...Object.values(byType),1);
  const typeColors={Red:"#8B2635",White:"#C8A020","Rosé":"#E08080",Sparkling:"#6080C0",Dessert:"#C08020",Fortified:"#806040"};

  return(
    <div>
      <div style={{fontWeight:600,fontSize:15,marginBottom:14}}>📊 통계</div>

      {/* KPI cards */}
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <KPI label="보유 중" value={`${inStock.length}병`} sub={consumed.length?`마심 ${consumed.length}병 포함 총 ${cel.length}병`:""}/>
        <KPI label="시음노트" value={`${notes.length}개`} sub={consumed.length?`마신 와인 ${consumed.length}병`:""}/>
      </div>

      {/* 💑 취향 비교 */}
      <TasteComparison notes={notes} wines={wines} tasters={tasters} />

      {/* Drink window status */}
      <div style={{...CS}}>
        <SH>🔔 음용 적기 현황</SH>
        {[
          {k:"urgent",l:"🟡 긴급 — 곧 마감",bg:"#FEF3C7",c:"#92400E"},
          {k:"now",l:"🟢 지금 마시기 좋음",bg:"#D1FAE5",c:"#065F46"},
          {k:"past",l:"🔴 피크 지남",bg:"#FEE2E2",c:"#991B1B"},
          {k:"young",l:"🔵 숙성 중",bg:"#DBEAFE",c:"#1E40AF"},
          {k:"nv",l:"🩷 NV",bg:"#F3E8FF",c:"#6B21A8"},
          {k:"none",l:"⬜ 정보 없음",bg:"#f5f5f5",c:"#666"},
        ].filter(d=>dsCounts[d.k]>0).map(d=>(
          <div key={d.k} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
            <span style={{fontSize:13,color:d.c,width:160,flexShrink:0}}>{d.l}</span>
            <div style={{flex:1,background:"#f5f2ee",borderRadius:4,height:16,overflow:"hidden"}}>
              <div style={{width:`${dsCounts[d.k]/inStock.length*100}%`,height:"100%",background:d.bg,borderRadius:4,border:`1px solid ${d.c}40`}}/>
            </div>
            <span style={{fontSize:12,color:"#888",width:28,textAlign:"right",flexShrink:0}}>{dsCounts[d.k]}</span>
          </div>
        ))}
      </div>

      {/* By type */}
      {Object.keys(byType).length>0&&<div style={CS}>
        <SH>🍾 종류별</SH>
        {Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([t,cnt])=>(
          <div key={t} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
            <span style={{fontSize:13,width:90,flexShrink:0}}>{TICON[t]||"🍾"} {t}</span>
            <div style={{flex:1,background:"#f5f2ee",borderRadius:4,height:16,overflow:"hidden"}}>
              <div style={{width:`${cnt/maxType*100}%`,height:"100%",background:typeColors[t]||"#aaa",borderRadius:4,opacity:.7}}/>
            </div>
            <span style={{fontSize:12,color:"#888",width:28,textAlign:"right"}}>{cnt}</span>
          </div>
        ))}
      </div>}

      {/* By country */}
      {topCountries.length>0&&<div style={CS}>
        <SH>🌍 국가별</SH>
        {topCountries.map(([c,cnt])=>(
          <div key={c} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
            <span style={{fontSize:13,width:90,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c}</span>
            <div style={{flex:1,background:"#f5f2ee",borderRadius:4,height:16,overflow:"hidden"}}>
              <div style={{width:`${cnt/topCountries[0][1]*100}%`,height:"100%",background:RED,borderRadius:4,opacity:.6}}/>
            </div>
            <span style={{fontSize:12,color:"#888",width:28,textAlign:"right"}}>{cnt}</span>
          </div>
        ))}
      </div>}

      {/* By AOC */}
      {(()=>{
        const byAOC={};
        inStock.forEach(w=>{const a=getAOC(w);byAOC[a]=(byAOC[a]||0)+1;});
        const aocList=Object.entries(byAOC).sort((a,b)=>b[1]-a[1]);
        if(aocList.length<2)return null;
        const maxA=aocList[0][1];
        return(
          <div style={CS}>
            <SH>🗺 지역별 분포</SH>
            {aocList.map(([a,cnt])=>(
              <div key={a} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <span style={{fontSize:12,width:130,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a}</span>
                <div style={{flex:1,background:"#f5f2ee",borderRadius:4,height:14,overflow:"hidden"}}>
                  <div style={{width:`${cnt/maxA*100}%`,height:"100%",background:GOLD,borderRadius:4,opacity:.7}}/>
                </div>
                <span style={{fontSize:11,color:"#888",width:24,textAlign:"right"}}>{cnt}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Drink window by year */}
      <div style={CS}>
        <SH>📅 연도별 음용 가능 병수</SH>
        <div style={{display:"flex",gap:4,alignItems:"flex-end",height:80,padding:"0 4px"}}>
          {Object.entries(byYear).map(([y,cnt])=>(
            <div key={y} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <span style={{fontSize:9,color:parseInt(y)===thisYear?RED:"#aaa",fontWeight:parseInt(y)===thisYear?700:400}}>{cnt||""}</span>
              <div style={{width:"100%",background:parseInt(y)===thisYear?RED:parseInt(y)<=thisYear+1?"#FCD34D":"#DBEAFE",borderRadius:"2px 2px 0 0",height:`${cnt/maxYear*64+2}px`,minHeight:2,transition:"height .3s"}}/>
              <span style={{fontSize:8,color:parseInt(y)===thisYear?RED:"#bbb",fontWeight:parseInt(y)===thisYear?700:400}}>{String(y).slice(2)}</span>
            </div>
          ))}
        </div>
        <div style={{fontSize:11,color:"#aaa",marginTop:6,textAlign:"center"}}>빨강=올해, 노랑=2년 이내, 파랑=3년+</div>
      </div>

      {/* Top rated */}
      {topRated.length>0&&<div style={CS}>
        <SH>⭐ 평점 높은 와인 Top 5</SH>
        {topRated.map((w,i)=>(
          <div key={w.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid #f7f4f0"}}>
            <span style={{fontSize:13,color:"#aaa",width:16,flexShrink:0}}>#{i+1}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cleanName(w.nameKR||w.nameEN,w.vintage)}</div>
              <div style={{fontSize:11,color:"#aaa"}}>{w.vintage} · {w.region}</div>
            </div>
<div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:16,fontWeight:700,color:GOLD,lineHeight:1}}>{w.avgScore}</div><div style={{fontSize:9,color:"#ccc"}}>avg/{w.avgCount}</div></div>
          </div>
        ))}
      </div>}

      {/* ── 음용 우선순위 ── */}
      {(()=>{
        const past=inStock.filter(w=>getDrinkStatus(w.drinkFrom,w.drinkUntil)==="past");
        const urgent=inStock.filter(w=>getDrinkStatus(w.drinkFrom,w.drinkUntil)==="urgent");
        const soon=inStock.filter(w=>{const s=getDrinkStatus(w.drinkFrom,w.drinkUntil);const u=parseInt(String(w.drinkUntil||"").replace(/\+/g,""));return s==="now"&&!isNaN(u)&&u-CY<=3;});
        if(!past.length&&!urgent.length&&!soon.length)return null;
        const Row=({w})=><div style={{fontSize:12,color:"#666",paddingLeft:8,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>· {cleanName(w.nameKR||w.nameEN,w.vintage)} <span style={{color:"#bbb"}}>(~{w.drinkUntil})</span></div>;
        return(
          <div style={CS}>
            <SH>⏰ 음용 우선순위</SH>
            {past.length>0&&<div style={{marginBottom:10}}><div style={{fontSize:12,fontWeight:700,color:"#991B1B",marginBottom:5}}>🔴 피크 지남 ({past.length}병)</div>{past.slice(0,5).map(w=><Row key={w.id} w={w}/>)}</div>}
            {urgent.length>0&&<div style={{marginBottom:10}}><div style={{fontSize:12,fontWeight:700,color:"#92400E",marginBottom:5}}>🟡 올해~내년 마감 ({urgent.length}병)</div>{urgent.slice(0,5).map(w=><Row key={w.id} w={w}/>)}</div>}
            {soon.length>0&&<div><div style={{fontSize:12,fontWeight:700,color:"#065F46",marginBottom:5}}>🟢 3년 내 적기 ({soon.length}병)</div>{soon.slice(0,4).map(w=><Row key={w.id} w={w}/>)}</div>}
          </div>
        );
      })()}

      {/* ── 가성비 분석 ── */}
      {(()=>{
        const wb=inStock.filter(w=>{const p=parseFloat(String(w.purchasePrice||"").replace(/[₩,]/g,""));return !isNaN(p)&&p>0&&avgScore(w);})
          .map(w=>{const p=parseFloat(String(w.purchasePrice||"").replace(/[₩,]/g,""));const a=avgScore(w);return {...w,price:p,score:a.avg,vr:a.avg/(p/10000)};});
        if(wb.length<2)return null;
        const best=[...wb].sort((a,b)=>b.vr-a.vr).slice(0,5);
        return(
          <div style={CS}>
            <SH>💰 가성비 TOP 5</SH>
            <div style={{fontSize:11,color:"#aaa",marginBottom:10}}>평점 대비 가격 (점수÷가격)</div>
            {best.map((w,i)=>(
              <div key={w.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid #f7f4f0"}}>
                <span style={{fontSize:13,color:"#aaa",width:16,flexShrink:0}}>#{i+1}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cleanName(w.nameKR||w.nameEN,w.vintage)}</div>
                  <div style={{fontSize:11,color:"#aaa"}}>₩{Math.round(w.price/10000)}만 · {w.score}점</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:15,fontWeight:700,color:"#2E7D32",lineHeight:1}}>{w.vr.toFixed(1)}</div><div style={{fontSize:9,color:"#ccc"}}>점/만원</div></div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── 컬렉션 분석 ── */}
      {(()=>{
        if(inStock.length<5)return null;
        const aocCount={},typeCount={};
        inStock.forEach(w=>{const a=getAOC(w);aocCount[a]=(aocCount[a]||0)+1;const t=w.wineType||"기타";typeCount[t]=(typeCount[t]||0)+1;});
        const total=inStock.length, ins=[];
        const sAOC=Object.entries(aocCount).sort((a,b)=>b[1]-a[1]);
        if(sAOC[0]&&sAOC[0][1]/total>0.3)ins.push(`${sAOC[0][0]}에 집중 (${Math.round(sAOC[0][1]/total*100)}%)`);
        const reds=typeCount["Red"]||0,whites=typeCount["White"]||0;
        if(reds&&whites){const rr=reds/(reds+whites);if(rr>0.75)ins.push(`화이트가 적어요 (레드 ${reds} : 화이트 ${whites})`);else if(rr<0.35)ins.push(`레드가 적어요 (레드 ${reds} : 화이트 ${whites})`);}
        if(!(typeCount["Sparkling"]))ins.push("스파클링/샴페인이 없네요");
        if(!ins.length)ins.push("컬렉션이 균형 잡혀 있어요 👍");
        return(
          <div style={CS}>
            <SH>🔍 컬렉션 분석</SH>
            {ins.map((x,i)=><div key={i} style={{fontSize:13,color:"#555",marginBottom:6,paddingLeft:4,lineHeight:1.5}}>💡 {x}</div>)}
          </div>
        );
      })()}

      {/* 📜 시음 타임라인 */}
      <TastingTimeline notes={notes} wines={wines} tasters={tasters} />
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────
function App() {
  const [page, sp] = useState("main");
  const [tab, st] = useState("cellar");
  const [wines, sw] = useState([]);
  const [notes, sn] = useState([]);
  const [ready, sr] = useState(false);
  const [ctx, sc] = useState({});
  const [driveStatus, sds] = useState("idle");
  const [importStatus, sis] = useState("idle");
  const [googleMapsKey, setGoogleMapsKey] = useState("");
  const [aiProviderState, setAiProviderState] = useState("gemini");
  const [geminiKeyState, setGeminiKeyState] = useState("");
  const [geminiModelState, setGeminiModelState] = useState("gemini-2.5-flash");
  const [ratingBoostState, setRatingBoostState] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [tasters, setTasters] = useState(["나","아내"]);

  useEffect(() => {
    loadLocal().then(async d => {
      sw(d.wines); sn(d.notes); sr(true);
      const migrated = await migrateImages(d.wines, d.notes); // 기존 Base64 라벨사진 이전
      if(migrated) sw(migrated);
    });
    window.storage.subscribe?.((d) => { sw(d.wines); sn(d.notes); }); // 실시간 동기화
    try { window.storage.get("wine-cellar-settings").then(r => {
      if(r){
        const s=JSON.parse(r.value);
        if(s.googleMapsKey) setGoogleMapsKey(s.googleMapsKey);
        if(s.aiProvider){ setAiProviderState(s.aiProvider); setAIProvider(s.aiProvider, s.geminiKey||""); }
        if(s.geminiKey) setGeminiKeyState(s.geminiKey);
        if(s.geminiModel){ setGeminiModelState(s.geminiModel); setAIModel(s.geminiModel); }
        if(s.ratingBoost!==undefined){ setRatingBoostState(s.ratingBoost); setRatingBoost(s.ratingBoost); }
        if(s.tasters) setTasters(s.tasters);
      }
    }).catch(()=>{}); } catch(e) {}
  }, []);

  function nav(p, c) { sc(c||{}); sp(p); }
  function back() { sp("main"); sc({}); }
  function persist(w, n) { sw(w); sn(n); saveLocal(w, n); }
  function saveGoogleKey(k) { setGoogleMapsKey(k); saveSettings({googleMapsKey:k}); }
  function saveAISettings(provider, gkey) {
    setAiProviderState(provider); setGeminiKeyState(gkey);
    setAIProvider(provider, gkey);
    saveSettings({aiProvider:provider, geminiKey:gkey});
  }
  function saveTasters(arr) { setTasters(arr); saveSettings({tasters:arr}); }
  function saveModel(m){ setGeminiModelState(m); setAIModel(m); saveSettings({geminiModel:m}); }
  function saveRatingBoost(on){ setRatingBoostState(on); setRatingBoost(on); saveSettings({ratingBoost:on}); }
  function saveSettings(patch) {
    try {
      window.storage.get("wine-cellar-settings").then(r=>{
        const s=r?JSON.parse(r.value):{};
        window.storage.set("wine-cellar-settings",JSON.stringify({...s,...patch}));
      }).catch(()=>{});
    } catch(e) {}
  }

  function doExportJSON() {
    const data = JSON.stringify({wines, notes}, null, 2);
    const blob = new Blob([data], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `wine-cellar-${new Date().toISOString().split("T")[0]}.json`;
    a.click(); URL.revokeObjectURL(url);
  }
  function doImportJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const d = JSON.parse(ev.target.result);
        if (d.wines) {
          sw(d.wines); sn(d.notes||[]); await saveLocal(d.wines, d.notes||[]);
          const migrated = await migrateImages(d.wines, d.notes||[]);
          if(migrated) sw(migrated);
        }
      } catch(err) { alert("파일 형식이 올바르지 않습니다."); }
    };
    reader.readAsText(file);
  }
  async function driveSave() {
    sds("syncing");
    try { await saveToGDrive(wines,notes); sds("done"); } catch(e) { sds("error"); }
    setTimeout(()=>sds("idle"),3000);
  }
  async function driveLoad() {
    sds("syncing");
    try { const d=await loadFromGDrive(); if(d){sw(d.wines);sn(d.notes);saveLocal(d.wines,d.notes);} sds("done"); } catch(e) { sds("error"); }
    setTimeout(()=>sds("idle"),3000);
  }
  async function doImport() {
    sis("loading");
    try {
      const rows = await importFromSheets();
      if (!rows||!rows.length) { sis("error"); setTimeout(()=>sis("idle"),3000); return; }
      const newWines = rows.map((row,i) => ({
        ...emptyWine(), ...row,
        id:`sheet-${Date.now()}-${i}`,
        type:"cellar",
        status:row.status==="Consumed"?"Consumed":"In Stock",
        createdAt:new Date().toISOString(),
      }));
      const merged = [...wines, ...newWines.filter(nw=>!wines.some(w=>w.nameKR===nw.nameKR&&w.vintage===nw.vintage))];
      persist(merged, notes);
      sis(`done:${newWines.length}`);
    } catch(e) { sis("error"); }
    setTimeout(()=>sis("idle"),5000);
  }

  function addWine(w) { const u=[...wines,{...w,id:String(Date.now()),createdAt:new Date().toISOString()}]; persist(u,notes); back(); }
  function editWine(id,ch) { sw(prev=>{ const u=prev.map(w=>w.id===id?{...w,...ch}:w); saveLocal(u,notes); return u; }); if(ctx.wine?.id===id)sc(c=>({...c,wine:{...c.wine,...ch}})); }
  // 일괄 채우기 — 정보 없는 와인만 순차 호출 + 딜레이(RPM 회피)
  const [batchState, setBatchState] = useState(null);
  async function batchFill(){
    const targets = wines.filter(w => !hasData(w.terroir) && !w.wineInsights);
    if(targets.length===0){ alert("이미 모든 와인에 AI 정보가 채워져 있습니다."); return; }
    const mins = Math.ceil(targets.length*7/60);
    if(!window.confirm(`정보가 비어있는 ${targets.length}병의 기본·상세 정보를 현재 선택된 AI 모델(${_aiModel})로 채웁니다.\n약 ${mins}분 소요되며, 진행 중 앱을 닫지 마세요.\n(심층 팁·셀러추천은 각 와인에서 "재조회"로 받으세요)\n비용을 아끼려면 설정에서 "절약" 모델로 바꾼 뒤 진행하세요.\n계속할까요?`)) return;
    setBatchState({done:0,total:targets.length});
    const sleep = ms=>new Promise(r=>setTimeout(r,ms));
    for(let i=0;i<targets.length;i++){
      try{
        const ch = await computeEnrich(targets[i], wines, true); // lite=병당 1호출, 선택한 모델 사용
        if(ch) editWine(targets[i].id, ch);
      }catch(e){
        const msg = String(e&&e.message||"");
        if(msg.includes("429")||msg.includes("RATE_LIMIT")){
          setBatchState(null);
          alert(`⏳ 한도 초과로 일괄 채우기를 중단했습니다.\n\n${i}병 완료, ${targets.length-i}병 남음.\nGemini 무료 일일 한도는 태평양시간 자정(한국 오후 4~5시)에 리셋됩니다. 그 후 다시 "한번에 채우기"를 누르면 남은 와인만 이어서 채웁니다.`);
          return;
        }
      }
      setBatchState({done:i+1,total:targets.length});
      if(i<targets.length-1) await sleep(6500); // 병당 1호출, RPM 10 회피(분당 ~9회)
    }
    setBatchState(null);
    alert("일괄 채우기 완료!");
  }
  function deleteWine(id) { persist(wines.filter(w=>w.id!==id),notes.filter(n=>n.wineId!==id)); back(); }
  
  function saveNote(n, opts={}) {
    let u, updatedWines = wines;
    if(n.id && notes.some(x=>x.id===n.id)) {
      u = notes.map(x=>x.id===n.id?{...x,...n}:x); // 수정
    } else {
      u = [...notes, {...n, id:String(Date.now())+Math.random().toString(36).slice(2,5), createdAt:new Date().toISOString()}];
      if(n.wineId && !opts.skipQty) {
        updatedWines = wines.map(w => {
          if(w.id!==n.wineId || w.type!=="cellar") return w;
          const qty = parseInt(w.quantity)||1;
          return qty>1 ? {...w, quantity:String(qty-1)} : {...w, status:"Consumed"};
        });
      }
    }
    persist(updatedWines, u);
    if(!opts.stay) back();
  }
  function deleteNote(id) { persist(wines,notes.filter(n=>n.id!==id)); back(); }

  const cel = wines.filter(w=>w.type==="cellar");
  const wis = wines.filter(w=>w.type==="wishlist");
  const inStockCount = cel.filter(w=>w.status!=="Consumed").length;

  const driveBtn = {
    idle:{bg:"rgba(255,255,255,.15)",c:"#fff",l:"☁️ Drive 저장"},
    syncing:{bg:"rgba(255,255,255,.1)",c:"rgba(255,255,255,.6)",l:"동기화중..."},
    done:{bg:"#D1FAE5",c:"#065F46",l:"✓ 완료"},
    error:{bg:"#FEE2E2",c:"#991B1B",l:"오류"},
  }[driveStatus];
  const importBtn = importStatus==="loading" ? {bg:"#FEF3C7",c:"#92400E",l:"시트 읽는 중..."}
    : importStatus.startsWith("done") ? {bg:"#D1FAE5",c:"#065F46",l:`✓ ${importStatus.split(":")[1]}개 가져옴`}
    : importStatus==="error" ? {bg:"#FEE2E2",c:"#991B1B",l:"오류"}
    : {bg:"rgba(255,255,255,.15)",c:"#fff",l:"📊 시트 가져오기"};

  if (!ready) {
    return (<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#F7F4F0",color:"#aaa",fontSize:16,fontFamily:"system-ui,sans-serif"}}>🍷 불러오는 중...</div>);
  }
  if (page==="detail") { return (<WineDetailPage key={ctx.wine?.id} wine={ctx.wine} wines={wines} notes={notes.filter(n=>n.wineId===ctx.wine?.id)} onBack={back} onUpdate={ch=>editWine(ctx.wine.id,ch)} onDelete={()=>deleteWine(ctx.wine.id)} onTaste={()=>nav("tasting",{wine:ctx.wine})} onOpenWine={(w)=>nav("detail",{wine:w})} googleMapsKey={googleMapsKey} tasters={tasters}/>); }
  if (page==="add") { return (<AddWinePage type={ctx.type} onAdd={w=>addWine({...w,type:ctx.type,status:"In Stock"})} onBack={back}/>); }
  if (page==="tasting") { return (<AddTastingPage wine={ctx.wine||null} wines={cel} onSave={saveNote} onBack={back} tasters={tasters} editNote={ctx.editNote||null}/>); }
  if (page==="note") { return (<NoteDetailPage note={ctx.note} wine={wines.find(w=>w.id===ctx.note?.wineId)} onBack={back} onDelete={()=>deleteNote(ctx.note.id)} onEdit={()=>nav("tasting",{editNote:ctx.note})}/>); }
  if (page==="cellarmap") { return (<CellarMapPage wines={wines} onBack={back}/>); }

  return (
    <div style={{minHeight:"100vh",background:"#F7F4F0",fontFamily:"system-ui,sans-serif"}}>
      <div style={{background:RED,padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:24}}>🍷</span>
        <div style={{flex:1}}>
          <div style={{fontSize:17,fontWeight:700,color:"#fff"}}>My Wine Cellar</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.7)"}}>{inStockCount}병 · 노트 {notes.length} · 관심 {wis.length}</div>
        </div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",justifyContent:"flex-end"}}>
          <button onClick={doExportJSON} style={{background:"rgba(255,255,255,.15)",color:"#fff",border:"none",borderRadius:6,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>📤 내보내기</button>
          <label style={{background:"rgba(255,255,255,.15)",color:"#fff",border:"none",borderRadius:6,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>
            📥 불러오기<input type="file" accept=".json" onChange={doImportJSON} style={{display:"none"}}/>
          </label>
          <button onClick={()=>nav("cellarmap")} style={{background:"rgba(255,255,255,.15)",color:"#fff",border:"none",borderRadius:6,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>🗺 지도</button>
          <button onClick={()=>setShowSettings(s=>!s)} style={{background:"rgba(255,255,255,.15)",color:"#fff",border:"none",borderRadius:6,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>⚙️</button>
        </div>
      </div>
      {showSettings && (
        <div style={{background:"#fff",borderBottom:"1px solid #eee",padding:"14px 16px"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:12}}>⚙️ 설정</div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:600,color:"#888",marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>🤖 AI 제공자</div>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              {[["claude","Claude"],["gemini","Gemini Flash (무료)"]].map(([v,l])=>(
                <button key={v} onClick={()=>saveAISettings(v,geminiKeyState)}
                  style={{flex:1,padding:"9px 8px",border:`1px solid ${aiProviderState===v?RED:"#ddd"}`,borderRadius:8,fontSize:12,fontWeight:aiProviderState===v?600:400,background:aiProviderState===v?"#FDF1F2":"#fff",color:aiProviderState===v?RED:"#666",cursor:"pointer"}}>
                  {l}
                </button>
              ))}
            </div>
            {aiProviderState==="gemini" && (
              <div>
                <input value={geminiKeyState} onChange={e=>saveAISettings("gemini",e.target.value)}
                  placeholder="Google AI Studio API 키 (AIza...)" type="password"
                  style={{width:"100%",border:"1px solid #ddd",borderRadius:6,padding:"7px 10px",fontSize:12,outline:"none",boxSizing:"border-box"}}/>
                <div style={{fontSize:11,color:"#aaa",marginTop:4}}>
                  무료 발급: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{color:"#4285F4"}}>aistudio.google.com/apikey</a> — 카드 불필요, 하루 1,500회 무료
                </div>

                {/* 모델 선택 */}
                <div style={{marginTop:14}}>
                  <div style={{fontSize:11,fontWeight:600,color:"#888",marginBottom:6}}>AI 모델 (품질 ↔ 비용)</div>
                  <div style={{display:"flex",gap:6,marginBottom:6}}>
                    {[["gemini-2.5-flash-lite","절약","최저가·일괄용"],["gemini-2.5-flash","균형","추천"],["gemini-2.5-pro","고품질","유료·정밀"]].map(([m,label,desc])=>(
                      <button key={m} onClick={()=>saveModel(m)}
                        style={{flex:1,padding:"8px 4px",border:`1px solid ${geminiModelState===m?RED:"#ddd"}`,borderRadius:8,background:geminiModelState===m?"#FDF1F2":"#fff",cursor:"pointer"}}>
                        <div style={{fontSize:12,fontWeight:geminiModelState===m?700:500,color:geminiModelState===m?RED:"#555"}}>{label}</div>
                        <div style={{fontSize:9,color:"#aaa",marginTop:1}}>{desc}</div>
                      </button>
                    ))}
                  </div>
                  <input value={geminiModelState} onChange={e=>saveModel(e.target.value)}
                    style={{width:"100%",border:"1px solid #eee",borderRadius:6,padding:"6px 9px",fontSize:11,color:"#888",outline:"none",boxSizing:"border-box"}}/>
                  <div style={{fontSize:10,color:"#bbb",marginTop:4,lineHeight:1.5}}>
                    무료 등급은 Flash·Flash-Lite만 됩니다. Pro 및 3.x(예: gemini-3-flash, gemini-3.1-pro-preview)는 결제 등록 후 위 칸에 직접 입력해 사용하세요. 일괄 채우기는 여기서 선택한 모델로, 병당 1회만 호출합니다.
                  </div>
                  {/* 평점 보강 토글 */}
                  <label style={{display:"flex",alignItems:"flex-start",gap:8,marginTop:12,cursor:"pointer"}}>
                    <input type="checkbox" checked={ratingBoostState} onChange={e=>saveRatingBoost(e.target.checked)} style={{marginTop:2}}/>
                    <span>
                      <span style={{fontSize:12,fontWeight:600,color:"#555"}}>전문가 평점 Pro 보강</span>
                      <span style={{display:"block",fontSize:10,color:"#aaa",marginTop:2,lineHeight:1.5}}>기본 모델(Flash)이 평점을 못 채우면 Pro로 평점만 한 번 더 조회합니다. 평점 누락을 크게 줄이며, 평점 전용이라 비용은 미미합니다. (기본 모델이 이미 Pro면 동작 안 함 · 결제 등록 필요)</span>
                    </span>
                  </label>
                </div>
              </div>
            )}
            {aiProviderState==="claude" && (
              <div style={{fontSize:11,color:"#aaa"}}>Gemini로 전환 시 크레딧 소모 없이 무료로 이용 가능합니다.</div>
            )}
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:"#888",marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>🗺 지도 API 키 (선택)</div>
            <input value={googleMapsKey} onChange={e=>saveGoogleKey(e.target.value)}
              placeholder="Mapbox: pk.eyJ1... · Google: AIza..." type="password"
              style={{width:"100%",border:"1px solid #ddd",borderRadius:6,padding:"7px 10px",fontSize:12,outline:"none",boxSizing:"border-box"}}/>
            <div style={{fontSize:11,color:"#aaa",marginTop:4}}>
              Mapbox 무료: <a href="https://account.mapbox.com" target="_blank" rel="noreferrer" style={{color:"#4264FB"}}>account.mapbox.com</a>
            </div>
          </div>
        </div>
      )}
      <div style={{display:"flex",background:"#fff",borderBottom:"1px solid #eee"}}>
        {[["cellar","🍾 셀러",inStockCount],["tasting","📝 시음노트",notes.length],["wishlist","❤️ 관심",wis.length],["stats","📊 통계",""]].map(([k,l,n]) => (
          <button key={k} onClick={()=>st(k)} style={{flex:1,padding:"12px 4px",border:"none",background:tab===k?"#FDF8F5":"#fff",color:tab===k?RED:"#888",fontSize:13,fontWeight:tab===k?700:400,borderBottom:tab===k?`2px solid ${RED}`:"2px solid transparent",cursor:"pointer",fontFamily:"system-ui,sans-serif"}}>
            {l} <span style={{fontSize:11,opacity:.7}}>({n})</span>
          </button>
        ))}
      </div>
      <div style={{padding:16,maxWidth:680,margin:"0 auto",paddingTop:16}}>
        {tab==="cellar" && (<CellarTab wines={cel} notes={notes} onNav={nav} onBatchFill={batchFill} batchState={batchState}/>)}
        {tab==="tasting" && (<TastingTab notes={notes} wines={wines} onNav={nav}/>)}
        {tab==="wishlist" && (<WishlistTab wines={wis} onNav={nav} onMove={id=>editWine(id,{type:"cellar",status:"In Stock"})}/>)}
        {tab==="stats" && (<StatsTab wines={wines} notes={notes} tasters={tasters}/>)}
      </div>
    </div>
  );
}

export default App;
