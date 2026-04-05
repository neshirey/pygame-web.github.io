import { useState, useRef, useEffect, useCallback, memo } from "react";

const SYSTEM_PROMPT = "You are a Senior Solution Architect with 20+ years of experience in networking, data center, cloud, and network security. Expert knowledge includes:\n- Routing: BGP, OSPF, IS-IS, MPLS, Segment Routing, SD-WAN, QoS, multicast\n- Data Center: EVPN/VXLAN, spine-leaf, Juniper Apstra, QFX/EX, Cisco Nexus, MLAG, VPC\n- Cloud: AWS Transit Gateway, Azure vWAN, GCP Interconnect, Direct Connect, ExpressRoute\n- Security: ZTNA, SASE, Zscaler ZIA/ZPA, Cisco Umbrella, microsegmentation, NAC, 802.1X\n- Wireless: 802.11ax/Wi-Fi 6/6E, RF design, Cisco Catalyst Center, Aruba Central, Juniper Mist AI\n- Switching: STP/RSTP/MSTP, VLANs, LAG, QoS marking, Cisco Catalyst, Juniper EX\n- AI Networking: GPU clusters, RoCEv2/RDMA, lossless fabrics, InfiniBand vs Ethernet, AIOps\n- Fortinet: FortiGate (40F-7000F), FortiManager, FortiAnalyzer, FortiSwitch, FortiAP, FortiClient EMS\n- Zscaler: ZIA/ZPA subscriptions per user/year. ZIA Business ~$60-80/user/yr\n- Meraki: MX/MS/MR hardware plus mandatory ENT/SEC licenses\n- Palo Alto: PA-Series NGFW, Panorama, Prisma Access, Cortex XDR/XSOAR\n- Arctic Wolf: MDR, Managed Risk, SOC-as-a-service, concierge security model\n- NVIDIA/Mellanox: DGX systems, ConnectX-7 NICs, Quantum-2 InfiniBand, Spectrum Ethernet, BlueField DPUs\nRULES:\n1. Be technically precise. Use RFC numbers and vendor terminology.\n2. Lead with a direct answer then supporting detail.\n3. Cite sources inline like [RFC XXXX] or [vendor doc].\n4. State tradeoffs when multiple answers exist.\n5. Never fabricate URLs.\n6. Use bullets for facts, prose for explanations.\n7. CHOICES: When asking user to choose, place a block immediately after each question:\n%%CHOICES:multi%%\nOption 1\nOption 2\n%%END%%\n8. BOM: When asked for a Bill of Materials respond ONLY with valid JSON, no other text:\n\`\`\`json\n{\"bom\":[{\"category\":\"...\",\"part_number\":\"...\",\"description\":\"...\",\"vendor\":\"...\",\"qty\":1,\"unit\":\"ea\",\"list_price\":0.00,\"notes\":\"...\",\"datasheet_url\":\"...\"}]}\n\`\`\`\nFor datasheet_url use the real official vendor product page URL. Use vendor base URLs: Cisco=cisco.com/c/en/us/products, Juniper=juniper.net/us/en/products, Fortinet=fortinet.com/products, PaloAlto=paloaltonetworks.com/products, HPE=arubanetworks.com/products, NVIDIA=nvidia.com/en-us/networking. Use the vendor product listing page if unsure of exact datasheet URL.";

// ── dark-mode palette ────────────────────────────────────────────────────────
var DM = {
  bg: "#0f1117",
  sidebar: "#161b22",
  card: "#1c2230",
  border: "#30363d",
  text: "#e6edf3",
  textSec: "#8b949e",
  textTert: "#484f58",
  accent: "#388bfd",
  accentHover: "#58a6ff",
  userBubble: "#1a3a5c",
  aiBubble: "#1c2230",
  font: "Inter, system-ui, sans-serif",
};

// ── helpers ──────────────────────────────────────────────────────────────────
function parseBom(text) {
  var m = text.match(/```json\s*([\s\S]*?)```/);
  if (!m) return null;
  try {
    var parsed = JSON.parse(m[1]);
    return parsed.bom ? parsed.bom : null;
  } catch {
    return null;
  }
}

function parseChoices(text) {
  var m = text.match(/%%CHOICES:(multi|single)%%([\s\S]*?)%%END%%/);
  if (!m) return null;
  return {
    type: m[1],
    options: m[2].trim().split("\n").map(function (s) { return s.trim(); }).filter(Boolean),
  };
}

function stripMeta(text) {
  return text
    .replace(/%%CHOICES:(multi|single)%%[\s\S]*?%%END%%/g, "")
    .replace(/```json[\s\S]*?```/g, "")
    .trim();
}

// ── BomTable ─────────────────────────────────────────────────────────────────
var BomTable = memo(function BomTable({ rows, dm }) {
  var cols = ["category", "vendor", "part_number", "description", "qty", "unit", "list_price", "notes"];
  var total = rows.reduce(function (s, r) { return s + (r.qty || 1) * (r.list_price || 0); }, 0);
  return (
    <div style={{ overflowX: "auto", marginTop: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: dm.text }}>
        <thead>
          <tr>
            {cols.map(function (c) {
              return (
                <th key={c} style={{ padding: "6px 10px", background: dm.card, border: "0.5px solid " + dm.border, textAlign: "left", fontWeight: 600, textTransform: "capitalize", whiteSpace: "nowrap" }}>
                  {c.replace("_", " ")}
                </th>
              );
            })}
            <th style={{ padding: "6px 10px", background: dm.card, border: "0.5px solid " + dm.border, textAlign: "right", fontWeight: 600 }}>Line Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(function (r, i) {
            var lineTotal = (r.qty || 1) * (r.list_price || 0);
            return (
              <tr key={i} style={{ background: i % 2 === 0 ? dm.bg : dm.card }}>
                {cols.map(function (c) {
                  var val = r[c];
                  if (c === "list_price") val = val != null ? "$" + Number(val).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—";
                  if (c === "part_number" && r.datasheet_url) {
                    val = (
                      <a href={r.datasheet_url} target="_blank" rel="noopener noreferrer" style={{ color: dm.accent }}>
                        {r.part_number}
                      </a>
                    );
                  }
                  return (
                    <td key={c} style={{ padding: "5px 10px", border: "0.5px solid " + dm.border, verticalAlign: "top" }}>
                      {val ?? "—"}
                    </td>
                  );
                })}
                <td style={{ padding: "5px 10px", border: "0.5px solid " + dm.border, textAlign: "right" }}>
                  {"$" + lineTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={cols.length} style={{ padding: "6px 10px", border: "0.5px solid " + dm.border, fontWeight: 700, textAlign: "right" }}>
              Total List Price
            </td>
            <td style={{ padding: "6px 10px", border: "0.5px solid " + dm.border, fontWeight: 700, textAlign: "right", color: dm.accentHover }}>
              {"$" + total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
});

// ── ChoiceButtons ────────────────────────────────────────────────────────────
function ChoiceButtons({ choices, onChoose, dm }) {
  var [selected, setSelected] = useState([]);
  var multi = choices.type === "multi";

  function toggle(opt) {
    if (multi) {
      setSelected(function (prev) {
        return prev.includes(opt) ? prev.filter(function (x) { return x !== opt; }) : [...prev, opt];
      });
    } else {
      setSelected([opt]);
    }
  }

  function submit() {
    if (selected.length === 0) return;
    onChoose(selected.join(", "));
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {choices.options.map(function (opt, i) {
          var active = selected.includes(opt);
          return (
            <button
              key={i}
              onClick={function () { toggle(opt); }}
              style={{
                padding: "5px 12px", borderRadius: 6, border: "1px solid " + (active ? dm.accent : dm.border),
                background: active ? dm.userBubble : dm.card, color: active ? dm.accentHover : dm.textSec,
                fontSize: 13, cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <button
          onClick={submit}
          style={{
            padding: "5px 16px", borderRadius: 6, border: "none", background: dm.accent,
            color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600,
          }}
        >
          Confirm
        </button>
      )}
    </div>
  );
}

// ── MessageBubble ────────────────────────────────────────────────────────────
var MessageBubble = memo(function MessageBubble({ msg, dm, onChoose }) {
  var isUser = msg.role === "user";
  var bom = !isUser ? parseBom(msg.content) : null;
  var choices = !isUser ? parseChoices(msg.content) : null;
  var display = stripMeta(msg.content);

  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12 }}>
      <div
        style={{
          maxWidth: "80%", padding: "10px 14px", borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          background: isUser ? dm.userBubble : dm.aiBubble, border: "0.5px solid " + dm.border,
          color: dm.text, fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}
      >
        {display}
        {bom && <BomTable rows={bom} dm={dm} />}
        {choices && !isUser && <ChoiceButtons choices={choices} onChoose={onChoose} dm={dm} />}
      </div>
    </div>
  );
});

// ── NewsPanel ────────────────────────────────────────────────────────────────
function NewsPanel({ open, onToggle, dm }) {
  var items = [
    { tag: "BGP", text: "RFC 9234 — Route Leak Prevention with BGP Roles" },
    { tag: "Security", text: "CISA AA24: ZTNA adoption guidance for federal agencies" },
    { tag: "AI Networking", text: "NVIDIA Spectrum-X: Ethernet fabric for AI at scale" },
    { tag: "Wi-Fi", text: "Wi-Fi 7 (802.11be) — MLO and 320 MHz channel support" },
    { tag: "Cloud", text: "AWS CloudWAN GA: managed global SD-WAN backbone" },
  ];
  return (
    <div style={{ padding: "0 14px" }}>
      <button onClick={onToggle} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: "6px 0 8px", fontFamily: "var(--font-sans)" }}>
        <span style={{ fontSize: 11, color: dm.textTert, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 500 }}>Industry Updates</span>
        <span style={{ fontSize: 10, color: dm.textTert, transition: "transform 0.18s", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>▾</span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 8 }}>
          {items.map(function (item, i) {
            return (
              <div key={i} style={{ padding: "8px 10px", borderRadius: 7, border: "0.5px solid " + dm.border, background: dm.card }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#60a5fa", background: "#0d2040", border: "0.5px solid #2a4f80", borderRadius: 3, padding: "1px 6px", marginRight: 6 }}>{item.tag}</span>
                <span style={{ fontSize: 12, color: dm.textSec, lineHeight: 1.5 }}>{item.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── SAAssistant ──────────────────────────────────────────────────────────────
export default function SAAssistant() {
  var dm = DM;
  var [messages, setMessages] = useState([]);
  var [input, setInput] = useState("");
  var [loading, setLoading] = useState(false);
  var [apiKey, setApiKey] = useState(function () { return localStorage.getItem("oai_key") || ""; });
  var [showKey, setShowKey] = useState(false);
  var [secVendor, setSecVendor] = useState(true);
  var [secLib, setSecLib] = useState(true);
  var [secNews, setSecNews] = useState(true);
  var bottomRef = useRef(null);
  var textareaRef = useRef(null);

  useEffect(function () {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  var saveKey = useCallback(function (k) {
    setApiKey(k);
    localStorage.setItem("oai_key", k);
  }, []);

  var send = useCallback(
    async function (text) {
      var trimmed = (text || input).trim();
      if (!trimmed || loading) return;
      if (!apiKey) { alert("Paste your OpenAI API key first."); return; }
      var next = [...messages, { role: "user", content: trimmed }];
      setMessages(next);
      setInput("");
      setLoading(true);
      try {
        var res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...next],
            temperature: 0.3,
            max_tokens: 2048,
          }),
        });
        if (!res.ok) {
          var err = await res.json().catch(function () { return {}; });
          throw new Error(err.error?.message || res.statusText);
        }
        var data = await res.json();
        var reply = data.choices?.[0]?.message?.content || "(no response)";
        setMessages(function (prev) { return [...prev, { role: "assistant", content: reply }]; });
      } catch (e) {
        setMessages(function (prev) { return [...prev, { role: "assistant", content: "Error: " + e.message }]; });
      } finally {
        setLoading(false);
      }
    },
    [input, loading, apiKey, messages]
  );

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clearChat() {
    setMessages([]);
  }

  // Quick-prompt starters
  var starters = [
    "Design a spine-leaf fabric for 500 servers",
    "Compare Zscaler ZIA vs Palo Alto Prisma Access",
    "EVPN/VXLAN multi-site design considerations",
    "BOM: FortiGate 400F HA pair with FortiManager",
    "RoCEv2 lossless fabric tuning for GPU cluster",
    "Wi-Fi 6E vs Wi-Fi 7 for high-density venue",
  ];

  return (
    <div style={{ display: "flex", height: "100vh", background: dm.bg, color: dm.text, fontFamily: dm.font, fontSize: 14 }}>
      {/* ── Sidebar ── */}
      <div style={{ width: 260, minWidth: 220, background: dm.sidebar, borderRight: "0.5px solid " + dm.border, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Logo / title */}
        <div style={{ padding: "18px 16px 14px", borderBottom: "0.5px solid " + dm.border }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: dm.text, letterSpacing: -0.3 }}>SA Assistant</div>
          <div style={{ fontSize: 11, color: dm.textTert, marginTop: 2 }}>Solution Architect AI</div>
        </div>

        {/* API key */}
        <div style={{ padding: "12px 14px", borderBottom: "0.5px solid " + dm.border }}>
          <label style={{ fontSize: 11, color: dm.textTert, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 500, display: "block", marginBottom: 5 }}>
            OpenAI API Key
          </label>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={function (e) { saveKey(e.target.value); }}
              placeholder="sk-..."
              style={{ flex: 1, background: dm.card, border: "0.5px solid " + dm.border, borderRadius: 6, padding: "5px 8px", color: dm.text, fontSize: 12, outline: "none" }}
            />
            <button onClick={function () { setShowKey(function (v) { return !v; }); }} style={{ background: dm.card, border: "0.5px solid " + dm.border, borderRadius: 6, padding: "4px 8px", color: dm.textSec, cursor: "pointer", fontSize: 11 }}>
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {/* Sections */}
        <div style={{ flex: 1, overflowY: "auto", paddingTop: 8 }}>
          {/* Vendor Quick-Ref */}
          <div style={{ padding: "0 14px" }}>
            <button onClick={function () { setSecVendor(function (v) { return !v; }); }} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: "6px 0 8px", fontFamily: "var(--font-sans)" }}>
              <span style={{ fontSize: 11, color: dm.textTert, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 500 }}>Vendor Quick-Ref</span>
              <span style={{ fontSize: 10, color: dm.textTert, transition: "transform 0.18s", transform: secVendor ? "rotate(0deg)" : "rotate(-90deg)" }}>▾</span>
            </button>
            {secVendor && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 8 }}>
                {[
                  { name: "Cisco", color: "#0057a8" },
                  { name: "Juniper", color: "#009639" },
                  { name: "Fortinet", color: "#ee3124" },
                  { name: "Palo Alto", color: "#fa582d" },
                  { name: "Zscaler", color: "#0072c6" },
                  { name: "Arctic Wolf", color: "#ff6d00" },
                  { name: "NVIDIA", color: "#76b900" },
                  { name: "Aruba/HPE", color: "#0096d6" },
                ].map(function (v) {
                  return (
                    <button
                      key={v.name}
                      onClick={function () { send("Give me a quick reference summary for " + v.name + " networking products."); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, background: dm.card, border: "0.5px solid " + dm.border, borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: dm.textSec, fontSize: 12, textAlign: "left" }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: v.color, flexShrink: 0 }} />
                      {v.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Prompt Library */}
          <div style={{ padding: "0 14px" }}>
            <button onClick={function () { setSecLib(function (v) { return !v; }); }} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: "6px 0 8px", fontFamily: "var(--font-sans)" }}>
              <span style={{ fontSize: 11, color: dm.textTert, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 500 }}>Prompt Library</span>
              <span style={{ fontSize: 10, color: dm.textTert, transition: "transform 0.18s", transform: secLib ? "rotate(0deg)" : "rotate(-90deg)" }}>▾</span>
            </button>
            {secLib && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 8 }}>
                {starters.map(function (s, i) {
                  return (
                    <button
                      key={i}
                      onClick={function () { send(s); }}
                      style={{ background: dm.card, border: "0.5px solid " + dm.border, borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: dm.textSec, fontSize: 12, textAlign: "left", lineHeight: 1.4 }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Industry Updates (NewsPanel) */}
          <NewsPanel open={secNews} onToggle={function () { setSecNews(function (v) { return !v; }); }} dm={dm} />
        </div>

        {/* Clear chat */}
        <div style={{ padding: "10px 14px", borderTop: "0.5px solid " + dm.border }}>
          <button
            onClick={clearChat}
            style={{ width: "100%", padding: "7px 0", borderRadius: 7, border: "0.5px solid " + dm.border, background: "transparent", color: dm.textSec, fontSize: 12, cursor: "pointer" }}
          >
            Clear Conversation
          </button>
        </div>
      </div>

      {/* ── Main chat area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "14px 20px", borderBottom: "0.5px solid " + dm.border, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Solution Architect Chat</span>
            <span style={{ marginLeft: 10, fontSize: 12, color: dm.textTert }}>Powered by GPT-4o</span>
          </div>
          <span style={{ fontSize: 12, color: dm.textTert }}>{messages.length} message{messages.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", marginTop: "15vh", color: dm.textTert }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🏗</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: dm.textSec, marginBottom: 6 }}>Ask anything about network architecture</div>
              <div style={{ fontSize: 13 }}>BGP, EVPN, ZTNA, SD-WAN, BOMs, vendor comparisons and more.</div>
            </div>
          )}
          {messages.map(function (msg, i) {
            return (
              <MessageBubble
                key={i}
                msg={msg}
                dm={dm}
                onChoose={function (chosen) { send(chosen); }}
              />
            );
          })}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
              <div style={{ padding: "10px 14px", borderRadius: "16px 16px 16px 4px", background: dm.aiBubble, border: "0.5px solid " + dm.border, color: dm.textSec, fontSize: 14 }}>
                Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "12px 20px", borderTop: "0.5px solid " + dm.border }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={function (e) { setInput(e.target.value); }}
              onKeyDown={handleKeyDown}
              placeholder="Ask a networking or architecture question… (Shift+Enter for newline)"
              rows={3}
              style={{
                flex: 1, background: dm.card, border: "0.5px solid " + dm.border, borderRadius: 10,
                padding: "10px 14px", color: dm.text, fontSize: 14, resize: "none", outline: "none",
                fontFamily: dm.font, lineHeight: 1.5,
              }}
            />
            <button
              onClick={function () { send(); }}
              disabled={loading || !input.trim()}
              style={{
                padding: "10px 18px", borderRadius: 10, border: "none",
                background: loading || !input.trim() ? dm.card : dm.accent,
                color: loading || !input.trim() ? dm.textTert : "#fff",
                fontSize: 14, fontWeight: 600, cursor: loading || !input.trim() ? "default" : "pointer",
                transition: "background 0.15s", alignSelf: "flex-end",
              }}
            >
              Send
            </button>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: dm.textTert }}>
            Enter to send · Shift+Enter for newline · API key stored in localStorage
          </div>
        </div>
      </div>
    </div>
  );
}
