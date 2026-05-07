/* eslint-disable */
import { useState, useEffect } from "react";

// ── Brand ────────────────────────────────────────────────────────────────────
const BRAND = {
  navy:    "#425b76",
  sky:     "#50badb",
  teal:    "#1bccbb",
  mint:    "#8bdbd4",
  coral:   "#ff715d",
  blue:    "#006699",
  bg:      "#1a2533",
  bgDeep:  "#131d28",
  bgCard:  "#1f2e3d",
  bgHover: "#243447",
  border:  "#2a3f54",
  borderLight: "#334d66",
  text:    "#e8f0f7",
  textMid: "#8baabe",
  textDim: "#4d6880",
  white:   "#ffffff",
};

// ── Stage config ─────────────────────────────────────────────────────────────
const STAGE_ORDER = ["Setup", "Foundation", "TOFU", "MOFU", "BOFU", "DEFU", "Foundational"];
const STAGE_CONFIG = {
  Setup:        { accent: BRAND.sky,   label: "Setup",        desc: "Technical Configuration" },
  Foundation:   { accent: BRAND.mint,  label: "Foundation",   desc: "Strategy & Planning" },
  Foundational: { accent: BRAND.mint,  label: "Foundation",   desc: "Strategy & Planning" },
  TOFU:         { accent: BRAND.teal,  label: "Attract",      desc: "Top of Funnel" },
  MOFU:         { accent: BRAND.blue,  label: "Engage",       desc: "Middle of Funnel" },
  BOFU:         { accent: BRAND.coral, label: "Convert",      desc: "Bottom of Funnel" },
  DEFU:         { accent: BRAND.mint,  label: "Delight",      desc: "Customer & Donor Stage" },
};

// ── Hub config ───────────────────────────────────────────────────────────────
const HUB_ORDER  = ["CRM","Marketing","Sales","Service","Commerce","Operations","All","AEO Services"];
const HUB_COLORS = {
  CRM:           BRAND.sky,
  Marketing:     BRAND.coral,
  Sales:         BRAND.teal,
  Service:       BRAND.blue,
  Commerce:      BRAND.mint,
  Operations:    "#7eb8d4",
  All:           BRAND.textMid,
  "AEO Services": "#9b7fd4",
};

const TYPE_CONFIG = {
  "Technical Setup":    { icon: "⚙", label: "Technical Setup",    color: BRAND.sky },
  "Strategic & Content":{ icon: "◆", label: "Strategic & Content", color: BRAND.coral },
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

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [products, setProducts]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [selected, setSelected]     = useState({});
  const [clientName, setClientName] = useState("");
  const [notes, setNotes]           = useState("");
  const [filterHub, setFilterHub]   = useState("All Hubs");
  const [filterType, setFilterType] = useState("All Types");
  const [search, setSearch]         = useState("");
  const [output, setOutput]         = useState(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied]         = useState(false);
  const [view, setView]             = useState("select");

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
              id:           r.id,
              name:         r.properties.name,
              price:        r.properties.price,
              description:  r.properties.description,
              hub:          r.properties.hub,
              stage:        r.properties.stage,
              type:         r.properties.type,
              enterprise_only: r.properties.enterprise_only,
              process_step: r.properties.process_step,
              billing_freq: r.properties.recurringbillingfrequency,
              folder:       r.properties.hs_folder_name,
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

  const hubs = ["All Hubs", ...HUB_ORDER.filter(h => products.some(p => p.hub === h))];

  const filtered = products.filter(p => {
    if (filterHub !== "All Hubs" && p.hub !== filterHub) return false;
    if (filterType !== "All Types" && p.type !== filterType) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = {};
  for (const stage of STAGE_ORDER) {
    const stageProds = filtered.filter(p =>
      p.stage === stage || (stage === "Foundation" && p.stage === "Foundational")
    );
    if (!stageProds.length) continue;
    grouped[stage] = {};
    for (const hub of HUB_ORDER) {
      const hubProds = stageProds.filter(p => p.hub === hub);
      if (hubProds.length) grouped[stage][hub] = hubProds;
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

  async function generate() {
    if (!totalSelected) return;
    setGenerating(true);
    setOutput(null);

    const itemList = selectedList.map(item =>
      `- ${item.product.name} x${item.qty} (${item.product.hub} | ${item.product.stage} | ${item.product.type}) — ${fmt(Number(item.product.price || 0) * item.qty)}`
    ).join("\n");

    const prompt = `You are a senior HubSpot implementation consultant at Yodelpop, a boutique nonprofit marketing agency. Write a sharp, client-ready project scope for the following engagement.

Client: ${clientName || "Prospect"}
Selected Services:
${itemList}
Total Investment: ${fmt(totalPrice)}
${notes ? `\nContext: ${notes}` : ""}

Write a professional scope narrative in 3 paragraphs:
1. Engagement overview — what we're doing and why it matters for this nonprofit
2. What specifically will be delivered (reference the actual service names)
3. Expected outcomes and what success looks like

Tone: confident, consultative, strategic partner — not a vendor. No bullet points. No "We'll" or "We will". No mention of hourly rates.`;

    try {
      const data = await callProxy("anthropic", {
        model: "claude-sonnet-4-20250514",
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

  function reset() {
    setSelected({}); setOutput(null); setClientName("");
    setNotes(""); setCopied(false); setView("select");
  }

  return (
    <div style={{ fontFamily: "'Albert Sans', sans-serif", background: BRAND.bgDeep, minHeight: "100vh", color: BRAND.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${BRAND.bgDeep}; }
        ::-webkit-scrollbar-thumb { background: ${BRAND.border}; border-radius: 2px; }

        input, textarea {
          background: ${BRAND.bgCard};
          border: 1px solid ${BRAND.border};
          border-radius: 8px;
          color: ${BRAND.text};
          font-family: 'Albert Sans', sans-serif;
          font-size: 14px;
          padding: 10px 14px;
          outline: none;
          transition: border-color 0.15s;
          width: 100%;
        }
        input:focus, textarea:focus { border-color: ${BRAND.sky}; }
        textarea { resize: vertical; }
        ::placeholder { color: ${BRAND.textDim}; }

        .hub-filter {
          padding: 6px 14px;
          border-radius: 20px;
          border: 1px solid ${BRAND.border};
          background: transparent;
          color: ${BRAND.textMid};
          font-size: 12px;
          font-weight: 500;
          font-family: 'Albert Sans', sans-serif;
          cursor: pointer;
          transition: all 0.15s;
          letter-spacing: 0.2px;
        }
        .hub-filter:hover { border-color: ${BRAND.borderLight}; color: ${BRAND.text}; }
        .hub-filter.active { color: ${BRAND.white}; }

        .type-filter {
          padding: 6px 16px;
          border-radius: 6px;
          border: 1px solid ${BRAND.border};
          background: transparent;
          color: ${BRAND.textMid};
          font-size: 12px;
          font-weight: 500;
          font-family: 'Albert Sans', sans-serif;
          cursor: pointer;
          transition: all 0.15s;
        }
        .type-filter:hover { border-color: ${BRAND.borderLight}; color: ${BRAND.text}; }
        .type-filter.active { background: ${BRAND.bgCard}; border-color: ${BRAND.sky}; color: ${BRAND.sky}; }

        .service-card {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 8px;
          cursor: pointer;
          border: 1px solid ${BRAND.border};
          background: ${BRAND.bgCard};
          transition: all 0.15s;
          text-align: left;
          width: 100%;
        }
        .service-card:hover { border-color: ${BRAND.borderLight}; background: ${BRAND.bgHover}; }
        .service-card.selected { border-color: var(--hub-color); background: ${BRAND.bgHover}; }

        .checkbox {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 1.5px solid ${BRAND.borderLight};
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          transition: all 0.15s;
          margin-top: 2px;
        }
        .service-card.selected .checkbox {
          background: var(--hub-color);
          border-color: var(--hub-color);
          color: ${BRAND.bgDeep};
          font-weight: 700;
        }

        .generate-btn {
          padding: 14px 40px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          background: ${BRAND.coral};
          color: ${BRAND.white};
          font-size: 15px;
          font-weight: 600;
          font-family: 'Albert Sans', sans-serif;
          transition: all 0.2s;
          letter-spacing: 0.2px;
        }
        .generate-btn:hover:not(:disabled) { background: #ff5842; transform: translateY(-1px); box-shadow: 0 4px 20px ${BRAND.coral}44; }
        .generate-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .stat-card {
          background: ${BRAND.bgCard};
          border: 1px solid ${BRAND.border};
          border-radius: 10px;
          padding: 18px 22px;
        }
        .stat-label {
          font-size: 11px;
          font-weight: 600;
          color: ${BRAND.textDim};
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 6px;
        }
        .stat-value {
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.5px;
          color: ${BRAND.text};
        }

        .narrative-box {
          background: ${BRAND.bgCard};
          border: 1px solid ${BRAND.border};
          border-radius: 10px;
          padding: 28px 32px;
          line-height: 1.85;
          color: ${BRAND.textMid};
          font-size: 15px;
          font-weight: 400;
        }
        .narrative-box p + p { margin-top: 18px; }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.4px;
          text-transform: uppercase;
        }

        .tag {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
        }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.35s ease forwards; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 20px; height: 20px;
          border: 2px solid ${BRAND.border};
          border-top-color: ${BRAND.coral};
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          display: inline-block;
        }

        .section-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .section-divider-line {
          flex: 1;
          height: 1px;
          background: ${BRAND.border};
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        borderBottom: `1px solid ${BRAND.border}`,
        padding: "0 32px",
        background: BRAND.bg,
        position: "sticky", top: 0, zIndex: 20,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 76,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src="/logo.svg" alt="Yodelpop" style={{ height: 38, width: "auto" }} />
          <div style={{ width: 1, height: 38, background: BRAND.border }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: BRAND.textMid, letterSpacing: "0.5px" }}>Services Planner</div>
            <div style={{ fontSize: 11, color: BRAND.textDim, marginTop: 1 }}>
              {loading ? "Loading services..." : `${products.length} services · Live from HubSpot`}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {totalSelected > 0 && (
            <>
              <span className="tag" style={{ background: `${BRAND.teal}18`, color: BRAND.teal }}>
                {totalSelected} selected
              </span>
              <span className="tag" style={{ background: `${BRAND.coral}18`, color: BRAND.coral, fontWeight: 600 }}>
                {fmt(totalPrice)}
              </span>
            </>
          )}
          {view === "results" && (
            <button onClick={() => setView("select")} style={{
              background: "transparent", border: `1px solid ${BRAND.border}`,
              color: BRAND.textMid, padding: "6px 14px", borderRadius: 6,
              cursor: "pointer", fontSize: 13, fontFamily: "'Albert Sans', sans-serif",
              transition: "all 0.15s",
            }}>← Back</button>
          )}
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 16 }}>
          <div className="spinner" style={{ width: 36, height: 36 }} />
          <div style={{ fontSize: 14, color: BRAND.textDim }}>Loading your service library from HubSpot...</div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
          <div style={{ color: BRAND.coral, fontSize: 14, textAlign: "center", maxWidth: 420, lineHeight: 1.6 }}>{error}</div>
        </div>
      )}

      {/* ── Selection View ── */}
      {!loading && !error && view === "select" && (
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 28 }}>

          {/* Client + Notes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: BRAND.textDim, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                Client / Prospect
              </label>
              <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Organization name" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: BRAND.textDim, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                Context <span style={{ color: BRAND.textDim, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional — helps AI write a better scope)</span>
              </label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Migrating from Salesforce, 3k contacts, B2B nonprofit..." />
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Hub filters */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: BRAND.textDim, textTransform: "uppercase", letterSpacing: "0.8px", marginRight: 4 }}>Hub</span>
              {hubs.map(h => {
                const isActive = filterHub === h;
                const color = HUB_COLORS[h];
                return (
                  <button key={h} className={`hub-filter${isActive ? " active" : ""}`}
                    onClick={() => setFilterHub(h)}
                    style={isActive ? { borderColor: color || BRAND.sky, background: (color || BRAND.sky) + "18", color: color || BRAND.sky } : {}}>
                    {h}
                  </button>
                );
              })}
            </div>

            {/* Type + Search */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: BRAND.textDim, textTransform: "uppercase", letterSpacing: "0.8px", marginRight: 4 }}>Type</span>
              <button className={`type-filter${filterType === "All Types" ? " active" : ""}`} onClick={() => setFilterType("All Types")}>All</button>
              <button className={`type-filter${filterType === "Technical Setup" ? " active" : ""}`} onClick={() => setFilterType("Technical Setup")}>
                ⚙ Technical Setup
              </button>
              <button className={`type-filter${filterType === "Strategic & Content" ? " active" : ""}`} onClick={() => setFilterType("Strategic & Content")}>
                ◆ Strategic & Content
              </button>
              <div style={{ flex: 1 }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search services..." style={{ width: 220, fontSize: 13 }} />
            </div>
          </div>

          {/* Grouped Services */}
          {Object.entries(grouped).map(([stage, hubMap]) => {
            const sc = STAGE_CONFIG[stage] || STAGE_CONFIG.Foundation;
            return (
              <div key={stage}>
                {/* Stage header */}
                <div className="section-divider">
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "6px 16px",
                    borderRadius: 6,
                    background: sc.accent + "15",
                    border: `1px solid ${sc.accent}30`,
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: sc.accent, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: sc.accent, letterSpacing: "0.3px" }}>{sc.label}</span>
                    <span style={{ fontSize: 11, color: sc.accent + "88", fontWeight: 400 }}>{sc.desc}</span>
                  </div>
                  <div className="section-divider-line" />
                </div>

                {/* Hubs within stage */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {Object.entries(hubMap).map(([hub, prods]) => {
                    const hubColor = HUB_COLORS[hub] || BRAND.textMid;
                    return (
                      <div key={hub}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: hubColor, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: hubColor, letterSpacing: "0.3px" }}>{hub}</span>
                          <span style={{ fontSize: 11, color: BRAND.textDim }}>({prods.length})</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          {prods.map(p => {
                            const isSelected = !!selected[p.id];
                            const tc = TYPE_CONFIG[p.type] || {};
                            return (
                              <div
                                key={p.id}
                                className={`service-card${isSelected ? " selected" : ""}`}
                                style={{ "--hub-color": hubColor, cursor: "pointer" }}
                                title={p.description}
                              >
                                <span className="checkbox" onClick={() => toggle(p)} style={{ cursor: "pointer", flexShrink: 0 }}>{isSelected ? "✓" : ""}</span>
                                <div style={{ flex: 1, minWidth: 0 }} onClick={() => !isSelected && toggle(p)}>
                                  <div style={{
                                    fontSize: 13.5,
                                    fontWeight: 500,
                                    color: isSelected ? BRAND.white : BRAND.textMid,
                                    lineHeight: 1.4,
                                    marginBottom: 6,
                                    cursor: isSelected ? "default" : "pointer",
                                  }}>{p.name}</div>
                                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                    {p.price && (
                                      <span style={{
                                        fontSize: 12, fontWeight: 600,
                                        color: isSelected ? hubColor : BRAND.textDim,
                                      }}>{isSelected ? fmt(Number(p.price) * selected[p.id].qty) : fmt(p.price)}</span>
                                    )}
                                    {p.type && (
                                      <span style={{
                                        fontSize: 10, fontWeight: 500,
                                        color: tc.color + "88",
                                        display: "flex", alignItems: "center", gap: 3,
                                      }}>
                                        {tc.icon} {tc.label}
                                      </span>
                                    )}
                                    {(p.enterprise_only === "true" || p.enterprise_only === true) && (
                                      <span className="badge" style={{ background: `${BRAND.sky}15`, color: BRAND.sky }}>ENT</span>
                                    )}
                                  </div>
                                </div>
                                {isSelected && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 6 }} onClick={e => e.stopPropagation()}>
                                    <button onClick={() => updateQty(p.id, -1)} style={{
                                      width: 22, height: 22, borderRadius: 4,
                                      border: `1px solid ${BRAND.borderLight}`,
                                      background: BRAND.bg, color: BRAND.textMid,
                                      cursor: "pointer", fontSize: 14, fontWeight: 600,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      fontFamily: "'Albert Sans', sans-serif", lineHeight: 1,
                                    }}>−</button>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: BRAND.white, minWidth: 16, textAlign: "center" }}>
                                      {selected[p.id].qty}
                                    </span>
                                    <button onClick={() => updateQty(p.id, 1)} style={{
                                      width: 22, height: 22, borderRadius: 4,
                                      border: `1px solid ${BRAND.borderLight}`,
                                      background: BRAND.bg, color: BRAND.textMid,
                                      cursor: "pointer", fontSize: 14, fontWeight: 600,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      fontFamily: "'Albert Sans', sans-serif", lineHeight: 1,
                                    }}>+</button>
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

          {/* Live estimate */}
          {totalSelected > 0 && (
            <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ height: 1, background: BRAND.border }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div className="stat-card">
                  <div className="stat-label">Services Selected</div>
                  <div className="stat-value">{totalSelected}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Investment</div>
                  <div className="stat-value" style={{ color: BRAND.coral }}>{fmt(totalPrice)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Average per Service</div>
                  <div className="stat-value">{fmt(Math.round(totalPrice / totalSelected))}</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
                <button className="generate-btn" disabled={generating} onClick={generate}>
                  {generating
                    ? <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="spinner" style={{ width: 18, height: 18 }} />
                        Generating scope...
                      </span>
                    : "Generate Scope & Estimate →"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Results View ── */}
      {view === "results" && output && !output.error && (
        <div className="fade-up" style={{ maxWidth: 820, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Investment header */}
          <div style={{
            background: `linear-gradient(135deg, ${BRAND.bg}, ${BRAND.bgCard})`,
            border: `1px solid ${BRAND.border}`,
            borderRadius: 12,
            padding: "24px 28px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.teal, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>
                {clientName || "Prospect"} · Investment Summary
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: BRAND.white, letterSpacing: "-0.5px" }}>
                {fmt(output.totalPrice)}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.teal, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>Services</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: BRAND.textMid }}>{output.items.length} items</div>
            </div>
          </div>

          {/* Line items */}
          <div style={{ background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BRAND.border}` }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: BRAND.textDim, textTransform: "uppercase", letterSpacing: "0.8px" }}>Line Items</span>
            </div>
            {output.items.map((item, i) => {
              const p = item.product;
              const hubColor = HUB_COLORS[p.hub] || BRAND.textMid;
              const tc = TYPE_CONFIG[p.type] || {};
              const lineTotal = Number(p.price || 0) * item.qty;
              return (
                <div key={p.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 20px",
                  borderBottom: i < output.items.length - 1 ? `1px solid ${BRAND.bgDeep}` : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: hubColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: BRAND.text }}>{p.name}</span>
                    {item.qty > 1 && <span style={{ fontSize: 11, color: BRAND.textDim }}>×{item.qty}</span>}
                    {p.type && <span style={{ fontSize: 10, color: tc.color + "66" }}>{tc.icon}</span>}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: BRAND.coral, flexShrink: 0, marginLeft: 16 }}>{fmt(lineTotal)}</span>
                </div>
              );
            })}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "14px 20px",
              background: BRAND.bg,
              borderTop: `1px solid ${BRAND.border}`,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: BRAND.text }}>Total Investment</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: BRAND.coral }}>{fmt(output.totalPrice)}</span>
            </div>
          </div>

          {/* Scope narrative */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: BRAND.textDim, textTransform: "uppercase", letterSpacing: "0.8px" }}>Scope Narrative</span>
              <button onClick={copyNarrative} style={{
                background: "transparent",
                border: `1px solid ${copied ? BRAND.teal : BRAND.border}`,
                color: copied ? BRAND.teal : BRAND.textMid,
                padding: "6px 16px", borderRadius: 6,
                cursor: "pointer", fontSize: 13,
                fontFamily: "'Albert Sans', sans-serif",
                transition: "all 0.15s", fontWeight: 500,
              }}>
                {copied ? "Copied ✓" : "Copy to clipboard"}
              </button>
            </div>
            <div className="narrative-box">
              {output.narrative.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "center", paddingBottom: 20 }}>
            <button onClick={reset} style={{
              background: "transparent", border: "none",
              color: BRAND.textDim, cursor: "pointer",
              fontSize: 13, fontFamily: "'Albert Sans', sans-serif",
              transition: "color 0.15s",
            }}>
              ↩ Start a new scope
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
