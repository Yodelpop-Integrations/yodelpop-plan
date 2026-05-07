/* eslint-disable */
import { useState, useEffect } from "react";

const STAGE_ORDER = ["Setup", "Foundation", "TOFU", "MOFU", "BOFU", "DEFU", "Foundational"];
const STAGE_COLORS = {
  Setup:       { bg: "#0f1f2e", accent: "#3b9eff", label: "Setup" },
  Foundation:  { bg: "#1a1a0f", accent: "#f5c842", label: "Foundation" },
  Foundational:{ bg: "#1a1a0f", accent: "#f5c842", label: "Foundation" },
  TOFU:        { bg: "#0f2218", accent: "#4caf72", label: "TOFU" },
  MOFU:        { bg: "#1f1520", accent: "#b06ef3", label: "MOFU" },
  BOFU:        { bg: "#1f150e", accent: "#f08c42", label: "BOFU" },
  DEFU:        { bg: "#0f1e1e", accent: "#42d4d4", label: "DEFU" },
};
const TYPE_ICONS = { "Technical Setup": "⚙️", "Strategic & Content": "🎯" };
const HUB_ORDER  = ["CRM","Marketing","Sales","Service","Commerce","Operations","All","AEO Services"];
const HUB_COLORS = {
  CRM:          "#3b9eff",
  Marketing:    "#FF7A59",
  Sales:        "#00BDA5",
  Service:      "#6b7aed",
  Commerce:     "#f5c842",
  Operations:   "#f08c42",
  All:          "#888",
  "AEO Services":"#b06ef3",
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
  const [pushing, setPushing]       = useState(false);
  const [pushed, setPushed]         = useState(false);
  const [copied, setCopied]         = useState(false);
  const [view, setView]             = useState("select");

  // Load products directly from HubSpot API
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
              id:            r.id,
              name:          r.properties.name,
              price:         r.properties.price,
              description:   r.properties.description,
              hub:           r.properties.hub,
              stage:         r.properties.stage,
              type:          r.properties.type,
              enterprise_only: r.properties.enterprise_only,
              process_step:  r.properties.process_step,
              billing_freq:  r.properties.recurringbillingfrequency,
              folder:        r.properties.hs_folder_name,
            }));
            allProducts.push(...mapped);

            if (data.paging?.next?.after) {
              after = data.paging.next.after;
            } else {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }

        setProducts(allProducts.filter(p => p.name));
        setLoading(false);
      } catch (e) {
        setError("Could not load products from HubSpot. " + e.message);
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
    const stageProds = filtered.filter(p => p.stage === stage || (stage === "Foundation" && p.stage === "Foundational"));
    if (stageProds.length === 0) continue;
    grouped[stage] = {};
    for (const hub of HUB_ORDER) {
      const hubProds = stageProds.filter(p => p.hub === hub);
      if (hubProds.length > 0) grouped[stage][hub] = hubProds;
    }
  }

  const selectedList = Object.values(selected);
  const totalPrice   = selectedList.reduce((s, p) => s + Number(p.price || 0), 0);
  const totalSelected = selectedList.length;

  function toggle(product) {
    setSelected(prev => {
      const next = { ...prev };
      if (next[product.id]) delete next[product.id];
      else next[product.id] = product;
      return next;
    });
  }

  async function generate() {
    if (totalSelected === 0) return;
    setGenerating(true);
    setOutput(null);
    setPushed(false);

    const itemList = selectedList.map(p =>
      `- ${p.name} (${p.hub} | ${p.stage} | ${p.type}) — ${fmt(p.price)}`
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

  async function pushToHubSpot() {
    if (!output || pushed) return;
    setPushing(true);

    const prompt = `Create a HubSpot deal for client "${clientName || "Prospect"}" with deal name "${clientName || "New Prospect"} — Yodelpop Engagement". Set dealstage to "appointmentscheduled" and pipeline to "default". Use the manage_crm_objects tool. Return the deal ID.`;

    try {
      await callProxy("anthropic", {
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }]
      });
      setPushed(true);
    } catch {}
    setPushing(false);
  }

  function copyNarrative() {
    if (output?.narrative) {
      navigator.clipboard.writeText(output.narrative);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function reset() {
    setSelected({}); setOutput(null); setClientName("");
    setNotes(""); setPushed(false); setView("select");
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#080809", minHeight: "100vh", color: "#e2dfd9" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:2px}
        input,textarea{background:#0f0f10;border:1px solid #1e1e20;border-radius:7px;color:#e2dfd9;font-family:'DM Sans',sans-serif;font-size:13.5px;padding:9px 13px;outline:none;transition:border .14s}
        input:focus,textarea:focus{border-color:#444}
        textarea{resize:vertical}
        ::placeholder{color:#333}
        .pill{display:inline-block;padding:2px 9px;border-radius:100px;font-size:10px;font-family:'DM Mono',monospace;letter-spacing:.3px}
        .filter-btn{padding:6px 14px;border-radius:6px;border:1px solid #222;background:#0f0f10;color:#666;font-size:12px;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all .14s}
        .filter-btn:hover{border-color:#333;color:#ccc}
        .filter-btn.active{border-color:#444;color:#e2dfd9;background:#1a1a1b}
        .prod-row{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-radius:8px;cursor:pointer;border:1px solid #151516;background:#0c0c0d;transition:all .14s;text-align:left;width:100%}
        .prod-row:hover{border-color:#2a2a2c;background:#111112}
        .prod-row.on{border-color:var(--ac);background:#0f0f14}
        .chk{width:16px;height:16px;border-radius:4px;border:1.5px solid #2a2a2c;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9px;transition:all .14s;margin-top:1px}
        .prod-row.on .chk{background:var(--ac);border-color:var(--ac);color:#000}
        .cta{padding:13px 36px;border-radius:9px;border:none;cursor:pointer;background:#FF7A59;color:#fff;font-size:15px;font-weight:600;font-family:'DM Sans',sans-serif;transition:all .18s;letter-spacing:-.2px}
        .cta:hover:not(:disabled){background:#ff5c35;transform:translateY(-1px)}
        .cta:disabled{opacity:.35;cursor:not-allowed}
        .stat{background:#0f0f10;border:1px solid #1a1a1c;border-radius:9px;padding:16px 20px}
        .stat-l{font-size:10px;color:#444;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:5px;font-family:'DM Mono',monospace}
        .stat-v{font-size:22px;font-weight:700;letter-spacing:-.4px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fadeUp .3s ease forwards}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spinner{width:18px;height:18px;border:2px solid #333;border-top-color:#FF7A59;border-radius:50%;animation:spin .8s linear infinite;display:inline-block}
        .narrative-box{background:#0e0e0f;border:1px solid #1a1a1b;border-radius:11px;padding:26px 30px;line-height:1.85;color:#b8b4ae;font-size:14px}
        .narrative-box p+p{margin-top:16px}
      `}</style>

      {/* Top bar */}
      <div style={{ borderBottom: "1px solid #141415", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#080809", zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 28, height: 28, background: "#FF7A59", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>🎯</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-.3px" }}>Yodelpop Plan</div>
            <div style={{ fontSize: 10, color: "#3a3a3c", fontFamily: "'DM Mono', monospace" }}>Live from HubSpot · {products.length} services</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {totalSelected > 0 && <>
            <span className="pill" style={{ background: "#1a2a1a", color: "#5a9e72" }}>{totalSelected} selected</span>
            <span className="pill" style={{ background: "#1a1a1b", color: "#FF7A59" }}>{fmt(totalPrice)}</span>
          </>}
          {view === "results" && (
            <button onClick={() => setView("select")} style={{ background: "transparent", border: "1px solid #222", color: "#666", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
              ← Back
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 16 }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
          <div style={{ fontSize: 13, color: "#444", fontFamily: "'DM Mono', monospace" }}>Loading your HubSpot product library...</div>
        </div>
      )}

      {error && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
          <div style={{ color: "#c04040", fontSize: 14, textAlign: "center", maxWidth: 400 }}>{error}</div>
        </div>
      )}

      {!loading && !error && view === "select" && (
        <div style={{ maxWidth: 920, margin: "0 auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "1.2px", fontFamily: "'DM Mono', monospace", display: "block", marginBottom: 7 }}>Client / Prospect</label>
              <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Acme Nonprofit" style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "1.2px", fontFamily: "'DM Mono', monospace", display: "block", marginBottom: 7 }}>Context for AI <span style={{ color: "#222" }}>(optional)</span></label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Migrating from Salesforce, 3k contacts..." style={{ width: "100%" }} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services..." style={{ width: 200, fontSize: 12, padding: "6px 12px" }} />
            <div style={{ width: 1, height: 20, background: "#1e1e20" }} />
            {hubs.map(h => (
              <button key={h} className={`filter-btn${filterHub === h ? " active" : ""}`} onClick={() => setFilterHub(h)}
                style={{ borderColor: filterHub === h && HUB_COLORS[h] ? HUB_COLORS[h] + "44" : undefined, color: filterHub === h && HUB_COLORS[h] ? HUB_COLORS[h] : undefined }}>
                {h}
              </button>
            ))}
            <div style={{ width: 1, height: 20, background: "#1e1e20" }} />
            <button className={`filter-btn${filterType === "All Types" ? " active" : ""}`} onClick={() => setFilterType("All Types")}>All Types</button>
            <button className={`filter-btn${filterType === "Technical Setup" ? " active" : ""}`} onClick={() => setFilterType("Technical Setup")}>⚙️ Setup</button>
            <button className={`filter-btn${filterType === "Strategic & Content" ? " active" : ""}`} onClick={() => setFilterType("Strategic & Content")}>🎯 Strategy</button>
          </div>

          {Object.entries(grouped).map(([stage, hubMap]) => {
            const sc = STAGE_COLORS[stage] || STAGE_COLORS.Foundation;
            return (
              <div key={stage} style={{ background: sc.bg + "88", border: `1px solid ${sc.accent}22`, borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 3, height: 18, background: sc.accent, borderRadius: 2 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: sc.accent, letterSpacing: ".5px", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>{sc.label}</span>
                </div>
                {Object.entries(hubMap).map(([hub, prods]) => (
                  <div key={hub} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: HUB_COLORS[hub] || "#888", fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>{hub}</span>
                      <span style={{ fontSize: 10, color: "#333" }}>({prods.length})</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {prods.map(p => {
                        const on = !!selected[p.id];
                        const ac = HUB_COLORS[hub] || "#888";
                        return (
                          <button key={p.id} className={`prod-row${on ? " on" : ""}`} style={{ "--ac": ac }} onClick={() => toggle(p)} title={p.description}>
                            <span className="chk">{on ? "✓" : ""}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 500, color: on ? "#e2dfd9" : "#888", lineHeight: 1.3 }}>{p.name}</div>
                              <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                                <span style={{ fontSize: 10, color: on ? ac : "#444", fontFamily: "'DM Mono', monospace" }}>{fmt(p.price)}</span>
                                {p.type && <span style={{ fontSize: 9, color: "#333" }}>{TYPE_ICONS[p.type]}</span>}
                                {(p.enterprise_only === "true" || p.enterprise_only === true) && <span style={{ fontSize: 9, color: "#f5c842" }}>ENT</span>}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {totalSelected > 0 && (
            <div className="fu" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div className="stat">
                  <div className="stat-l">Services Selected</div>
                  <div className="stat-v">{totalSelected}</div>
                </div>
                <div className="stat">
                  <div className="stat-l">Total Investment</div>
                  <div className="stat-v" style={{ color: "#FF7A59" }}>{fmt(totalPrice)}</div>
                </div>
                <div className="stat">
                  <div className="stat-l">Avg per Service</div>
                  <div className="stat-v">{fmt(Math.round(totalPrice / totalSelected))}</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <button className="cta" disabled={generating} onClick={generate}>
                  {generating
                    ? <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="spinner" /> Generating scope...</span>
                    : "Generate Scope & Estimate →"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {view === "results" && output && !output.error && (
        <div className="fu" style={{ maxWidth: 820, margin: "0 auto", padding: "28px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

          <div style={{ background: "#0c1a12", border: "1px solid #1a3524", borderRadius: 12, padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, color: "#4a9e65", textTransform: "uppercase", letterSpacing: "1.2px", fontFamily: "'DM Mono', monospace", marginBottom: 5 }}>
                {clientName || "Prospect"} — Total Investment
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-.5px" }}>{fmt(output.totalPrice)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#4a9e65", textTransform: "uppercase", letterSpacing: "1.2px", fontFamily: "'DM Mono', monospace", marginBottom: 5 }}>Services</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#9a9690" }}>{output.items.length} items</div>
            </div>
          </div>

          <div style={{ background: "#0e0e0f", border: "1px solid #1a1a1b", borderRadius: 11, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #141415" }}>
              <span style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "1.2px", fontFamily: "'DM Mono', monospace" }}>Line Items</span>
            </div>
            {output.items.map((p, i) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderBottom: i < output.items.length - 1 ? "1px solid #0f0f10" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 9, color: HUB_COLORS[p.hub] || "#888", fontFamily: "'DM Mono', monospace" }}>{p.hub}</span>
                  <span style={{ fontSize: 13, color: "#c0bcb6" }}>{p.name}</span>
                  {p.type && <span style={{ fontSize: 11 }}>{TYPE_ICONS[p.type]}</span>}
                </div>
                <span style={{ fontSize: 12, color: "#FF7A59", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{fmt(p.price)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 20px", background: "#0c0c0d", borderTop: "1px solid #1a1a1b" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#e2dfd9" }}>Total</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#FF7A59", fontFamily: "'DM Mono', monospace" }}>{fmt(output.totalPrice)}</span>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "1.2px", fontFamily: "'DM Mono', monospace" }}>Scope Narrative</span>
              <button onClick={copyNarrative} style={{ background: "transparent", border: "1px solid #222", color: copied ? "#4a9e65" : "#555", padding: "5px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans', sans-serif", transition: "all .14s" }}>
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <div className="narrative-box">
              {output.narrative.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", paddingBottom: 16 }}>
            <button onClick={reset} style={{ background: "transparent", border: "none", color: "#333", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
              ↩ Start over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
