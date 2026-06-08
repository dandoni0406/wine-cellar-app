import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './storage.js';

const STORAGE_KEY = "wine-cellar-v6";
const CY = new Date().getFullYear();
const RED = "#8B2635", GOLD = "#9A7020";
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
async function callClaude(prompt, tokens, drive){
  // NOTE: Direct Anthropic API calls only work inside the Claude.ai artifact
  // sandbox (which injects auth). In this deployed standalone app there is no
  // proxy, so this will fail. Use Gemini instead: open Settings and paste a
  // free Gemini API key from https://aistudio.google.com/apikey
  throw new Error("배포 환경에서는 Claude 직접 호출이 안 됩니다. ⚙️ 설정에서 Gemini API 키를 입력해 Gemini로 전환하세요.");
}

async function callGemini(prompt, apiKey, tokens, model){
  model = model || "gemini-2.5-flash";
  const isPro = model.includes("pro");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const genConfig = {
    maxOutputTokens: Math.max(tokens||2000, isPro?16000:6000),
    temperature:0.15,
    responseMimeType:"application/json"   // JSON 모드 강제 → 인사말/마크다운 없이 순수 JSON, 파싱 먹통 방지
  };
  if(!isPro) genConfig.thinkingConfig = {thinkingBudget:0};  // Flash만 thinking 끔 (Pro는 thinking 필수라 끄지 않음)
  const r = await fetch(url, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ contents:[{parts:[{text:prompt}]}], generationConfig:genConfig })
  });
  if(!r.ok){
    if(r.status===429){ aiNotify("limit"); throw new Error("RATE_LIMIT 429"); }
    aiNotify("error", r.status); throw new Error(`Gemini HTTP ${r.status}`);
  }
  const data = await r.json();
  if(data.error){ aiNotify("error"); throw new Error(data.error.message); }
  // thought 파트(Pro 추론과정)는 건너뛰고 실제 JSON 응답 파트 사용
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = (parts.find(p => !p.thought) || parts[0])?.text || "{}";
  return {content:[{type:"text",text}]};
}

// Unified AI caller — routes to Gemini or Claude based on settings
let _aiProvider = "gemini"; // deployed default; user supplies Gemini key in Settings
let _geminiKey = "";
function setAIProvider(p, key){ _aiProvider=p; _geminiKey=key||""; }

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
  const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({contents:[{parts:[{text:prompt},{inline_data:{mime_type:mime,data:b64}}]}],
      generationConfig:{maxOutputTokens:Math.max(tokens||1500,4000),temperature:0.1,thinkingConfig:{thinkingBudget:0},responseMimeType:"application/json"}})});
  if(!r.ok) throw new Error(`Gemini HTTP ${r.status}`);
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
`와인 "${name}"${v?` (${v}빈티지)`:""}의 기본 정보를 아래 JSON으로만 반환. 마크다운 없이 순수 JSON만. nameKR/nameEN에 빈티지 포함 금지. 부르고뉴면 isBurgundy=true, 보르도면 isBordeaux=true.
정확한 사실만 입력. 와인의 실제 생산 국가·지역을 정확히 판단할 것(예: "Beaune/본"은 프랑스 부르고뉴이지 독일이 아님). 확실하지 않은 항목은 추측하지 말고 빈 문자열로 둘 것.
{"nameKR":"한국어와인명","nameEN":"English name","producer":"생산자","country":"국가","region":"지역","subRegion":"세부지역","vineyard":"포도밭","classification":"등급","grapeVariety":"포도품종","wineType":"Red","drinkFrom":"시작연도숫자","drinkUntil":"종료연도숫자","description":"3문장 한국어 설명","isBurgundy":false,"isBordeaux":false,"vineyardLat":"위도소수","vineyardLon":"경도소수","vineyardZoom":"15","mapNotes":"밭위치설명","expertRatings":{"bh":"","ws":"","wa":"","vinous":"","js":"","jr":"","dec":"","jm":""}}
중요: expertRatings 각 필드는 실제 점수 숫자(예: 92)가 확인된 경우에만 입력. 없거나 미발표면 반드시 빈 문자열 "" — 절대 설명 텍스트 금지.`, 2000, PRO
);

// Detailed WSET-level info — called separately from detail page
const lookupWineDetail = (name, v) => aiJson(
`와인 "${name}"${v?` (${v})`:""}의 상세 정보를 아래 JSON으로만 반환. 마크다운 없이 순수 JSON만.
{"terroir":{"soilType":"","soilDesc":"","slope":"","aspect":"","altitude":"","vineAge":"","vineyardSize":"","microclimate":"","geology":""},"producerInfo":{"founded":"","size":"","certifications":"","history":"2-3문장","philosophy":"2-3문장","approach":""},"vintageInfo":{"weather":"","harvest":"","characteristics":"2-3문장","agingPotential":""},"winemaking":{"fermentation":"","yeast":"","vessel":"","aging":"","agingVessel":"","agingTime":"","malo":"","filtration":"","sulfur":""},"expertNotes":[{"critic":"","score":"","note":"실제 시음노트를 자연스러운 한국어로 번역해서. 없으면 이 항목 자체를 배열에서 생략","year":""}]}
중요: expertNotes 배열에 정보가 없는 평론가는 포함하지 말것. note는 반드시 한국어로 번역. 안내 문구, 면책 조항 절대 금지.`, 3000, PRO
);
const lookupWineRecommendations = (name, v, region, price) => aiJson(
`와인 전문가로서 "${name}"${v?` (${v})`:""} (${region||""}${price?`, 가격대 ₩${parseInt(price).toLocaleString()}`:""})과 비슷한 와인을 추천해줘. 마크다운 없이 순수 JSON만 반환.
{"famous":[{"name":"유명 와인명 (생산자 포함)","region":"지역/국가","priceRange":"가격대 예: ₩15~20만","whySimilar":"추천 이유 1-2문장","producer":"생산자"},{"name":"","region":"","priceRange":"","whySimilar":"","producer":""}],"gems":[{"name":"숨은보석 와인명","region":"지역/국가","priceRange":"가격대","whySimilar":"추천 이유 1-2문장","producer":"생산자"},{"name":"","region":"","priceRange":"","whySimilar":"","producer":""}],"note":"전반적인 추천 코멘트 1문장"}
famous: 잘 알려진 대안 2-3개 (비슷한 등급·스타일·가격대)
gems: 덜 알려졌지만 가성비 좋거나 품질 뛰어난 와인 2-3개`, 1500, PRO
);
// 내 셀러 안에서 비슷한 와인 추천 (외부 환각 방지)
const recommendFromCellar = (wine, cellarWines) => {
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
JSON만: {"items":[{"id":"목록의 id 그대로","whySimilar":"왜 비슷한지 한 문장"}]}`, 1500, PRO);
};

const lookupWineInsights = (name, v) => aiJson(
`와인 전문가 수준으로 "${name}"${v?` (${v}빈티지)`:""}에 대한 심화 정보를 아래 JSON으로만 반환. 마크다운 없이 순수 JSON만.
반드시 정확한 사실만 작성. 와인의 실제 국가·산지를 정확히 확인할 것. 확실하지 않은 항목은 빈 문자열로 두고 절대 추측하거나 지어내지 말 것.

{"hierarchy":{"description":"이 와인이 생산자 라인업에서 차지하는 위치 설명 (예: VDP.Grosse Lage > VDP.Ortswein > VDP.Gutswein 중 해당 등급)","table":[{"rank":"①","name":"최상위 와인명","category":"VDP/AOC 분류"},{"rank":"②","name":"이 와인","category":"해당 등급","isCurrent":true},{"rank":"③","name":"기본 와인","category":"엔트리 등급"}]},"classificationKey":{"title":"알아야 할 핵심 코드/시스템","items":[{"code":"코드나 용어","meaning":"설명"}]},"essentialContext":"이 와인을 이해하기 위해 반드시 알아야 할 배경 지식 2-3문장. 생산 방식 특이사항, 지역 특성, 위계 체계 등","vintageCharacter":"${v||"해당 빈티지"}년 특성 — 기상 조건, 스타일, 숙성 가능성 2문장","criticalInsight":"이 와인만의 핵심 감상 포인트 또는 구별되는 특징 2문장","peakWindow":"최적 음용 시기 (예: 2028~2038, 지금도 가능)","decanting":"디캔팅 권장 여부 및 시간","servingTemp":"적정 서빙 온도","foodPairing":["최적 페어링 음식1","음식2","음식3"],"rarityNote":"희소성/생산량/시장 접근성","funFact":"알면 흥미로운 사실 1-2문장"}`, 2500, PRO
);

const correctWine = (name, v) => aiJson(`와인 "${name}"${v?` 빈티지 ${v}`:""}을 보정해서 JSON만. nameKR/nameEN에 빈티지 포함 금지.
{"nameKR":"","nameEN":"","vintage":"","producer":"","region":"","country":"","wineType":"Red|White|Rosé|Sparkling|Dessert|Fortified","isBurgundy":false}`, 1500, PRO);
const structNote = (txt, wine) => aiJson(`"${wine}" 시음메모를 JSON으로만. 메모:"${txt}"
{"color":"","noseIntensity":"약함|중간|강함","noseAromas":"","sweetness":"드라이|오프드라이|미디엄|스위트","acidity":"낮음|중간-|중간|중간+|높음","tannin":"","alcohol":"낮음|중간|높음","body":"라이트|미디엄-|미디엄|미디엄+|풀","flavors":"","finish":"짧음|중간|김","overallImpression":"2-3문장","rating":"숫자만","repurchase":"예|보통|아니오"}`);

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
function LabelPhoto({ photo, onUpload }) {
  const ir = useRef(null);
  const hf = async e => { const f=e.target.files[0]; if(!f)return; onUpload(await compressImage(f)); };
  return (
    <div>
      {photo && (<img src={photo} alt="label" style={{width:"100%",maxHeight:300,objectFit:"contain",borderRadius:8,marginBottom:8,display:"block",background:"#f9f7f5"}}/>)}
      <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"9px",background:"#F7F4F0",border:"1px dashed #ddd",borderRadius:8,cursor:"pointer",fontSize:13,color:"#888"}}>
        📷 {photo?"라벨 사진 변경":"라벨 사진 추가"}
        <input ref={ir} type="file" accept="image/*" capture="environment" onChange={hf} style={{display:"none"}}/>
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
  const topC = isBurg&&rat.bh ? {v:rat.bh,ab:"BH",isTop:true}
    : isBord&&rat.wa ? {v:rat.wa,ab:"WA",isTop:true}
    : avg ? {v:avg.avg,ab:`avg/${avg.count}`,isTop:false}
    : (CRITICS.find(c=>rat[c.k]) ? {v:rat[CRITICS.find(c=>rat[c.k]).k],ab:CRITICS.find(c=>rat[c.k]).ab,isTop:true} : null);
  const isBord2 = wine.isBordeaux||["Bordeaux","보르도"].some(r=>(wine.region||"").includes(r));
  const dn = cleanName(wine.nameKR||wine.nameEN, wine.vintage);
  const isConsumed = wine.status==="Consumed";
  return (
    <div onMouseEnter={()=>sh(true)} onMouseLeave={()=>sh(false)} onClick={onClick}
      style={{background:"#fff",border:`1px solid ${hov?"#c4a0a8":"#ece8e4"}`,borderRadius:12,padding:16,marginBottom:10,cursor:"pointer",transition:"border-color .15s",opacity:isConsumed?.65:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{flex:1,minWidth:0,display:"flex",gap:10}}>
          {wine.labelPhoto && (<img src={wine.labelPhoto} alt="" style={{width:44,height:60,objectFit:"cover",borderRadius:6,flexShrink:0}}/>)}
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5,flexWrap:"wrap"}}>
              <span style={{fontSize:17}}>{TICON[wine.wineType]||"🍾"}</span>
              <span style={{fontWeight:600,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>{dn}</span>
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
          <div style={{textAlign:"center",background:isBurg&&topC.ab==="BH"?"#FBF4E4":"#f9f7f5",borderRadius:10,padding:"10px 14px",marginLeft:12,flexShrink:0}}>
            <div style={{fontSize:22,fontWeight:700,color:GOLD,lineHeight:1}}>{topC.v}</div>
            <div style={{fontSize:10,fontWeight:700,color:GOLD,marginTop:2}}>{topC.ab}</div>
          </div>
        )}
      </div>
      {extra && (<div onClick={e=>e.stopPropagation()} style={{marginTop:10}}>{extra}</div>)}
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────
function CellarTab({ wines, notes, onNav }) {
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
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:5}}>
                  <span>{TICON[w?.wineType]||"🍾"}</span>
                  <span style={{fontWeight:600,fontSize:14}}>{cleanName(note.wineName,note.vintage)}</span>
                  {note.vintage && (<span style={{color:GOLD,fontWeight:600,fontSize:13}}>{note.vintage}</span>)}
                </div>
                <div style={{fontSize:12,color:"#888",marginBottom:note.overallImpression?4:0}}>{note.date}{note.location?` · ${note.location}`:""}</div>
                {note.overallImpression && (<div style={{fontSize:12,color:"#666",lineHeight:1.5}}>{note.overallImpression.slice(0,90)}…</div>)}
              </div>
              {note.rating && (<div style={{fontSize:22,fontWeight:700,color:GOLD,flexShrink:0,marginLeft:12}}>{note.rating}</div>)}
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
      await doLookup(name, res.vintage?String(res.vintage):"", {labelPhoto:dataUrl});
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
            <div style={CS}><SH>📷 라벨 사진</SH><LabelPhoto photo={form.labelPhoto} onUpload={photo=>sf(p=>({...p,labelPhoto:photo}))}/></div>
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
      const name=wine.nameKR||wine.nameEN;
      const v=wine.vintage;
      const [basic, detail] = await Promise.all([
        lookupWine(name, v),
        lookupWineDetail(name, v),
      ]);
      const notes = detail.expertNotes?.length ? detail.expertNotes : (wine.expertNotes||[]);
      // Sync ratings: expertNotes scores → expertRatings (fill empty only)
      const mergedRat = syncRatings(notes, {...(wine.expertRatings||{}), ...(basic.expertRatings||{})});
      onUpdate({
        ...basic,
        nameKR: wine.nameKR||basic.nameKR||"",
        nameEN: wine.nameEN||basic.nameEN||"",
        vintage: wine.vintage||basic.vintage||"",
        country: normCountry(basic.country||wine.country||""),
        producer: wine.producer||basic.producer||"",
        expertRatings: mergedRat,
        terroir: {...(wine.terroir||{}), ...(detail.terroir||{})},
        producerInfo: {...(wine.producerInfo||{}), ...(detail.producerInfo||{})},
        vintageInfo: {...(wine.vintageInfo||{}), ...(detail.vintageInfo||{})},
        winemaking: {...(wine.winemaking||{}), ...(detail.winemaking||{})},
        expertNotes: notes.filter(n=>!isDisclaimerNote(n.note)),
      });
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
            {wine.labelPhoto && (<img src={wine.labelPhoto} alt="" style={{width:80,height:110,objectFit:"contain",borderRadius:8,flexShrink:0,background:"#f9f7f5"}}/>)}
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
                      ? <div style={{fontSize:12,color:"#2E7D32",fontWeight:600}}>✅ AI 상세 정보 입력됨</div>
                      : <><div style={{fontSize:12,fontWeight:600,color:"#666"}}>📖 상세 정보 없음</div>
                          <div style={{fontSize:11,color:"#bbb",marginTop:1}}>테루아·생산자·빈티지·양조를 AI가 채워드릴게요</div></>
                    }
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button onClick={doEnrich} style={{background:RED,color:"#fff",border:"none",borderRadius:8,padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                      🤖 {hasData(wine.terroir)||hasData(wine.producerInfo)?"재조회":"AI 채우기"}
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
                🤖 AI가 와인 정보를 조회하는 중... 잠시만 기다려주세요.
              </div>
            )}
            {/* ── Expert Ratings ── */}
            {hasR && (
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
            {wine.expertNotes && wine.expertNotes.filter(n=>!isDisclaimerNote(n.note)).length > 0 && (
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

            {/* ── Terroir ── */}
            {hasData(wine.terroir) && (
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
            {hasData(wine.producerInfo) && (
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
            {hasData(wine.vintageInfo) && (
              <div style={CS}>
                <SH>📅 {wine.vintage} 빈티지</SH>
                <DR label="기상" val={wine.vintageInfo.weather}/>
                <DR label="수확" val={wine.vintageInfo.harvest}/>
                <DR label="숙성 잠재력" val={wine.vintageInfo.agingPotential}/>
                {wine.vintageInfo.characteristics && (<div style={NS}>{wine.vintageInfo.characteristics}</div>)}
              </div>
            )}

            {/* ── Winemaking ── */}
            {hasData(wine.winemaking) && (
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
            {wine.vineyardLat&&wine.vineyardLon && (
              <div style={CS}>
                <SH>📍 포도밭 위치</SH>
                {wine.mapNotes && (<div style={{fontSize:12,color:"#888",marginBottom:8}}>{wine.mapNotes}</div>)}
                <MapDisplay lat={wine.vineyardLat} lon={wine.vineyardLon} zoom={wine.vineyardZoom} label={wine.mapNotes}/>
              </div>
            )}

            {/* ── Wine Insights / Tips ── */}
            <div style={CS}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <SH style={{marginBottom:0}}>💡 알아두면 좋은 것</SH>
                {!insights && !loadingInsights && (
                  <button onClick={doLoadInsights} style={{background:"#FBF4E4",color:GOLD,border:`1px solid ${GOLD}40`,borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                    🤖 AI 팁 불러오기
                  </button>
                )}
                {loadingInsights && (
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:12,color:GOLD,fontWeight:600}}>🤖 분석 중...</span>
                    <span style={{fontSize:10,color:"#ccc"}}>15~30초 소요</span>
                  </div>
                )}
                {insights && <button onClick={doLoadInsights} disabled={loadingInsights} style={{background:"none",border:"none",fontSize:11,color:"#aaa",cursor:"pointer"}}>🔄</button>}
              </div>
              {insights ? (
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
                              <td style={{padding:"6px 8px",fontWeight:row.isCurrent?700:400,color:row.isCurrent?RED:"#333"}}>{row.name}{row.isCurrent?" ◀ 이 와인":""}</td>
                              <td style={{padding:"6px 8px",fontSize:11,color:"#888"}}>{row.category}</td>
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
                        <div key={i} style={{display:"flex",gap:8,marginBottom:i<insights.classificationKey.items.length-1?6:0}}>
                          <span style={{fontSize:12,fontWeight:700,color:RED,flexShrink:0,minWidth:80}}>{item.code}</span>
                          <span style={{fontSize:12,color:"#555",lineHeight:1.5}}>{item.meaning}</span>
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
                  {insights.funFact && <div style={{fontSize:12,color:"#888",fontStyle:"italic",marginBottom:6}}>💬 {insights.funFact}</div>}
                </div>
              ) : (
                <div style={{fontSize:12,color:"#aaa",textAlign:"center",padding:"8px 0"}}>
                  AI 팁 버튼을 눌러 생산자 위계, 분류 코드, 감상 포인트, 페어링 등을 확인하세요
                </div>
              )}
            </div>

            {/* ── My Tasting Notes ── */}
            {notes.length > 0 && (
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
            <div style={CS}><SH>📷 라벨 사진</SH><LabelPhoto photo={wine.labelPhoto} onUpload={photo=>onUpdate({labelPhoto:photo})}/></div>

            {/* ── Recommendations ── */}
            <div style={CS}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <SH style={{marginBottom:0}}>🍷 내 셀러의 비슷한 와인</SH>
                {!loadingReco&&<button onClick={doLoadReco}
                  style={{background:reco?"#f5f2ee":"#FDF1F2",color:reco?"#888":RED,border:`1px solid ${reco?"#eee":RED+"40"}`,borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                  {reco?"🔄 다시 찾기":"🍷 셀러에서 찾기"}
                </button>}
                {loadingReco&&<span style={{fontSize:12,color:"#aaa"}}>찾는 중...</span>}
              </div>
              {reco && reco.items ? (
                reco.items.length>0 ? (
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
                ) : (
                  <div style={{fontSize:12,color:"#aaa",textAlign:"center",padding:"8px 0"}}>
                    {reco._few ? "셀러에 비교할 와인이 더 필요해요 (2병 이상 등록하면 추천됩니다)" : "셀러에서 비슷한 와인을 찾지 못했어요"}
                  </div>
                )
              ):(
                <div style={{fontSize:12,color:"#aaa",textAlign:"center",padding:"8px 0"}}>
                  내가 보유한 와인 중에서 이 와인과 비슷한 것을 찾아드려요
                </div>
              )}
            </div>

            {/* ── Purchase ── */}
            {wine.type==="cellar"&&(wine.purchaseDate||wine.purchasePrice||wine.location) && (
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
function AddTastingPage({ wine, wines, onSave, onBack, tasters=["나","아내"] }) {
  const [mode, sm] = useState("cellar");
  const [sel, ss] = useState(wine);
  const [en, sn] = useState(""), [ev, sev] = useState(""), [correcting, sc] = useState(false), [corrected, scr] = useState(null);
  const [txt, st] = useState(""), [structured, ssr] = useState(null), [loading, sl] = useState(false);
  const [myScore, setMyScore] = useState("");
  const [myRepurchase, setMyRepurchase] = useState("");
  const [taster, setTaster] = useState(tasters[0]||"나");
  const [meta, sm2] = useState({date:new Date().toISOString().split("T")[0],location:"",withWhom:"",foodPairing:"",decanting:""});
  const um = k => e => sm2(p=>({...p,[k]:e.target.value}));
  const wName = mode==="cellar" ? (sel?.nameKR||sel?.nameEN||"") : ((corrected?.nameKR||corrected?.nameEN)||en);
  const wVin = mode==="cellar" ? (sel?.vintage||"") : (corrected?.vintage||ev);
  const canSave = mode==="cellar" ? !!sel : !!en;
  async function doCorrect() { sc(true); try{scr(await correctWine(en,ev));}catch(e){} sc(false); }
  async function doStr() { sl(true); try{ssr(await structNote(txt,wName));}catch(e){} sl(false); }
  return (
    <div style={{minHeight:"100vh",background:"#F7F4F0",fontFamily:"system-ui,sans-serif"}}>
      <TopBar title="📝 시음노트 작성" onBack={onBack}/>
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
              <select value={sel?.id||""} onChange={e=>ss(wines.find(w=>w.id===e.target.value))} style={IS}>
                <option value="">와인 선택</option>
                {wines.map(w => (<option key={w.id} value={w.id}>{cleanName(w.nameKR||w.nameEN,w.vintage)} {w.vintage}</option>))}
              </select>
              {sel && (
                <div style={{marginTop:10,padding:"10px 12px",background:"#f9f7f5",borderRadius:8,display:"flex",gap:10,alignItems:"center"}}>
                  {sel.labelPhoto && (<img src={sel.labelPhoto} alt="" style={{width:36,height:50,objectFit:"cover",borderRadius:4}}/>)}
                  <div>
                    <div style={{fontWeight:600,fontSize:13}}>{cleanName(sel.nameKR,sel.vintage)}</div>
                    <div style={{fontSize:12,color:"#888"}}>{sel.vintage}{sel.region?` · ${sel.region}`:""}</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
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
        <div style={CS}>
          <SH>시음 메모 (자유 작성)</SH>
          <textarea value={txt} onChange={e=>st(e.target.value)} rows={6}
            placeholder={"느낌을 자유롭게 적어주세요.\n\n예: 진한 루비색, 블랙베리와 삼나무 향, 타닌 실키하고 피니쉬 길다..."}
            style={{...IS,resize:"vertical",lineHeight:1.6}}/>
          <button onClick={doStr} disabled={loading||!txt.trim()||!canSave} style={{marginTop:10,width:"100%",background:"#F5F0FF",color:"#7B4FBF",border:"1px solid #D4B8F0",borderRadius:8,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer",opacity:(!txt.trim()||!canSave)?0.5:1}}>
            {loading?"🤖 정리 중...":"🤖 AI로 시음 노트 정리"}
          </button>
        </div>
        {/* Manual score + repurchase */}
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
        {structured && (
          <div style={{...CS,border:`1px solid ${GOLD}40`}}>
            <SH>✨ AI 정리 결과</SH>
            {structured.color && (<div style={{marginBottom:10}}><div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:3,textTransform:"uppercase"}}>외관</div><div style={{fontSize:13}}>{structured.color}</div></div>)}
            {(structured.noseIntensity||structured.noseAromas) && (<div style={{marginBottom:10}}><div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:3,textTransform:"uppercase"}}>후각</div><div style={{fontSize:13}}>강도 {structured.noseIntensity} · {structured.noseAromas}</div></div>)}
            <div style={{marginBottom:10}}>
              <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:6,textTransform:"uppercase"}}>미각</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:6}}>
                {[["당도",structured.sweetness],["산도",structured.acidity],["타닌",structured.tannin],["알코올",structured.alcohol],["바디",structured.body],["피니쉬",structured.finish]].filter(([,vv])=>vv).map(([kk,vv]) => (
                  <span key={kk} style={{fontSize:12,background:"#f5f2ee",borderRadius:6,padding:"3px 10px"}}>{kk}: {vv}</span>
                ))}
              </div>
              {structured.flavors && (<div style={{fontSize:13}}>{structured.flavors}</div>)}
            </div>
            {structured.overallImpression && (<div style={{marginBottom:10}}><div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4,textTransform:"uppercase"}}>총평</div><div style={{fontSize:13,lineHeight:1.7}}>{structured.overallImpression}</div></div>)}
            <div style={{display:"flex",gap:12,alignItems:"center",marginTop:8}}>
              {structured.rating && (<div style={{fontSize:28,fontWeight:700,color:GOLD}}>{structured.rating}<span style={{fontSize:12,color:"#ccc"}}>/100</span></div>)}
              {structured.repurchase && (<span style={{fontSize:12,padding:"4px 12px",borderRadius:20,background:"#D1FAE5",color:"#065F46"}}>재구매: {structured.repurchase}</span>)}
            </div>
          </div>
        )}
        <PB onClick={()=>{
          if(!canSave)return;
          onSave({
            wineId:mode==="cellar"?sel?.id:null,
            wineName:cleanName(wName,wVin),
            vintage:wVin,
            taster: taster||tasters[0]||"나",
            ...meta,
            freeText:txt,
            ...(structured||{}),
            ...(myScore?{rating:myScore}:{}),
            ...(myRepurchase?{repurchase:myRepurchase}:{}),
          });
        }} disabled={!canSave} full>
          💾 시음노트 저장
        </PB>
      </Pg>
    </div>
  );
}

// ── Note Detail Page ──────────────────────────────────────────────
function NoteDetailPage({ note, wine, onBack, onDelete }) {
  return (
    <div style={{minHeight:"100vh",background:"#F7F4F0",fontFamily:"system-ui,sans-serif"}}>
      <TopBar title={`${TICON[wine?.wineType]||"🍾"} ${cleanName(note.wineName,note.vintage)} ${note.vintage||""}`} onBack={onBack} right={<DeleteBtn onDelete={onDelete}/>}/>
      <Pg>
        {note.rating && (
          <div style={{textAlign:"center",margin:"20px 0"}}>
            <div style={{fontSize:56,fontWeight:700,color:GOLD,lineHeight:1}}>{note.rating}</div>
            <div style={{fontSize:13,color:"#aaa",marginTop:4}}>/ 100점</div>
          </div>
        )}
        <div style={CS}>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {[note.date&&`📅 ${note.date}`,note.location&&`📍 ${note.location}`,note.withWhom&&`👥 ${note.withWhom}`,note.foodPairing&&`🍽 ${note.foodPairing}`,note.decanting&&`⏱ ${note.decanting}`].filter(Boolean).map(s => (
              <span key={s} style={{fontSize:13,background:"#f5f2ee",borderRadius:8,padding:"5px 12px",color:"#666"}}>{s}</span>
            ))}
          </div>
        </div>
        <div style={CS}>
          {note.color && (<div style={{marginBottom:12}}><div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4,textTransform:"uppercase"}}>외관</div><div style={{fontSize:14,lineHeight:1.7}}>{note.color}</div></div>)}
          {(note.noseIntensity||note.noseAromas) && (<div style={{marginBottom:12}}><div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4,textTransform:"uppercase"}}>후각</div><div style={{fontSize:14,lineHeight:1.7}}>{[note.noseIntensity&&`강도: ${note.noseIntensity}`,note.noseAromas].filter(Boolean).join(" · ")}</div></div>)}
          {(note.sweetness||note.tannin||note.body) && (
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:8,textTransform:"uppercase"}}>미각</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:6}}>
                {[["당도",note.sweetness],["산도",note.acidity],["타닌",note.tannin],["알코올",note.alcohol],["바디",note.body],["피니쉬",note.finish]].filter(([,vv])=>vv).map(([kk,vv]) => (
                  <span key={kk} style={{fontSize:13,background:"#f5f2ee",borderRadius:6,padding:"4px 12px"}}>{kk}: {vv}</span>
                ))}
              </div>
              {note.flavors && (<div style={{fontSize:14,lineHeight:1.7}}>{note.flavors}</div>)}
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
  const [showSettings, setShowSettings] = useState(false);
  const [tasters, setTasters] = useState(["나","아내"]);

  useEffect(() => {
    loadLocal().then(d => { sw(d.wines); sn(d.notes); sr(true); });
    window.storage.subscribe?.((d) => { sw(d.wines); sn(d.notes); }); // 실시간 동기화
    try { window.storage.get("wine-cellar-settings").then(r => {
      if(r){
        const s=JSON.parse(r.value);
        if(s.googleMapsKey) setGoogleMapsKey(s.googleMapsKey);
        if(s.aiProvider){ setAiProviderState(s.aiProvider); setAIProvider(s.aiProvider, s.geminiKey||""); }
        if(s.geminiKey) setGeminiKeyState(s.geminiKey);
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
    reader.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        if (d.wines) { sw(d.wines); sn(d.notes||[]); saveLocal(d.wines, d.notes||[]); }
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
  function editWine(id,ch) { const u=wines.map(w=>w.id===id?{...w,...ch}:w); persist(u,notes); if(ctx.wine?.id===id)sc(c=>({...c,wine:{...c.wine,...ch}})); }
  function deleteWine(id) { persist(wines.filter(w=>w.id!==id),notes.filter(n=>n.wineId!==id)); back(); }
  function addNote(n) {
    const u=[...notes,{...n,id:String(Date.now()),createdAt:new Date().toISOString()}];
    let updatedWines = wines;
    if(n.wineId) {
      updatedWines = wines.map(w => {
        if(w.id!==n.wineId || w.type!=="cellar") return w;
        const qty = parseInt(w.quantity)||1;
        if(qty > 1) {
          // 여러 병 중 1병 마심 → 수량만 차감, 상태 유지
          return {...w, quantity: String(qty - 1)};
        } else {
          // 마지막 1병 → Consumed 처리
          return {...w, status:"Consumed"};
        }
      });
    }
    persist(updatedWines, u);
    back();
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
  if (page==="tasting") { return (<AddTastingPage wine={ctx.wine||null} wines={cel} onSave={addNote} onBack={back} tasters={tasters}/>); }
  if (page==="note") { return (<NoteDetailPage note={ctx.note} wine={wines.find(w=>w.id===ctx.note?.wineId)} onBack={back} onDelete={()=>deleteNote(ctx.note.id)}/>); }
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
        {tab==="cellar" && (<CellarTab wines={cel} notes={notes} onNav={nav}/>)}
        {tab==="tasting" && (<TastingTab notes={notes} wines={wines} onNav={nav}/>)}
        {tab==="wishlist" && (<WishlistTab wines={wis} onNav={nav} onMove={id=>editWine(id,{type:"cellar",status:"In Stock"})}/>)}
        {tab==="stats" && (<StatsTab wines={wines} notes={notes} tasters={tasters}/>)}
      </div>
    </div>
  );
}

export default App;
