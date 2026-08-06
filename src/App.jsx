import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Mic, MicOff, Sparkles, Trash2, Send, Salad, Droplet, Plus, Minus,
  ChevronDown, Loader2, AlertTriangle, AlertCircle, CheckCircle2, RotateCcw, Utensils,
  SlidersHorizontal, Sun, Moon, Zap, Check
} from "lucide-react";

/* ---------------------------------------------------------------------------
   Palette — deep botanical, warm paper, beet accent, working status scale.
   Values are CSS custom properties (defined in StyleTag for light + dark),
   so toggling data-theme on the root repaints the whole app.
--------------------------------------------------------------------------- */
const C = {
  ink: "var(--ink)",
  ink2: "var(--ink2)",
  paper: "var(--paper)",
  card: "var(--card)",
  line: "var(--line)",
  muted: "var(--muted)",
  strong: "var(--strong)",     // solid dark fill that always pairs with white text
  beet: "var(--beet)",
  beetSoft: "var(--beet-soft)",
  beetSoftBorder: "var(--beet-soft-border)",
  green: "var(--green)",
  amber: "var(--amber)",
  clay: "var(--clay)",
  greenSoft: "var(--green-soft)",
  greenSoftBorder: "var(--green-soft-border)",
  amberSoft: "var(--amber-soft)",
  claySoft: "var(--clay-soft)",
  barTrack: "var(--bar-track)",
  tableHead: "var(--table-head)",
  disabled: "var(--disabled)",
  micDisabled: "var(--mic-disabled)",
};

const FONT_DISPLAY = "'Fraunces', Georgia, serif";
const FONT_UI = "'Inter', system-ui, sans-serif";
const FONT_MONO = "'Space Mono', ui-monospace, monospace";

/* ---------------------------------------------------------------------------
   Nutrients tracked. Keys are shared with the model's JSON schema.
--------------------------------------------------------------------------- */
const NUTRIENTS = [
  { k: "cal", label: "Calories", unit: "kcal", dec: 0, group: "macro" },
  { k: "protein", label: "Protein", unit: "g", dec: 0, group: "macro" },
  { k: "carbs", label: "Carbs", unit: "g", dec: 0, group: "macro" },
  { k: "fat", label: "Fat", unit: "g", dec: 0, group: "macro" },
  { k: "fiber", label: "Fiber", unit: "g", dec: 0, group: "macro" },
  { k: "vitc", label: "Vitamin C", unit: "mg", dec: 0, group: "micro" },
  { k: "vitd", label: "Vitamin D", unit: "\u00B5g", dec: 1, group: "micro" },
  { k: "vita", label: "Vitamin A", unit: "\u00B5g", dec: 0, group: "micro" },
  { k: "vitk", label: "Vitamin K", unit: "\u00B5g", dec: 0, group: "micro" },
  { k: "b12", label: "Vitamin B12", unit: "\u00B5g", dec: 1, group: "micro" },
  { k: "folate", label: "Folate", unit: "\u00B5g", dec: 0, group: "micro" },
  { k: "iron", label: "Iron", unit: "mg", dec: 1, group: "micro" },
  { k: "calcium", label: "Calcium", unit: "mg", dec: 0, group: "micro" },
  { k: "magnesium", label: "Magnesium", unit: "mg", dec: 0, group: "micro" },
  { k: "zinc", label: "Zinc", unit: "mg", dec: 1, group: "micro" },
  { k: "potassium", label: "Potassium", unit: "mg", dec: 0, group: "micro" },
  { k: "omega3", label: "Omega-3", unit: "g", dec: 1, group: "micro" },
  { k: "sodium", label: "Sodium", unit: "mg", dec: 0, group: "micro", limit: true },
];
const NUT_KEYS = NUTRIENTS.map((n) => n.k);

const fmt = (val, dec) => {
  const v = Number(val) || 0;
  if (dec === 0) return Math.round(v).toLocaleString();
  const r = Math.round(v * 10) / 10;
  return r.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
};

/* ---------------------------------------------------------------------------
   Goal math — Mifflin-St Jeor + RDAs, tuned by profile.
--------------------------------------------------------------------------- */
function computeGoals(p) {
  const kg = (Number(p.weightLb) || 160) / 2.2046226;
  const cm = ((Number(p.heightFt) || 5) * 12 + (Number(p.heightIn) || 0)) * 2.54;
  const age = Number(p.age) || 30;
  const male = p.sex === "male";

  const s = male ? 5 : p.sex === "female" ? -161 : -78; // 'other' splits the difference
  let bmr = 10 * kg + 6.25 * cm - 5 * age + s;

  const act = { sedentary: 1.2, light: 1.375, moderate: 1.55, very: 1.725, athlete: 1.9 }[p.activity] || 1.375;
  let cal = bmr * act;

  if (p.goal === "loss") cal *= 0.85;
  else if (p.goal === "gain") cal *= 1.12;
  const floor = male ? 1500 : p.sex === "female" ? 1200 : 1300;
  cal = Math.max(cal, floor);

  const perKg = { loss: 1.6, maintenance: 1.0, gain: 1.9, general: 1.0, longevity: 1.2, skin: 1.3 }[p.goal] || 1.1;
  const protein = perKg * kg;

  const carbs = (cal * 0.45) / 4;
  const fat = (cal * 0.30) / 9;
  const fiber = (14 * cal) / 1000;

  // micronutrient RDAs
  const base = male
    ? { vitc: 90, vitd: age > 70 ? 20 : 15, vita: 900, vitk: 120, b12: 2.4, folate: 400,
        iron: 8, calcium: age > 70 ? 1200 : 1000, magnesium: age > 30 ? 420 : 400, zinc: 11,
        potassium: 3400, omega3: 1.6, sodium: 2300 }
    : { vitc: 75, vitd: age > 70 ? 20 : 15, vita: 700, vitk: 90, b12: 2.4, folate: 400,
        iron: age > 50 ? 8 : 18, calcium: age > 50 ? 1200 : 1000, magnesium: age > 30 ? 320 : 310,
        zinc: 8, potassium: 2600, omega3: 1.1, sodium: 2300 };

  if (p.diet === "vegetarian" || p.diet === "vegan") base.iron = Math.round(base.iron * 1.8);
  if (p.goal === "skin") base.vitc = Math.round(base.vitc * 1.25);
  if (p.goal === "longevity") {
    base.potassium = Math.round(base.potassium * 1.05);
    base.omega3 = Math.round(base.omega3 * 1.15 * 10) / 10;
  }

  const water = Math.round((kg * 35) / 100) / 10; // liters, 1 decimal

  return {
    cal: Math.round(cal), protein: Math.round(protein), carbs: Math.round(carbs),
    fat: Math.round(fat), fiber: Math.round(fiber), ...base, water,
  };
}

/* status of a value against its goal */
function statusOf(value, goal, isLimit) {
  const r = goal > 0 ? value / goal : 0;
  if (isLimit) {
    if (r <= 0.8) return "met";
    if (r <= 1.0) return "near";
    return "low"; // over-limit is a warning
  }
  if (r >= 0.9) return "met";
  if (r >= 0.5) return "near";
  return "low";
}
const STATUS = {
  met: { color: C.green, soft: C.greenSoft, label: "On track" },
  near: { color: C.amber, soft: C.amberSoft, label: "Getting there" },
  low: { color: C.clay, soft: C.claySoft, label: "Needs work" },
};

/* status meta for the coach's Q&A bulleted feedback (good/watch/gap/tip) */
const COACH_META = {
  good: { Icon: CheckCircle2, color: C.green },
  watch: { Icon: AlertCircle, color: C.amber },
  gap: { Icon: AlertTriangle, color: C.clay },
  tip: { Icon: Sparkles, color: C.beet },
};

/* the four-section feedback layout: Strengths / Opportunities / Recommendations / Easy wins */
const REPORT_META = {
  strengths: { title: "Strengths", Icon: CheckCircle2, color: C.green },
  opportunities: { title: "Opportunities", Icon: AlertTriangle, color: C.amber },
  recommendations: { title: "Recommendations", Icon: Sparkles, color: C.beet },
  easyWins: { title: "Easy wins", Icon: Zap, color: C.green },
};

/* ---------------------------------------------------------------------------
   Model calls — routed through the /api/estimate serverless proxy.
--------------------------------------------------------------------------- */
async function post(extra) {
  let res;
  try {
    res = await fetch("/api/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(extra),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  const raw = await res.text();
  let data = null;
  if (raw) { try { data = JSON.parse(raw); } catch { /* non-JSON body */ } }
  if (!res.ok) {
    const msg = (data && data.error) ||
      (res.status === 504 ? "The request timed out. Try a shorter entry." :
       "The estimator didn't respond (" + res.status + "). Check the API key and Vercel logs.");
    throw new Error(msg);
  }
  if (!data) throw new Error("The estimator returned an empty response. Give it another try.");
  return data;
}

// Prose responses (coach + interpretation)
async function callClaude(system, user) {
  const data = await post({ system, user });
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  if (!text) throw new Error("The estimator sent nothing back. Try again.");
  return text;
}

// Structured responses — the model is forced to call a tool, so the API returns
// schema-valid JSON in block.input. Nothing to hand-parse, nothing to truncate.
async function callClaudeTool(system, user, tool, model) {
  const data = await post({
    system, user, model, max_tokens: 3000,
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
  });
  const block = (data.content || []).find((b) => b.type === "tool_use");
  if (!block || !block.input) throw new Error("The estimator didn't return a usable result. Try again.");
  return block.input;
}
const NUM = { type: "number" };
const FOODS_TOOL = {
  name: "log_foods",
  description: "Record each food or drink the user ate with estimated nutrition values.",
  input_schema: {
    type: "object",
    properties: {
      foods: {
        type: "array",
        description: "One entry per distinct food or drink mentioned.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Short food name, e.g. 'Egg bagel sandwich'." },
            portion: { type: "string", description: "Portion actually eaten, e.g. '1 sandwich', '12 oz'." },
            cal: NUM, protein: NUM, carbs: NUM, fat: NUM, fiber: NUM,
            vitc: NUM, vitd: NUM, vita: NUM, vitk: NUM, b12: NUM, folate: NUM,
            iron: NUM, calcium: NUM, magnesium: NUM, zinc: NUM, potassium: NUM,
            omega3: NUM, sodium: NUM,
            assumed: { type: "boolean", description: "True if the portion was assumed rather than stated." },
            note: { type: "string", description: "Brief note, e.g. why a portion was assumed. Empty string if none." },
          },
          required: ["name", "portion", ...NUT_KEYS, "assumed"],
        },
      },
    },
    required: ["foods"],
  },
};

const PARSE_SYS =
  "You are a precise nutrition estimation engine. The user describes, in free text, food they ate. " +
  "Call the log_foods tool with one entry per distinct food or drink. " +
  "Units: cal=kcal; protein,carbs,fat,fiber,omega3=grams; vitc,iron,calcium,magnesium,zinc,potassium,sodium=milligrams; " +
  "vitd,vita,vitk,b12,folate=micrograms. Give every nutrient a realistic numeric estimate (0 if truly none). " +
  "Split combined dishes into named components only when the user names them. If a portion isn't stated, assume one " +
  "typical serving and set assumed=true with a brief note.";

async function parseFoods(text) {
  const obj = await callClaudeTool(PARSE_SYS, text, FOODS_TOOL, "claude-haiku-4-5");
  const foods = Array.isArray(obj.foods) ? obj.foods : [];
  return foods.map((f, i) => {
    const clean = { id: Date.now() + "-" + i, name: f.name || "Food", portion: f.portion || "",
      assumed: !!f.assumed, note: f.note || "" };
    NUT_KEYS.forEach((k) => (clean[k] = Number(f[k]) || 0));
    return clean;
  });
}

/* ---------------------------------------------------------------------------
   Small UI atoms
--------------------------------------------------------------------------- */
function Bar({ pct, color, limit }) {
  const w = Math.min(100, Math.max(0, pct));
  return (
    <div style={{ position: "relative", height: 10, background: C.barTrack, borderRadius: 999 }}>
      <div className="nc-bar" style={{ width: w + "%", height: "100%", background: color, borderRadius: 999 }} />
      {/* target notch at 100% */}
      <div style={{ position: "absolute", right: 0, top: -3, height: 16, width: 2,
        background: limit ? C.clay : C.ink, opacity: 0.35, borderRadius: 2 }} />
    </div>
  );
}

function NutrientRow({ n, value, goal }) {
  const st = statusOf(value, goal, n.limit);
  const s = STATUS[st];
  const pct = goal > 0 ? (value / goal) * 100 : 0;
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid " + C.line }}>
      <div className="nc-between" style={{ marginBottom: 6 }}>
        <span style={{ fontWeight: 600, color: C.ink, fontSize: 14 }}>
          {n.label}{n.limit && <span style={{ color: C.muted, fontWeight: 400 }}> (limit)</span>}
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: s.color }}>
          {fmt(value, n.dec)}<span style={{ color: C.muted }}> / {fmt(goal, n.dec)} {n.unit}</span>
        </span>
      </div>
      <Bar pct={pct} color={s.color} limit={n.limit} />
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Profile / advanced settings
--------------------------------------------------------------------------- */
const ACTIVITY = [
  ["sedentary", "Sedentary", "desk job, little exercise"],
  ["light", "Lightly active", "1–3 workouts / week"],
  ["moderate", "Moderately active", "3–5 workouts / week"],
  ["very", "Very active", "6–7 workouts / week"],
  ["athlete", "Athlete", "twice-daily / physical job"],
];
const GOALS = [
  ["loss", "Weight loss"], ["maintenance", "Maintenance"], ["gain", "Muscle gain"],
  ["general", "General health"], ["longevity", "Longevity"], ["skin", "Skin / collagen"],
];
const DIETS = [["omnivore", "Omnivore"], ["pescatarian", "Pescatarian"], ["vegetarian", "Vegetarian"], ["vegan", "Vegan"]];

function Pill({ active, children, onClick }) {
  return (
    <button onClick={onClick} className="nc-pill"
      style={{
        border: "1px solid " + (active ? C.beet : C.line),
        background: active ? C.beet : C.card,
        color: active ? "#fff" : C.ink2,
      }}>
      {children}
    </button>
  );
}

function ProfileForm({ initial, onSave }) {
  const [p, setP] = useState(initial);
  const set = (k, v) => setP((s) => ({ ...s, [k]: v }));
  return (
    <div>
      <p style={{ color: C.muted, fontSize: 13, margin: "2px 0 16px", lineHeight: 1.5 }}>
        Your targets start from general adult values. Adjust these to fit you, then save to update your chart and coach.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Field label="Age">
          <input inputMode="numeric" value={p.age} onChange={(e) => set("age", e.target.value.replace(/\D/g, ""))}
            placeholder="30" style={{ ...inputStyle, width: 88 }} />
        </Field>
        <Field label="Weight">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input inputMode="numeric" value={p.weightLb} onChange={(e) => set("weightLb", e.target.value.replace(/\D/g, ""))}
              placeholder="160" style={{ ...inputStyle, width: 84 }} />
            <span style={{ color: C.muted, fontSize: 14 }}>lb</span>
          </div>
        </Field>
        <Field label="Height">
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <input inputMode="numeric" value={p.heightFt} onChange={(e) => set("heightFt", e.target.value.replace(/\D/g, ""))}
                style={{ ...inputStyle, width: 56 }} />
              <span style={{ color: C.muted, fontSize: 14 }}>ft</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <input inputMode="numeric" value={p.heightIn} onChange={(e) => set("heightIn", e.target.value.replace(/\D/g, ""))}
                style={{ ...inputStyle, width: 56 }} />
              <span style={{ color: C.muted, fontSize: 14 }}>in</span>
            </div>
          </div>
        </Field>
      </div>

      <Field label="Sex (for nutrient targets)">
        <div className="nc-wrap">
          {[["female", "Female"], ["male", "Male"], ["other", "Other"]].map(([v, l]) => (
            <Pill key={v} active={p.sex === v} onClick={() => set("sex", v)}>{l}</Pill>
          ))}
        </div>
      </Field>

      <Field label="Activity level">
        <div className="nc-wrap">
          {ACTIVITY.map(([v, l]) => <Pill key={v} active={p.activity === v} onClick={() => set("activity", v)}>{l}</Pill>)}
        </div>
      </Field>

      <Field label="Main goal">
        <div className="nc-wrap">
          {GOALS.map(([v, l]) => <Pill key={v} active={p.goal === v} onClick={() => set("goal", v)}>{l}</Pill>)}
        </div>
      </Field>

      <Field label="Dietary pattern">
        <div className="nc-wrap">
          {DIETS.map(([v, l]) => <Pill key={v} active={p.diet === v} onClick={() => set("diet", v)}>{l}</Pill>)}
        </div>
      </Field>

      <Field label="Allergies or preferences (optional)">
        <input value={p.allergies} onChange={(e) => set("allergies", e.target.value)}
          placeholder="e.g. no dairy, dislikes cilantro" style={inputStyle} />
      </Field>

      <button onClick={() => onSave(p)} className="nc-cta" style={{ background: C.beet, marginTop: 4 }}>
        Save settings
      </button>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "11px 13px", borderRadius: 11, border: "1px solid " + C.line,
  fontSize: 15, fontFamily: FONT_UI, color: C.ink, outline: "none", background: C.card,
};
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.ink2, marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Food breakdown table (nutritionist style)
--------------------------------------------------------------------------- */
const TABLE_COLS = [
  { k: "cal", label: "Cal" }, { k: "protein", label: "Protein" }, { k: "fiber", label: "Fiber" },
  { k: "iron", label: "Iron" }, { k: "vitc", label: "Vit C" }, { k: "calcium", label: "Calcium" },
];

/* every number in the table carries its unit — no bare digits */
function withUnit(value, meta) {
  return fmt(value, meta.dec) + (meta.unit ? "\u2009" + meta.unit : "");
}

function FoodTable({ foods, totals, goals, onHalve, onRemove }) {
  const cell = { padding: "9px 10px", fontFamily: FONT_MONO, fontSize: 12.5, whiteSpace: "nowrap", textAlign: "right" };
  const head = { padding: "9px 10px", fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: C.muted, textAlign: "right", fontWeight: 600 };
  const stick = { position: "sticky", left: 0, background: C.card, zIndex: 1 };
  return (
    <div style={{ overflowX: "auto", border: "1px solid " + C.line, borderRadius: 14, WebkitOverflowScrolling: "touch" }}>
      <table style={{ borderCollapse: "collapse", minWidth: 600, width: "100%" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid " + C.line, background: C.tableHead }}>
            <th style={{ ...head, ...stick, textAlign: "left", background: C.tableHead }}>Food</th>
            {TABLE_COLS.map((c) => <th key={c.k} style={head}>{c.label}</th>)}
            <th style={head}></th>
          </tr>
        </thead>
        <tbody>
          {foods.map((f) => (
            <tr key={f.id} style={{ borderBottom: "1px solid " + C.line }}>
              <td style={{ padding: "9px 10px", ...stick, textAlign: "left", maxWidth: 200 }}>
                <div style={{ fontWeight: 600, color: C.ink, fontSize: 13.5, fontFamily: FONT_UI }}>{f.name}</div>
                <div style={{ color: C.muted, fontSize: 11.5, fontFamily: FONT_UI }}>
                  {f.portion}{f.assumed && <span style={{ color: C.amber, fontWeight: 600 }}> · est.</span>}
                </div>
              </td>
              {TABLE_COLS.map((c) => {
                const meta = NUTRIENTS.find((n) => n.k === c.k);
                return <td key={c.k} style={{ ...cell, color: C.ink2 }}>{withUnit(f[c.k], meta)}</td>;
              })}
              <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                <button onClick={() => onHalve(f.id)} title="Halve this portion" className="nc-mini"
                  style={{ color: C.ink2 }}>&frac12;</button>
                <button onClick={() => onRemove(f.id)} title="Remove" className="nc-mini" style={{ color: C.clay }}>
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}

          {/* daily total — the important row: bold, colored per nutrient, with % of goal */}
          <tr style={{ borderTop: "3px solid " + C.beet, background: C.tableHead }}>
            <td style={{ padding: "12px 10px", ...stick, background: C.tableHead, fontWeight: 800, color: C.ink, fontFamily: FONT_UI, fontSize: 14 }}>
              Daily total
            </td>
            {TABLE_COLS.map((c) => {
              const meta = NUTRIENTS.find((n) => n.k === c.k);
              const st = statusOf(totals[c.k], goals[c.k], meta.limit);
              const pct = goals[c.k] > 0 ? Math.round((totals[c.k] / goals[c.k]) * 100) : 0;
              return (
                <td key={c.k} style={{ padding: "12px 10px", textAlign: "right" }}>
                  <div style={{ fontFamily: FONT_MONO, fontWeight: 800, fontSize: 14, color: STATUS[st].color }}>
                    {withUnit(totals[c.k], meta)}
                  </div>
                  <div style={{ fontFamily: FONT_MONO, fontWeight: 600, fontSize: 10.5, color: STATUS[st].color, opacity: 0.85 }}>
                    {pct}% of goal
                  </div>
                </td>
              );
            })}
            <td />
          </tr>
          <tr style={{ background: C.tableHead }}>
            <td style={{ padding: "7px 10px", ...stick, background: C.tableHead, color: C.muted, fontFamily: FONT_UI, fontSize: 12 }}>Your goal</td>
            {TABLE_COLS.map((c) => {
              const meta = NUTRIENTS.find((n) => n.k === c.k);
              return <td key={c.k} style={{ ...cell, color: C.muted, fontSize: 11.5 }}>{withUnit(goals[c.k], meta)}</td>;
            })}
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Coach (recommendations + Q&A) — structured, bulleted output via tool-calling.
--------------------------------------------------------------------------- */
const REPORT_TOOL = {
  name: "nutrition_feedback",
  description: "Give the user structured nutrition feedback in four labeled sections.",
  input_schema: {
    type: "object",
    properties: {
      strengths: {
        type: "array", items: { type: "string" },
        description: "Nutrients they're hitting well and which logged food(s) delivered them. Empty array if genuinely none yet.",
      },
      opportunities: {
        type: "array", items: { type: "string" },
        description: "Nutrients that are falling short of today's goal.",
      },
      recommendations: {
        type: "array", items: { type: "string" },
        description: "Specific foods or simple meals that would improve balance across the gaps, may combine multiple nutrients.",
      },
      easyWins: {
        type: "array", items: { type: "string" },
        description: "The single simplest additions — one food each — for the biggest gaps. Every item MUST state an approximate quantified nutrient contribution using the real numbers in 'stillNeeded', e.g. 'One orange adds about 70mg vitamin C, covering most of your remaining goal.' Never a vague suggestion without a number.",
      },
    },
    required: ["strengths", "opportunities", "recommendations", "easyWins"],
  },
};

const INTERP_SYS =
  "You are a warm nutrition coach giving quick feedback on the user's day so far. Call the nutrition_feedback tool. " +
  "Keep it brief: strengths 1-2 items, opportunities 1-2 items, recommendations 1-2 items, easyWins 1-2 items " +
  "(each a single simple food with a quantified nutrient contribution computed from the 'stillNeeded' values given). " +
  "Reference their actual logged foods. Arrays can be empty if there's genuinely nothing to say yet. No medical claims.";

const SUMMARY_SYS =
  "You are a warm nutrition coach writing a full end-of-day report. Call the nutrition_feedback tool using the " +
  "user's real logged foods, targets and gaps. strengths 2-3 items, opportunities 2-3 items, recommendations 2-3 " +
  "items, easyWins 2-3 items (each a single simple food with a quantified nutrient contribution computed from the " +
  "'stillNeeded' values given, e.g. 'One orange adds about 70mg vitamin C.'). Reference actual foods. Plain text " +
  "only, no markdown. No medical claims.";

const COACH_TOOL = {
  name: "coach_feedback",
  description: "Give the user structured, bulleted nutrition feedback.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "One short conversational lead-in sentence. Empty string if not needed." },
      points: {
        type: "array",
        description: "2-4 concise bullet points.",
        items: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["good", "watch", "gap", "tip"],
              description: "good=doing well; watch=borderline/near goal; gap=a shortfall; tip=a specific food or action suggestion." },
            text: { type: "string", description: "One concise line, plain text, no markdown. Reference actual logged foods. For 'tip' points suggesting a food, include nutrient deltas in parentheses, e.g. '(+12g fiber, +40mg vitamin C)'." },
          },
          required: ["status", "text"],
        },
      },
    },
    required: ["points"],
  },
};

const COACH_SYS =
  "You are a warm, concise nutrition coach in the style of a registered dietitian, answering the user's question " +
  "about their real logged foods and remaining nutrient gaps today. Call the coach_feedback tool. summary: a direct " +
  "one-sentence answer. points: 2-4 items, mostly status 'tip' with specific foods or simple meals (include nutrient " +
  "deltas in parentheses, e.g. '(+12g fiber, +40mg vitamin C)'); use 'good'/'watch'/'gap' only to explain context. " +
  "At most 3 'tip' suggestions. Respect their dietary pattern and allergies. Reference actual foods and gaps — never " +
  "generic advice. No medical claims.";

function buildContext(goals, totals, foods, profile) {
  const gaps = {};
  NUTRIENTS.forEach((n) => {
    const remaining = Math.max(0, goals[n.k] - totals[n.k]);
    gaps[n.k] = Math.round(remaining * 10) / 10;
  });
  return JSON.stringify({
    diet: profile.diet,
    allergies: profile.allergies || "none",
    goal: profile.goal,
    caloriesRemaining: Math.max(0, goals.cal - totals.cal),
    targets: goals,
    consumed: Object.fromEntries(NUT_KEYS.map((k) => [k, Math.round(totals[k] * 10) / 10])),
    stillNeeded: gaps,
    foodsLogged: foods.map((f) => f.name),
  });
}

const QUICK = [
  "What should I eat next?",
  "How do I hit my fiber goal?",
  "High-iron, low-calorie ideas",
  "Best food for my biggest gap",
];

/* ---------------------------------------------------------------------------
   Main app
--------------------------------------------------------------------------- */
const DEFAULT_PROFILE = {
  age: "30", sex: "other", heightFt: "5", heightIn: "8", weightLb: "160",
  activity: "light", goal: "general", diet: "omnivore", allergies: "",
};

export default function App() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [showSettings, setShowSettings] = useState(false);
  const [foods, setFoods] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [interpretation, setInterpretation] = useState(null); // {summary, points} | null
  const [thread, setThread] = useState([]); // {role:'user', text} | {role:'coach', data:{summary, points}}
  const [coachBusy, setCoachBusy] = useState(false);
  const [report, setReport] = useState(null); // {strengths, gaps, tomorrow} | null
  const [reportBusy, setReportBusy] = useState(false);
  const [water, setWater] = useState(0); // cups (240ml)
  const [listening, setListening] = useState(false);
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" && window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const recRef = useRef(null);
  const threadEndRef = useRef(null);

  // goals only recompute when profile is explicitly saved (see ProfileForm's Save button)
  const goals = useMemo(() => computeGoals(profile), [profile]);
  const [justSaved, setJustSaved] = useState(false);
  function saveProfile(next) {
    setProfile(next);
    setShowSettings(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  }

  const totals = useMemo(() => {
    const t = Object.fromEntries(NUT_KEYS.map((k) => [k, 0]));
    foods.forEach((f) => NUT_KEYS.forEach((k) => (t[k] += Number(f[k]) || 0)));
    return t;
  }, [foods]);

  const waterL = Math.round((water * 0.24) * 10) / 10;

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [thread, coachBusy]);

  /* speech — browsers silently end a recognition session after a pause even
     with continuous=true, so we auto-restart until the user taps the mic off. */
  const speechOK = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const manualStopRef = useRef(false);
  const baseTextRef = useRef("");   // text already in the box before the mic started
  const finalRef = useRef("");      // finalized speech accumulated across restarts

  function startRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalRef.current += chunk + " ";
        else interim += chunk;
      }
      setText((baseTextRef.current + finalRef.current + interim).replace(/\s+/g, " "));
    };

    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return; // let onend restart it
      manualStopRef.current = true;
      setListening(false);
      setErr(e.error === "not-allowed"
        ? "Microphone access was blocked — allow it in your browser's site settings, or type instead."
        : "Voice input hit a snag — type your foods instead.");
    };

    rec.onend = () => {
      if (manualStopRef.current) { setListening(false); return; }
      try { rec.start(); } catch { setListening(false); } // keep going through pauses
    };

    recRef.current = rec;
    rec.start();
  }

  function toggleMic() {
    if (!speechOK) return;
    if (listening) {
      manualStopRef.current = true;
      recRef.current?.stop();
      setListening(false);
      return;
    }
    manualStopRef.current = false;
    baseTextRef.current = text ? text + " " : "";
    finalRef.current = "";
    setErr("");
    try { startRecognition(); setListening(true); }
    catch { setErr("Couldn't start the mic — type your foods instead."); }
  }

  async function analyze() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true); setErr("");
    if (listening) { manualStopRef.current = true; recRef.current?.stop(); setListening(false); }
    try {
      const parsed = await parseFoods(t);
      if (!parsed.length) { setErr("I couldn't pick out any foods there. Try naming what you ate."); setBusy(false); return; }
      const next = [...foods, ...parsed];
      setFoods(next);
      setText("");
      setReport(null);
      // fresh interpretation off the full day
      await runInterpretation(next);
    } catch (e) {
      setErr(e.message || "Something went wrong estimating that.");
    } finally { setBusy(false); }
  }

  async function runInterpretation(list) {
    try {
      const t = Object.fromEntries(NUT_KEYS.map((k) => [k, 0]));
      list.forEach((f) => NUT_KEYS.forEach((k) => (t[k] += Number(f[k]) || 0)));
      const ctx = buildContext(goals, t, list, profile);
      const obj = await callClaudeTool(INTERP_SYS, ctx, REPORT_TOOL);
      setInterpretation(obj);
    } catch { /* interpretation is best-effort */ }
  }

  async function askCoach(q) {
    if (!q.trim() || coachBusy) return;
    setThread((th) => [...th, { role: "user", text: q }]);
    setCoachBusy(true);
    try {
      const ctx = buildContext(goals, totals, foods, profile) + "\n\nUser question: " + q;
      const obj = await callClaudeTool(COACH_SYS, ctx, COACH_TOOL);
      setThread((th) => [...th, { role: "coach", data: obj }]);
    } catch (e) {
      setThread((th) => [...th, { role: "coach",
        data: { summary: e.message || "I couldn't reach the coach just now — try again.", points: [] } }]);
    } finally { setCoachBusy(false); }
  }

  async function makeReport() {
    if (reportBusy || !foods.length) return;
    setReportBusy(true);
    try {
      const ctx = buildContext(goals, totals, foods, profile);
      const obj = await callClaudeTool(SUMMARY_SYS, ctx, REPORT_TOOL);
      setReport(obj);
    } catch (e) {
      setReport({ strengths: [], opportunities: [], recommendations: [], easyWins: [e.message || "Couldn't build the report — try again."] });
    } finally { setReportBusy(false); }
  }

  function halve(id) {
    setFoods((fs) => fs.map((f) => (f.id === id ? { ...f, portion: (f.portion || "") + " (\u00BD)", ...Object.fromEntries(NUT_KEYS.map((k) => [k, f[k] / 2])) } : f)));
    setReport(null);
  }
  function remove(id) { setFoods((fs) => fs.filter((f) => f.id !== id)); setReport(null); }
  function resetDay() { setFoods([]); setInterpretation(null); setThread([]); setReport(null); setWater(0); }

  const macros = NUTRIENTS.filter((n) => n.group === "macro");
  const micros = NUTRIENTS.filter((n) => n.group === "micro");
  const empty = foods.length === 0;

  return (
    <div data-theme={dark ? "dark" : "light"} style={{ background: C.paper, minHeight: "100vh", fontFamily: FONT_UI, color: C.ink }}>
      <StyleTag />
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "22px 16px 80px" }}>

        {/* header */}
        <div className="nc-between" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Salad size={20} color={C.beet} />
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: C.ink }}>Plate&nbsp;Notes</span>
            {!empty && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, background: C.tableHead,
                border: "1px solid " + C.line, borderRadius: 999, padding: "3px 9px" }}>
                {foods.length} logged
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setDark((d) => !d)} className="nc-ghost" title={dark ? "Switch to light mode" : "Switch to dark mode"}>
              {dark ? <Sun size={13} /> : <Moon size={13} />} {dark ? "Light" : "Dark"}
            </button>
            <button onClick={resetDay} className="nc-ghost" title="Start a new day">
              <RotateCcw size={13} /> New day
            </button>
          </div>
        </div>

        {/* input card — the star */}
        <div style={{ background: C.card, border: "1px solid " + C.line, borderRadius: 18, padding: 16, boxShadow: "var(--shadow-card)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: C.muted }}>
              {empty ? "Tell me what you ate" : "Add more to today"}
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={empty
              ? "Just talk it through — e.g. \u201cEgg bagel with feta, mayo and sriracha, a latte with whole milk, then a salmon snack pack and a bag of chips.\u201d"
              : "Forgot something? Add it here — e.g. \u201coh, and a handful of almonds.\u201d"}
            rows={4}
            style={{ width: "100%", border: "none", outline: "none", resize: "vertical", fontSize: 15.5,
              lineHeight: 1.5, fontFamily: FONT_UI, color: C.ink, background: "transparent" }}
          />
          <div className="nc-between" style={{ marginTop: 8 }}>
            <button onClick={toggleMic} disabled={!speechOK} className="nc-mic"
              title={speechOK ? "Speak your foods" : "Voice input isn't available here"}
              style={{ color: listening ? "#fff" : speechOK ? C.ink2 : C.micDisabled,
                background: listening ? C.beet : C.card, borderColor: listening ? C.beet : C.line }}>
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
              {listening ? "Listening\u2026" : "Speak"}
            </button>
            <button onClick={analyze} disabled={busy || !text.trim()} className="nc-cta-sm"
              style={{ background: busy || !text.trim() ? C.disabled : C.beet }}>
              {busy ? <Loader2 size={16} className="nc-spin" /> : <Sparkles size={16} />}
              {busy ? "Estimating\u2026" : empty ? "Estimate nutrients" : "Add to today's log"}
            </button>
          </div>
          {err && (
            <div style={{ marginTop: 10, display: "flex", gap: 7, alignItems: "flex-start", color: C.clay, fontSize: 13 }}>
              <AlertTriangle size={15} style={{ marginTop: 1, flexShrink: 0 }} /> <span>{err}</span>
            </div>
          )}

          {/* advanced settings — collapsed by default */}
          <div style={{ marginTop: 12, borderTop: "1px solid " + C.line, paddingTop: 12 }}>
            <button onClick={() => setShowSettings((s) => !s)} className="nc-disclosure"
              aria-expanded={showSettings}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <SlidersHorizontal size={15} color={C.ink2} />
                <span style={{ fontWeight: 600, fontSize: 13.5, color: C.ink }}>Advanced settings</span>
                <span style={{ color: C.muted, fontWeight: 400, fontSize: 12.5 }}>
                  · {goals.cal} kcal · {goals.protein}g protein · {goals.fiber}g fiber
                </span>
              </span>
              <ChevronDown size={16} color={C.muted}
                style={{ transform: showSettings ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
            </button>
            {justSaved && !showSettings && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, color: C.green, fontSize: 12.5, fontWeight: 600 }}>
                <Check size={14} /> Targets updated
              </div>
            )}
            {showSettings && (
              <div style={{ marginTop: 14 }}>
                <ProfileForm initial={profile} onSave={saveProfile} />
              </div>
            )}
          </div>
        </div>

        {empty ? (
          <div style={{ textAlign: "center", padding: "44px 20px", color: C.muted }}>
            <Utensils size={26} color={C.line} />
            <p style={{ marginTop: 10, fontSize: 14.5 }}>Nothing logged yet. Describe your first meal above and I&apos;ll chart it.</p>
          </div>
        ) : (
          <>
            {/* coach interpretation — Strengths / Opportunities / Recommendations / Easy wins */}
            {interpretation && <ReportCard data={interpretation} label="Coach" />}

            {/* food table — right below the coach, per how you actually use this */}
            <SectionTitle>What you ate</SectionTitle>
            <FoodTable foods={foods} totals={totals} goals={goals} onHalve={halve} onRemove={remove} />
            <p style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>
              Tap &frac12; to halve a portion or the trash icon to remove it. Items marked &ldquo;est.&rdquo;
              assumed a typical serving — tell me the real portion above and I&apos;ll fold it in.
            </p>

            {/* today's chart — signature */}
            <SectionTitle>Today&apos;s chart</SectionTitle>
            <div style={{ background: C.card, border: "1px solid " + C.line, borderRadius: 18, padding: "6px 16px 14px" }}>
              <GroupLabel>Macros</GroupLabel>
              {macros.map((n) => <NutrientRow key={n.k} n={n} value={totals[n.k]} goal={goals[n.k]} />)}
              <GroupLabel style={{ marginTop: 14 }}>Vitamins &amp; minerals</GroupLabel>
              {micros.map((n) => <NutrientRow key={n.k} n={n} value={totals[n.k]} goal={goals[n.k]} />)}

              {/* water */}
              <div className="nc-between" style={{ paddingTop: 14, marginTop: 4 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 600, fontSize: 14, color: C.ink }}>
                  <Droplet size={15} color={C.green} /> Water
                  <span style={{ fontFamily: FONT_MONO, fontWeight: 400, fontSize: 12.5, color: C.muted }}>
                    {waterL} / {goals.water} L
                  </span>
                </span>
                <span style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setWater((w) => Math.max(0, w - 1))} className="nc-mini" style={{ color: C.ink2 }}><Minus size={13} /></button>
                  <button onClick={() => setWater((w) => w + 1)} className="nc-mini" style={{ color: C.green }}><Plus size={13} /></button>
                </span>
              </div>
            </div>

            {/* coach Q&A */}
            <SectionTitle>Ask your coach</SectionTitle>
            <div style={{ background: C.card, border: "1px solid " + C.line, borderRadius: 18, padding: 14 }}>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: thread.length ? 14 : 4 }}>
                {QUICK.map((q) => (
                  <button key={q} onClick={() => askCoach(q)} disabled={coachBusy} className="nc-chip">{q}</button>
                ))}
              </div>

              {thread.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}>
                  <div style={{
                    maxWidth: "86%", padding: "10px 13px", borderRadius: 14, fontSize: 14, lineHeight: 1.5,
                    background: m.role === "user" ? C.strong : C.beetSoft,
                    color: m.role === "user" ? "#fff" : C.ink,
                    borderTopRightRadius: m.role === "user" ? 4 : 14,
                    borderTopLeftRadius: m.role === "user" ? 14 : 4,
                  }}>
                    {m.role === "user"
                      ? <span style={{ whiteSpace: "pre-wrap" }}>{m.text}</span>
                      : <CoachPoints summary={m.data.summary} points={m.data.points} compact />}
                  </div>
                </div>
              ))}
              {coachBusy && (
                <div style={{ display: "flex", gap: 6, alignItems: "center", color: C.muted, fontSize: 13, padding: "4px 2px" }}>
                  <Loader2 size={14} className="nc-spin" /> thinking about your day…
                </div>
              )}
              <div ref={threadEndRef} />

              <CoachInput onSend={askCoach} busy={coachBusy} />
            </div>

            {/* daily report — structured, labeled sections */}
            <SectionTitle>End-of-day report</SectionTitle>
            {report ? (
              <ReportCard data={report} />
            ) : (
              <button onClick={makeReport} disabled={reportBusy} className="nc-report"
                style={{ borderColor: C.line }}>
                {reportBusy ? <Loader2 size={16} className="nc-spin" /> : <Sparkles size={16} color={C.beet} />}
                {reportBusy ? "Writing your report…" : "Generate today's report"}
              </button>
            )}

            <p style={{ color: C.muted, fontSize: 11.5, marginTop: 22, textAlign: "center", lineHeight: 1.5 }}>
              All values are AI estimates for general wellness, not medical or dietary advice.
              Targets are approximations from your profile.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Sub-components + styles
--------------------------------------------------------------------------- */
function CoachInput({ onSend, busy }) {
  const [v, setV] = useState("");
  const send = () => { if (v.trim() && !busy) { onSend(v.trim()); setV(""); } };
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
      <input
        value={v} onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") send(); }}
        placeholder="Ask anything — e.g. foods for collagen support"
        style={{ ...inputStyle, flex: 1 }}
      />
      <button onClick={send} disabled={busy || !v.trim()} className="nc-send"
        style={{ background: busy || !v.trim() ? C.disabled : C.beet }}>
        <Send size={16} />
      </button>
    </div>
  );
}

function CoachCard({ children, label = "Coach" }) {
  return (
    <div style={{ background: C.beetSoft, border: "1px solid " + C.beetSoftBorder, borderRadius: 18, padding: 16, marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <Sparkles size={14} color={C.beet} />
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: C.beet }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

/* Structured, bulleted coach feedback — checkmarks for wins, warnings for gaps,
   sparkles for suggestions. Used for the interpretation card and Q&A replies. */
function CoachPoints({ summary, points, compact }) {
  const list = Array.isArray(points) ? points : [];
  return (
    <div>
      {summary && (
        <p style={{ margin: compact ? "0 0 8px" : "0 0 10px", fontSize: compact ? 14 : 14.5, lineHeight: 1.5, color: C.ink }}>{summary}</p>
      )}
      {list.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 7 }}>
          {list.map((pt, i) => {
            const meta = COACH_META[pt.status] || COACH_META.tip;
            const Icon = meta.Icon;
            return (
              <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: compact ? 13.5 : 14, lineHeight: 1.5, color: C.ink }}>
                <Icon size={15} color={meta.color} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>{pt.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* End-of-day report — three labeled, icon-coded sections. */
function ReportCard({ data, label = "Today's report" }) {
  const groups = ["strengths", "opportunities", "recommendations", "easyWins"]
    .map((key) => ({ key, ...REPORT_META[key], items: data[key] || [] }))
    .filter((g) => g.items.length > 0);
  if (!groups.length) return null;
  return (
    <CoachCard label={label}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {groups.map((g) => (
          <div key={g.key}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>
              {g.title}
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {g.items.map((text, i) => (
                <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14, lineHeight: 1.5, color: C.ink }}>
                  <g.Icon size={15} color={g.color} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </CoachCard>
  );
}
function SectionTitle({ children }) {
  return <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 19, fontWeight: 600, color: C.ink, margin: "26px 0 10px" }}>{children}</h2>;
}
function GroupLabel({ children, style }) {
  return <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: C.muted, padding: "8px 0 2px", ...style }}>{children}</div>;
}

function StyleTag() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=Space+Mono&display=swap');

      :root, [data-theme="light"] {
        --ink: #163A2E; --ink2: #2C4A3E; --strong: #163A2E;
        --paper: #FBFAF6; --card: #FFFFFF; --line: #E8E5DC; --muted: #5B6B63;
        --beet: #B23A5B; --beet-soft: #F7E9EE; --beet-soft-border: #F0D9E0;
        --green: #2E7D5B; --green-soft: #E6F1EB; --green-soft-border: #D7E6DD;
        --amber: #C08A1E; --amber-soft: #F7EED6;
        --clay: #C0492F; --clay-soft: #F7E3DD;
        --bar-track: #EFEDE5; --table-head: #FAF8F2;
        --disabled: #D9BEC7; --mic-disabled: #B9C2BC;
        --shadow-card: 0 1px 0 rgba(22,58,46,0.03);
        color-scheme: light;
      }
      [data-theme="dark"] {
        --ink: #F1EFE6; --ink2: #C4D0C9; --strong: #2C4A3E;
        --paper: #0E1B16; --card: #16261F; --line: #293A31; --muted: #8CA096;
        --beet: #DD7C97; --beet-soft: #2B1B21; --beet-soft-border: #452530;
        --green: #79C79E; --green-soft: #17291F; --green-soft-border: #274637;
        --amber: #E3B75A; --amber-soft: #2E2717;
        --clay: #E3896E; --clay-soft: #33201A;
        --bar-track: #22322A; --table-head: #1C2C24;
        --disabled: #3E2E36; --mic-disabled: #445048;
        --shadow-card: 0 1px 0 rgba(0,0,0,0.3);
        color-scheme: dark;
      }
      html, body, #root { background: var(--paper); }
      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      body { margin: 0; }
      .nc-between { display: flex; align-items: center; justify-content: space-between; }
      .nc-wrap { display: flex; flex-wrap: wrap; gap: 8px; }
      .nc-pill { padding: 8px 14px; border-radius: 999px; font-size: 13.5px; font-weight: 500; cursor: pointer; font-family: ${FONT_UI}; transition: all .15s; }
      .nc-cta { width: 100%; padding: 14px; border: none; border-radius: 13px; color: #fff; font-size: 15.5px; font-weight: 600; font-family: ${FONT_UI}; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background .15s; }
      .nc-cta-sm { padding: 10px 16px; border: none; border-radius: 11px; color: #fff; font-size: 14px; font-weight: 600; font-family: ${FONT_UI}; display: flex; align-items: center; gap: 7px; cursor: pointer; transition: background .15s; }
      .nc-cta-sm:disabled, .nc-cta:disabled, .nc-send:disabled { cursor: default; }
      .nc-mic { display: flex; align-items: center; gap: 7px; padding: 9px 15px; border-radius: 11px; border: 1px solid ${C.line}; font-size: 14px; font-weight: 600; font-family: ${FONT_UI}; cursor: pointer; transition: all .15s; }
      .nc-mic:disabled { cursor: default; }
      .nc-ghost { display: flex; align-items: center; gap: 5px; background: none; border: 1px solid ${C.line}; color: ${C.muted}; padding: 6px 11px; border-radius: 999px; font-size: 12.5px; font-family: ${FONT_UI}; cursor: pointer; transition: all .15s; }
      .nc-ghost:hover { border-color: ${C.beet}; color: ${C.beet}; }
      .nc-mini { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border: 1px solid ${C.line}; background: ${C.card}; border-radius: 8px; cursor: pointer; font-family: ${FONT_UI}; font-size: 14px; margin-left: 5px; color: ${C.ink2}; }
      .nc-chip { background: ${C.greenSoft}; border: 1px solid ${C.greenSoftBorder}; color: ${C.ink}; padding: 8px 12px; border-radius: 999px; font-size: 12.5px; font-family: ${FONT_UI}; cursor: pointer; transition: all .15s; }
      .nc-chip:disabled { opacity: .5; cursor: default; }
      .nc-send { border: none; border-radius: 11px; color: #fff; width: 46px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
      .nc-report { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; background: ${C.card}; border: 1px dashed ${C.line}; border-radius: 14px; font-size: 14.5px; font-weight: 600; color: ${C.ink}; font-family: ${FONT_UI}; cursor: pointer; }
      .nc-disclosure { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; background: none; border: none; padding: 2px 0; cursor: pointer; font-family: ${FONT_UI}; text-align: left; }
      input, textarea { color-scheme: inherit; }
      input:focus, textarea:focus { border-color: ${C.beet} !important; }
      button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid ${C.beet}; outline-offset: 1px; }
      .nc-spin { animation: nc-rot 1s linear infinite; }
      @keyframes nc-rot { to { transform: rotate(360deg); } }
      .nc-bar { transition: width .5s cubic-bezier(.4,0,.2,1); }
      @media (prefers-reduced-motion: reduce) { .nc-bar, .nc-spin { transition: none; animation: none; } }
    `}</style>
  );
}
