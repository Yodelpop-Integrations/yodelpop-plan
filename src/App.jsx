/* eslint-disable */
import { useState, useEffect } from "react";

const STAGE_ORDER = ["Setup", "Foundation", "TOFU", "MOFU", "BOFU", "DEFU", "Foundational"];
const STAGE_COLORS = {
  Setup:        { bg: "#0f1f2e", accent: "#3b9eff", label: "Setup",      desc: "Technical Configuration" },
  Foundation:   { bg: "#1a1a0f", accent: "#f5c842", label: "Foundation", desc: "Strategy & Planning" },
  Foundational: { bg: "#1a1a0f", accent: "#f5c842", label: "Foundation", desc: "Strategy & Planning" },
  TOFU:         { bg: "#0f2218", accent: "#4caf72", label: "Attract",    desc: "Top of Funnel" },
  MOFU:         { bg: "#1f1520", accent: "#b06ef3", label: "Engage",     desc: "Middle of Funnel" },
  BOFU:         { bg: "#1f150e", accent: "#f08c42", label: "Convert",    desc: "Bottom of Funnel" },
  DEFU:         { bg: "#0f1e1e", accent: "#42d4d4", label: "Delight",    desc: "Customer Stage" },
};
const TYPE_ICONS  = { "Technical Setup": "⚙️", "Strategic & Content": "🎯" };
const HUB_ORDER   = ["CRM","Marketing","Sales","Service","Commerce","Operations","All","AEO Services"];
const HUB_COLORS  = {
  CRM: "#3b9eff", Marketing: "#FF7A59", Sales: "#00BDA5", Service: "#6b7aed",
  Commerce: "#f5c842", Operations: "#f08c42", All: "#888", "AEO Services": "#b06ef3",
};
const PIPELINES = [
  { id: "17447049",   label: "Project" },
  { id: "768263196",  label: "HubSpot Implementation" },
  { id: "85604774",   label: "Retainer" },
  { id: "2193488",    label: "Course" },
  { id: "3558692",    label: "RaiserSync" },
  { id: "768263210",  label: "YourMemberSync" },
  { id: "779099780",  label: "Custom Integration" },
  { id: "4483255",    label: "Website" },
  { id: "16418228",   label: "Lifeline" },
];

const BRAND = {
  bg: "#0b0b0c", bgCard: "#0e0e0f", bg2: "#131d28", navy: "#425b76",
  sky: "#50badb", teal: "#1bccbb", coral: "#ff715d", border: "#1e1e20",
  text: "#e2dfd9", textMid: "#8baabe", textDim: "#4d6880", white: "#ffffff",
};

const fmt = (n) => n ? "$" + Number(n).toLocaleString() : "—";

async function callProxy(type, body) {
  const res = await fetch("/api/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, body }),
  });
  return res.json();
}

export default function App() {
  const [products, setProducts]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [mode, setMode]               = useState("browse"); // browse | agent
  const [selected, setSelected]       = useState({});
  const [clientName, setClientName]   = useState("");
  const [notes, setNotes]             = useState("");
  const [filterHub, setFilterHub]     = useState("All Hubs");
  const [filterType, setFilterType]   = useState("All Types");
  const [search, setSearch]           = useState("");
  const [output, setOutput]           = useState(null);
  const [generating, setGenerating]   = useState(false);
  const [copied, setCopied]           = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState("768263196"); // default: HubSpot Implementation
  const [pushing, setPushing]         = useState(false);
  const [pushed, setPushed]           = useState(false);
  const [pushError, setPushError]     = useState(null);
  const [pushDealId, setPushDealId]   = useState(null);
  const [view, setView]               = useState("select");

  // Agent mode state
  const [callNotes, setCallNotes]     = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentResult, setAgentResult]   = useState(null);
  const [agentError, setAgentError]     = useState(null);
  const [clarifications, setClarifications] = useState([]);
  const [clarificationAnswers, setClarificationAnswers] = useState({});
  const [awaitingClarification, setAwaitingClarification] = useState(false);

  useEffect(() => {
    async function loadProducts() {
      try {
        const allProducts = [];
        let after = 0;
        let hasMore = true;
        while (hasMore) {
          const data = await callProxy("hubspot_products", { offset: after, limit: 100 });
          if (data.results) {
            const mapped = data.results.map(r => ({
              id: r.id, name: r.properties.name, price: r.properties.price,
              description: r.properties.description, hub: r.properties.hub,
              stage: r.properties.stage, type: r.properties.type,
              enterprise_only: r.properties.enterprise_only,
              process_step: r.properties.process_step,
              billing_freq: r.properties.recurringbillingfrequency,
              folder: r.properties.hs_folder_name,
            }));
            allProducts.push(...mapped);
            if (data.paging?.next?.after) { after = data.paging.next.after; }
            else { hasMore = false; }
          } else { hasMore = false; }
        }
        setProducts(allProducts.filter(p => p.name));
        setLoading(false);
      } catch (e) {
        setError("Could not load services from HubSpot. " + e.message);
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  // ── Browse mode helpers ──────────────────────────────────────────────────
  const hubs = ["All Hubs", ...HUB_ORDER.filter(h => products.some(p => p.hub === h))];
  const filtered = products.filter(p => {
    if (filterHub !== "All Hubs" && p.hub !== filterHub) return false;
    if (filterType !== "All Types" && p.type !== filterType) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const grouped = {};
  for (const stage of STAGE_ORDER) {
    const sp = filtered.filter(p => p.stage === stage || (stage === "Foundation" && p.stage === "Foundational"));
    if (!sp.length) continue;
    grouped[stage] = {};
    for (const hub of HUB_ORDER) {
      const hp = sp.filter(p => p.hub === hub);
      if (hp.length) grouped[stage][hub] = hp;
    }
  }
  const selectedList  = Object.values(selected);
  const totalPrice    = selectedList.reduce((s, item) => s + Number(item.product.price || 0) * item.qty, 0);
  const totalSelected = selectedList.length;

  function toggle(product) {
    setSelected(prev => {
      const next = { ...prev };
      if (next[product.id]) delete next[product.id];
      else next[product.id] = { product, qty: 1 };
      return next;
    });
  }

  function updateQty(productId, delta) {
    setSelected(prev => {
      const next = { ...prev };
      if (!next[productId]) return next;
      const newQty = next[productId].qty + delta;
      if (newQty <= 0) delete next[productId];
      else next[productId] = { ...next[productId], qty: newQty };
      return next;
    });
  }

  // ── Agent mode: parse call notes ─────────────────────────────────────────
  async function runAgent(answersProvided = null) {
    if (!callNotes.trim()) return;
    setAgentLoading(true);
    setAgentResult(null);
    setAgentError(null);
    setAwaitingClarification(false);

    // Step 1: Use keywords from notes to filter catalog to most relevant products
    // This keeps the prompt size manageable
    const notesLower = callNotes.toLowerCase();
    const keywords = [
      'crm','hubspot','workflow','email','template','form','list','segment',
      'pipeline','deal','sequence','blog','content','social','report','dashboard',
      'custom object','migration','import','training','onboarding','aeo','pillar',
      'ebook','lead','nurture','scoring','playbook','snippet','meeting','calendar',
      'payment','integration','api','sync','automation','landing page','cta',
      'marketing','sales','service','ticket','knowledge','survey','feedback',
      'permission','gdpr','compliance','domain','chat','chatflow','persona',
      'association','lifecycle','contact','company','quote','product library',
      'forecasting','ads','raiser','raisersync','yourmember','gameplan','blueprint',
      'audit','strategy','infographic','video','checklist','conversion','popup'
    ];

    // Score each product by how relevant it is to the notes
    const scoredProducts = products
      .filter(p => p.name && p.price)
      .map(p => {
        const nameLower = p.name.toLowerCase();
        const hubLower = (p.hub || "").toLowerCase();
        let score = 0;
        keywords.forEach(kw => {
          if (notesLower.includes(kw) && nameLower.includes(kw)) score += 3;
          if (notesLower.includes(kw) && hubLower.includes(kw)) score += 1;
        });
        return { ...p, score };
      })
      .sort((a, b) => b.score - a.score);

    // Take top 80 most relevant + always include core setup items
    const topProducts = scoredProducts.slice(0, 80);
    const productCatalog = topProducts
      .map(p => `${p.id}|${p.name}|${p.price}|${p.hub||""}`)
      .join("\n");

    const answersBlock = answersProvided
      ? `\nClarification answers:\n${Object.entries(answersProvided).map(([q,a]) => `Q: ${q}\nA: ${a}`).join("\n")}`
      : "";

    // Keep call notes to 3000 chars max to avoid token limits
    const truncatedNotes = callNotes.length > 3000
      ? callNotes.slice(0, 3000) + "\n[...notes truncated for length]"
      : callNotes;

    const prompt = `You are a HubSpot scoping expert at Yodelpop nonprofit marketing agency. Read the call notes and select matching services from the catalog.

CALL NOTES:
${truncatedNotes}
${clientName ? `Client: ${clientName}` : ""}
${answersBlock}

PRODUCT CATALOG (id|name|price|hub) - top relevant items:
${productCatalog}

Select the services that match what was discussed. For per-unit items estimate quantity from notes. If critical info is missing ask up to 3 questions.

RESPOND WITH ONLY THIS JSON STRUCTURE - NO OTHER TEXT:
{"needs_clarification":false,"clarifying_questions":[],"selected_services":[{"id":"id","name":"name","qty":1,"price":0,"reasoning":"why"}],"summary":"summary here","confidence":"high","confidence_note":"note"}`;

    let text = "";
    try {
      const data = await callProxy("anthropic", {
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }]
      });

      text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";

      // Robustly extract JSON
      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");
      if (firstBrace === -1 || lastBrace === -1) throw new Error("No JSON in response: " + text.slice(0, 150));
      const clean = text.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(clean);

      if (parsed.needs_clarification && parsed.clarifying_questions?.length > 0) {
        setClarifications(parsed.clarifying_questions);
        setClarificationAnswers({});
        setAwaitingClarification(true);
        setAgentLoading(false);
        return;
      }

      // Match IDs to full product objects
      const matched = (parsed.selected_services || []).map(s => {
        const product = products.find(p => p.id === s.id) || products.find(p => p.name === s.name);
        if (!product) return null;
        return { product, qty: s.qty || 1, reasoning: s.reasoning };
      }).filter(Boolean);

      setAgentResult({
        services: matched,
        summary: parsed.summary,
        confidence: parsed.confidence,
        confidence_note: parsed.confidence_note,
      });

      const newSelected = {};
      matched.forEach(item => {
        newSelected[item.product.id] = { product: item.product, qty: item.qty };
      });
      setSelected(newSelected);

    } catch (e) {
      setAgentError("Error: " + e.message + (text ? " | Response: " + text.slice(0, 200) : ""));
    }
    setAgentLoading(false);
  }

    async function submitClarifications() {
    await runAgent(clarificationAnswers);
  }

  // ── Generate scope narrative ──────────────────────────────────────────────
  async function generate() {
    if (!totalSelected) return;
    setGenerating(true);
    setOutput(null);

    const itemList = selectedList.map(item =>
      `- ${item.product.name} x${item.qty} (${item.product.hub} | ${item.product.stage} | ${item.product.type}) — ${fmt(Number(item.product.price || 0) * item.qty)}`
    ).join("\n");

    const prompt = `You are a senior HubSpot implementation consultant at Yodelpop, a boutique nonprofit marketing agency. Write a sharp, client-ready project scope.

Client: ${clientName || "Prospect"}
Selected Services:
${itemList}
Total Investment: ${fmt(totalPrice)}
${notes ? `\nContext: ${notes}` : ""}
${callNotes ? `\nCall Notes: ${callNotes}` : ""}

Write a professional scope narrative in 3 paragraphs:
1. Engagement overview — what we're doing and why it matters for this nonprofit
2. What specifically will be delivered (reference the actual service names)
3. Expected outcomes and what success looks like

Tone: confident, consultative, strategic partner. No bullet points. No "We'll" or "We will". No mention of hourly rates.`;

    try {
      const data = await callProxy("anthropic", {
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      });
      const narrative = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "Could not generate scope.";
      setOutput({ narrative, totalPrice, items: selectedList });
      setView("results");
    } catch {
      setOutput({ error: true });
    }
    setGenerating(false);
  }

  function copyNarrative() {
    if (!output?.narrative) return;
    navigator.clipboard.writeText(output.narrative);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function pushToHubSpot() {
    if (!output) return;
    setPushing(true);
    setPushed(false);
    setPushError(null);

    try {
      // Step 1: Create the deal
      const dealData = await callProxy("hubspot_create", {
        objectType: "deals",
        properties: {
          dealname: `${clientName || "Prospect"} — Yodelpop Engagement`,
          dealstage: {
            "17447049": "17447053",   // Project -> Decision maker Bought-In
            "768263196": "1121446667", // HubSpot Implementation -> Appointment Scheduled
            "85604774": "159912568",  // Retainer -> Appointment Scheduled
            "2193488": "7792500",     // Course -> Qualified to buy
            "3558692": "12066410",    // RaiserSync -> Inquiry
            "768263210": "1121446815", // YourMemberSync -> Subscribed
            "779099780": "1138155899", // Custom Integration -> Appointment Scheduled
            "4483255": "14597203",    // Website -> Appointment Scheduled
            "16418228": "42468383",   // Lifeline -> Purchased
          }[selectedPipeline] || "1121446667",
          pipeline: selectedPipeline,
          amount: String(output.totalPrice),
        }
      });

      if (!dealData.id) throw new Error("Failed to create deal: " + JSON.stringify(dealData));
      const dealId = dealData.id;

      // Step 2: Create line items and associate to deal
      const lineItemPromises = output.items.map(item =>
        callProxy("hubspot_create", {
          objectType: "line_items",
          properties: {
            name: item.product.name,
            price: String(item.product.price || 0),
            quantity: String(item.qty),
            hs_product_id: item.product.id,
          },
          associations: [{
            to: { id: dealId },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 20 }]
          }]
        })
      );

      await Promise.all(lineItemPromises);
      setPushed(true);
      setPushDealId(dealId);
    } catch (e) {
      setPushError(e.message);
    }
    setPushing(false);
  }

  function reset() {
    setSelected({}); setOutput(null); setClientName(""); setNotes("");
    setCopied(false); setView("select"); setAgentResult(null);
    setCallNotes(""); setClarifications([]); setClarificationAnswers({});
    setAwaitingClarification(false); setPushed(false); setPushing(false);
    setPushError(null); setPushDealId(null);
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const css = `
    *{box-sizing:border-box;margin:0;padding:0}
    ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:2px}
    body{background:${BRAND.bg}}
    input,textarea{background:${BRAND.bgCard};border:1px solid ${BRAND.border};border-radius:7px;color:${BRAND.text};font-family:'Albert Sans',sans-serif;font-size:13.5px;padding:9px 13px;outline:none;transition:border .14s}
    input:focus,textarea:focus{border-color:#444}
    textarea{resize:vertical}
    ::placeholder{color:#333}
    .pill{display:inline-block;padding:2px 9px;border-radius:100px;font-size:10px;font-family:'DM Mono',monospace;letter-spacing:.3px}
    .hub-filter{padding:6px 14px;border-radius:20px;border:1px solid ${BRAND.border};background:transparent;color:${BRAND.textMid};font-size:12px;font-weight:500;font-family:'Albert Sans',sans-serif;cursor:pointer;transition:all .14s;letter-spacing:.2px}
    .hub-filter:hover{border-color:#333;color:#ccc}
    .hub-filter.active{color:${BRAND.white}}
    .type-filter{padding:6px 16px;border-radius:6px;border:1px solid ${BRAND.border};background:transparent;color:${BRAND.textMid};font-size:12px;font-weight:500;font-family:'Albert Sans',sans-serif;cursor:pointer;transition:all .14s}
    .type-filter:hover{border-color:#333;color:#ccc}
    .type-filter.active{background:${BRAND.bgCard};border-color:${BRAND.sky};color:${BRAND.sky}}
    .service-card{display:flex;align-items:flex-start;gap:10px;padding:11px 13px;border-radius:8px;cursor:pointer;border:1px solid ${BRAND.border};background:${BRAND.bgCard};transition:all .14s;text-align:left;width:100%}
    .service-card:hover{border-color:#2a2a2c;background:#111112}
    .service-card.on{border-color:var(--ac);background:#0f0f14}
    .chk{width:16px;height:16px;border-radius:4px;border:1.5px solid #2a2a2c;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9px;transition:all .14s;margin-top:1px}
    .service-card.on .chk{background:var(--ac);border-color:var(--ac);color:#000}
    .cta{padding:13px 36px;border-radius:9px;border:none;cursor:pointer;background:${BRAND.coral};color:#fff;font-size:15px;font-weight:600;font-family:'Albert Sans',sans-serif;transition:all .18s;letter-spacing:-.2px}
    .cta:hover:not(:disabled){background:#ff5c35;transform:translateY(-1px)}
    .cta:disabled{opacity:.35;cursor:not-allowed}
    .stat{background:${BRAND.bgCard};border:1px solid ${BRAND.border};border-radius:9px;padding:16px 20px}
    .stat-l{font-size:10px;color:#444;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:5px;font-family:'DM Mono',monospace}
    .stat-v{font-size:22px;font-weight:700;letter-spacing:-.4px}
    @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    .fu{animation:fadeUp .3s ease forwards}
    @keyframes spin{to{transform:rotate(360deg)}}
    .spinner{width:18px;height:18px;border:2px solid #333;border-top-color:${BRAND.coral};border-radius:50%;animation:spin .8s linear infinite;display:inline-block}
    .narrative-box{background:${BRAND.bgCard};border:1px solid ${BRAND.border};border-radius:11px;padding:26px 30px;line-height:1.85;color:#b8b4ae;font-size:14px}
    .narrative-box p+p{margin-top:16px}
    .mode-tab{padding:8px 20px;border-radius:7px;border:none;cursor:pointer;font-size:13px;font-weight:600;font-family:'Albert Sans',sans-serif;transition:all .15s;letter-spacing:-.2px}
    .reasoning-card{background:#0f1a0f;border:1px solid #1a3a1a;border-radius:8px;padding:12px 16px;margin-bottom:8px}
    .confidence-high{color:#4caf72}
    .confidence-medium{color:#f5c842}
    .confidence-low{color:${BRAND.coral}}
    .clarify-input{width:100%;margin-top:8px}
  `;

  return (
    <div style={{ fontFamily: "'Albert Sans', sans-serif", background: BRAND.bg, minHeight: "100vh", color: BRAND.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{css}</style>

      {/* ── Header ── */}
      <div style={{ borderBottom: `1px solid ${BRAND.border}`, padding: "0 28px", background: BRAND.bg2, position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", height: 76 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src="/logo.svg" alt="Yodelpop" style={{ height: 38, width: "auto" }} />
          <div style={{ width: 1, height: 38, background: BRAND.border }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: BRAND.textMid, letterSpacing: ".5px" }}>Services Planner</div>
            <div style={{ fontSize: 11, color: BRAND.textDim, marginTop: 1 }}>
              {loading ? "Loading..." : `${products.length} services · Live from HubSpot`}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Mode toggle */}
          {!loading && !error && view === "select" && (
            <div style={{ display: "flex", gap: 4, background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 9, padding: 3 }}>
              <button className="mode-tab" onClick={() => setMode("browse")}
                style={{ background: mode === "browse" ? BRAND.navy : "transparent", color: mode === "browse" ? BRAND.white : BRAND.textMid }}>
                🗂 Browse
              </button>
              <button className="mode-tab" onClick={() => setMode("agent")}
                style={{ background: mode === "agent" ? BRAND.coral : "transparent", color: mode === "agent" ? BRAND.white : BRAND.textMid }}>
                ✦ Agent
              </button>
            </div>
          )}

          {totalSelected > 0 && (
            <>
              <span className="pill" style={{ background: "#1a2a1a", color: "#5a9e72" }}>{totalSelected} selected</span>
              <span className="pill" style={{ background: "#1a1a1b", color: BRAND.coral }}>{fmt(totalPrice)}</span>
            </>
          )}
          {view === "results" && (
            <button onClick={() => setView("select")} style={{ background: "transparent", border: `1px solid ${BRAND.border}`, color: BRAND.textMid, padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "'Albert Sans', sans-serif" }}>
              ← Back
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 16 }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
          <div style={{ fontSize: 13, color: "#444", fontFamily: "'DM Mono', monospace" }}>Loading service library from HubSpot...</div>
        </div>
      )}

      {error && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
          <div style={{ color: BRAND.coral, fontSize: 14, textAlign: "center", maxWidth: 400 }}>{error}</div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          AGENT MODE
      ══════════════════════════════════════════════════════════════════════ */}
      {!loading && !error && view === "select" && mode === "agent" && (
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Client name */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: BRAND.textDim, textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: 7 }}>Client / Prospect</label>
            <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Organization name" style={{ width: "100%" }} />
          </div>

          {/* Call notes */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: BRAND.textDim, textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: 7 }}>
              Call Notes
              <span style={{ color: BRAND.textDim, fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 8 }}>Paste your bullet points or summary from the call</span>
            </label>
            <textarea
              value={callNotes}
              onChange={e => setCallNotes(e.target.value)}
              placeholder={`Example:\n- Client is migrating from Salesforce, ~2k contacts\n- Needs full CRM setup, 3 pipelines\n- Wants email marketing set up with 5 templates\n- Monthly blog post + social content\n- Interested in HubSpot for nonprofits training\n- Budget around $15k`}
              style={{ width: "100%", minHeight: 220, fontSize: 13, lineHeight: 1.7 }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <button className="cta" disabled={agentLoading || !callNotes.trim()} onClick={() => runAgent()}>
              {agentLoading
                ? <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="spinner" />Analyzing call notes...</span>
                : "✦ Build Scope from Notes →"}
            </button>
          </div>

          {/* Clarifying questions */}
          {awaitingClarification && (
            <div className="fu" style={{ background: "#0f1a2a", border: `1px solid ${BRAND.sky}33`, borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.sky, marginBottom: 16 }}>
                ✦ A few clarifying questions before I build the scope:
              </div>
              {clarifications.map((q, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: BRAND.text, marginBottom: 6 }}>{i + 1}. {q}</div>
                  <input
                    type="text"
                    className="clarify-input"
                    placeholder="Your answer..."
                    value={clarificationAnswers[q] || ""}
                    onChange={e => setClarificationAnswers(prev => ({ ...prev, [q]: e.target.value }))}
                  />
                </div>
              ))}
              <button className="cta" style={{ marginTop: 8 }}
                disabled={agentLoading || clarifications.some(q => !clarificationAnswers[q]?.trim())}
                onClick={submitClarifications}>
                {agentLoading ? <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="spinner" />Building scope...</span> : "Submit Answers →"}
              </button>
            </div>
          )}

          {agentError && (
            <div style={{ color: BRAND.coral, fontSize: 13, textAlign: "center" }}>{agentError}</div>
          )}

          {/* Agent result */}
          {agentResult && (
            <div className="fu" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Summary + confidence */}
              <div style={{ background: "#0c1a12", border: "1px solid #1a3524", borderRadius: 11, padding: "18px 22px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#4a9e65", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>
                  Agent Summary
                  <span style={{ marginLeft: 12, fontSize: 11, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}
                    className={`confidence-${agentResult.confidence}`}>
                    {agentResult.confidence === "high" ? "✓ High confidence" : agentResult.confidence === "medium" ? "~ Medium confidence" : "⚠ Low confidence"} — {agentResult.confidence_note}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: BRAND.textMid, lineHeight: 1.7 }}>{agentResult.summary}</div>
              </div>

              {/* Selected services with reasoning */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: BRAND.textDim, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
                  Selected Services — {agentResult.services.length} items · {fmt(agentResult.services.reduce((s, i) => s + Number(i.product.price || 0) * i.qty, 0))}
                </div>
                {agentResult.services.map((item, i) => {
                  const hubColor = HUB_COLORS[item.product.hub] || BRAND.textMid;
                  return (
                    <div key={i} className="reasoning-card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 9, color: hubColor, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{item.product.hub}</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: BRAND.text }}>{item.product.name}</span>
                            {item.qty > 1 && <span style={{ fontSize: 11, color: BRAND.textDim }}>×{item.qty}</span>}
                          </div>
                          <div style={{ fontSize: 12, color: BRAND.textDim, lineHeight: 1.5 }}>↳ {item.reasoning}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 16 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: BRAND.coral, fontFamily: "'DM Mono', monospace" }}>
                            {fmt(Number(item.product.price || 0) * item.qty)}
                          </span>
                          {/* Qty adjuster */}
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <button onClick={() => updateQty(item.product.id, -1)} style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${BRAND.border}`, background: BRAND.bg, color: BRAND.textMid, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Albert Sans', sans-serif" }}>−</button>
                            <span style={{ fontSize: 12, color: BRAND.white, minWidth: 14, textAlign: "center" }}>{selected[item.product.id]?.qty || item.qty}</span>
                            <button onClick={() => updateQty(item.product.id, 1)} style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${BRAND.border}`, background: BRAND.bg, color: BRAND.textMid, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Albert Sans', sans-serif" }}>+</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Option to switch to browse to add more */}
              <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center" }}>
                <button onClick={() => setMode("browse")} style={{ background: "transparent", border: `1px solid ${BRAND.border}`, color: BRAND.textMid, padding: "8px 18px", borderRadius: 7, cursor: "pointer", fontSize: 13, fontFamily: "'Albert Sans', sans-serif" }}>
                  + Add more in Browse mode
                </button>
                <button className="cta" disabled={generating || !totalSelected} onClick={generate}>
                  {generating
                    ? <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="spinner" />Generating...</span>
                    : "Generate Scope & Estimate →"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          BROWSE MODE
      ══════════════════════════════════════════════════════════════════════ */}
      {!loading && !error && view === "select" && mode === "browse" && (
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "28px 20px", display: "flex", flexDirection: "column", gap: 24 }}>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: BRAND.textDim, textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: 7 }}>Client / Prospect</label>
              <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Organization name" style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: BRAND.textDim, textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: 7 }}>
                Context <span style={{ color: BRAND.textDim, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
              </label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Migrating from Salesforce, 3k contacts..." style={{ width: "100%" }} />
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: BRAND.textDim, textTransform: "uppercase", letterSpacing: "1px", marginRight: 4 }}>Hub</span>
              {hubs.map(h => {
                const isActive = filterHub === h;
                const color = HUB_COLORS[h];
                return (
                  <button key={h} className={`hub-filter${isActive ? " active" : ""}`} onClick={() => setFilterHub(h)}
                    style={isActive ? { borderColor: color || BRAND.sky, background: (color || BRAND.sky) + "18", color: color || BRAND.sky } : {}}>
                    {h}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: BRAND.textDim, textTransform: "uppercase", letterSpacing: "1px", marginRight: 4 }}>Type</span>
              <button className={`type-filter${filterType === "All Types" ? " active" : ""}`} onClick={() => setFilterType("All Types")}>All</button>
              <button className={`type-filter${filterType === "Technical Setup" ? " active" : ""}`} onClick={() => setFilterType("Technical Setup")}>⚙️ Technical Setup</button>
              <button className={`type-filter${filterType === "Strategic & Content" ? " active" : ""}`} onClick={() => setFilterType("Strategic & Content")}>🎯 Strategic & Content</button>
              <div style={{ flex: 1 }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services..." style={{ width: 220, fontSize: 13 }} />
            </div>
          </div>

          {/* Grouped services */}
          {Object.entries(grouped).map(([stage, hubMap]) => {
            const sc = STAGE_COLORS[stage] || STAGE_COLORS.Foundation;
            return (
              <div key={stage}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ padding: "6px 16px", borderRadius: 6, background: sc.accent + "15", border: `1px solid ${sc.accent}30`, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: sc.accent }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: sc.accent }}>{sc.label}</span>
                    <span style={{ fontSize: 11, color: sc.accent + "88" }}>{sc.desc}</span>
                  </div>
                  <div style={{ flex: 1, height: 1, background: BRAND.border }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {Object.entries(hubMap).map(([hub, prods]) => {
                    const hubColor = HUB_COLORS[hub] || BRAND.textMid;
                    return (
                      <div key={hub}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: hubColor }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: hubColor }}>{hub}</span>
                          <span style={{ fontSize: 11, color: BRAND.textDim }}>({prods.length})</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                          {prods.map(p => {
                            const isOn = !!selected[p.id];
                            const tc = TYPE_ICONS[p.type] || "";
                            return (
                              <div key={p.id} className={`service-card${isOn ? " on" : ""}`} style={{ "--ac": hubColor }}>
                                <span className="chk" onClick={() => toggle(p)} style={{ cursor: "pointer", flexShrink: 0 }}>{isOn ? "✓" : ""}</span>
                                <div style={{ flex: 1, minWidth: 0 }} onClick={() => !isOn && toggle(p)}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: isOn ? BRAND.white : BRAND.textMid, lineHeight: 1.4, marginBottom: 5, cursor: isOn ? "default" : "pointer" }}>{p.name}</div>
                                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                    {p.price && <span style={{ fontSize: 11, fontWeight: 600, color: isOn ? hubColor : BRAND.textDim }}>{isOn ? fmt(Number(p.price) * selected[p.id].qty) : fmt(p.price)}</span>}
                                    {p.type && <span style={{ fontSize: 10, color: BRAND.textDim }}>{tc}</span>}
                                    {(p.enterprise_only === "true" || p.enterprise_only === true) && <span style={{ fontSize: 9, color: BRAND.sky, fontWeight: 600 }}>ENT</span>}
                                  </div>
                                </div>
                                {isOn && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, marginLeft: 4 }} onClick={e => e.stopPropagation()}>
                                    <button onClick={() => updateQty(p.id, -1)} style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${BRAND.border}`, background: BRAND.bg, color: BRAND.textMid, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: BRAND.white, minWidth: 14, textAlign: "center" }}>{selected[p.id].qty}</span>
                                    <button onClick={() => updateQty(p.id, 1)} style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${BRAND.border}`, background: BRAND.bg, color: BRAND.textMid, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {totalSelected > 0 && (
            <div className="fu" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ height: 1, background: BRAND.border }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div className="stat"><div className="stat-l">Selected</div><div className="stat-v">{totalSelected}</div></div>
                <div className="stat"><div className="stat-l">Total Investment</div><div className="stat-v" style={{ color: BRAND.coral }}>{fmt(totalPrice)}</div></div>
                <div className="stat"><div className="stat-l">Average</div><div className="stat-v">{fmt(Math.round(totalPrice / totalSelected))}</div></div>
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <button className="cta" disabled={generating} onClick={generate}>
                  {generating ? <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="spinner" />Generating...</span> : "Generate Scope & Estimate →"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          RESULTS VIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {view === "results" && output && !output.error && (
        <div className="fu" style={{ maxWidth: 820, margin: "0 auto", padding: "32px 20px", display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ background: "linear-gradient(135deg, #0c1a12, #0e1e14)", border: "1px solid #1a3524", borderRadius: 12, padding: "22px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#4a9e65", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>{clientName || "Prospect"} · Investment Summary</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: BRAND.white, letterSpacing: "-.5px" }}>{fmt(output.totalPrice)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#4a9e65", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>Services</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: BRAND.textMid }}>{output.items.length} items</div>
            </div>
          </div>

          <div style={{ background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "13px 20px", borderBottom: `1px solid ${BRAND.border}` }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: BRAND.textDim, textTransform: "uppercase", letterSpacing: "1px" }}>Line Items</span>
            </div>
            {output.items.map((item, i) => {
              const p = item.product;
              const hubColor = HUB_COLORS[p.hub] || BRAND.textMid;
              const lineTotal = Number(p.price || 0) * item.qty;
              return (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 20px", borderBottom: i < output.items.length - 1 ? `1px solid ${BRAND.bg}` : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: hubColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 13.5, color: BRAND.text }}>{p.name}</span>
                    {item.qty > 1 && <span style={{ fontSize: 11, color: BRAND.textDim }}>×{item.qty}</span>}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: BRAND.coral, flexShrink: 0, marginLeft: 16, fontFamily: "'DM Mono', monospace" }}>{fmt(lineTotal)}</span>
                </div>
              );
            })}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 20px", background: BRAND.bg2, borderTop: `1px solid ${BRAND.border}` }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: BRAND.text }}>Total Investment</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: BRAND.coral, fontFamily: "'DM Mono', monospace" }}>{fmt(output.totalPrice)}</span>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: BRAND.textDim, textTransform: "uppercase", letterSpacing: "1px" }}>Scope Narrative</span>
              <button onClick={copyNarrative} style={{ background: "transparent", border: `1px solid ${copied ? BRAND.teal : BRAND.border}`, color: copied ? BRAND.teal : BRAND.textMid, padding: "6px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "'Albert Sans', sans-serif", transition: "all .15s", fontWeight: 500 }}>
                {copied ? "Copied ✓" : "Copy to clipboard"}
              </button>
            </div>
            <div className="narrative-box">
              {output.narrative.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingBottom: 20 }}>
            {!pushed && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: BRAND.textDim, textTransform: "uppercase", letterSpacing: "1px", whiteSpace: "nowrap" }}>Pipeline</label>
                <select
                  value={selectedPipeline}
                  onChange={e => setSelectedPipeline(e.target.value)}
                  style={{ background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 7, color: BRAND.text, fontFamily: "'Albert Sans', sans-serif", fontSize: 13, padding: "7px 12px", cursor: "pointer", outline: "none" }}>
                  {PIPELINES.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
            )}
            {!pushed ? (
              <button
                onClick={pushToHubSpot}
                disabled={pushing}
                style={{ padding: "12px 28px", borderRadius: 9, border: "none", cursor: pushing ? "not-allowed" : "pointer", background: pushing ? BRAND.navy : "#0f3a6e", color: BRAND.sky, fontSize: 14, fontWeight: 600, fontFamily: "'Albert Sans', sans-serif", transition: "all .18s", display: "flex", alignItems: "center", gap: 8, opacity: pushing ? 0.7 : 1 }}>
                {pushing
                  ? <><span className="spinner" style={{ borderTopColor: BRAND.sky }} /> Creating deal in HubSpot...</>
                  : "→ Push to HubSpot as Deal"}
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 13, color: "#4caf72", fontWeight: 600 }}>✓ Deal created in HubSpot</div>
                <a
                  href={`https://app.hubspot.com/contacts/${process.env.REACT_APP_HUBSPOT_PORTAL_ID || ""}/deal/${pushDealId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: BRAND.sky, textDecoration: "underline", cursor: "pointer" }}>
                  Open deal in HubSpot →
                </a>
              </div>
            )}
            {pushError && (
              <div style={{ fontSize: 12, color: BRAND.coral, textAlign: "center", maxWidth: 400 }}>Push error: {pushError}</div>
            )}
            <button onClick={reset} style={{ background: "transparent", border: "none", color: BRAND.textDim, cursor: "pointer", fontSize: 13, fontFamily: "'Albert Sans', sans-serif" }}>
              ↩ Start a new scope
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
