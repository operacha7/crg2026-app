// src/views/AdminReviewPage.js
// The Opportunity Scan review queue — where the weekly findings become the news
// feed. Replaces editing scan_findings by hand in Supabase.
//
// Admin-only (registered_organizations.account_id = ADMIN_ACCOUNT_ID). The gate
// here is cosmetic convenience; the REAL gate is server-side in
// functions/admin-findings.js, which checks the session JWT's `sub`.
//
// Per finding you can: override the AI's category, attach a CRG resource
// (directory_id_no → the "View this resource in CRG" deep link on the feed),
// set the expiration date, add an editorial note, then Publish or Dismiss.
// Plus "Add a story" for the mid-week fast lane.
//
// The resource picker searches the directory already loaded in AppDataContext —
// no extra endpoint, no network round-trip per keystroke.

import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import VerticalNavBar from "../layout/VerticalNavBar";
import Footer from "../layout/Footer";
import { useAppData } from "../Contexts/AppDataContext";
import { NEWS_CATEGORIES } from "../data/newsCategories";
import { ADMIN_ACCOUNT_ID } from "../data/constants";

const CARD = {
  backgroundColor: "#FFFFFF",
  borderRadius: "8px",
  padding: "18px",
  marginBottom: "16px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
};

const LABEL = {
  display: "block",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-text-secondary)",
  marginBottom: "3px",
};

const INPUT = {
  width: "100%",
  padding: "6px 8px",
  border: "1px solid #CCC",
  borderRadius: "4px",
  fontSize: "13.5px",
  backgroundColor: "#FFF",
};

function todayPlus(days) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

async function callAdmin(body) {
  const res = await fetch("/admin-findings", {
    method: "POST",
    credentials: "include", // session cookie carries the admin identity
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Request failed");
  return data;
}

// Type-ahead over the in-memory directory. Sets directory_id_no on the finding,
// which becomes the "View this resource in CRG" link on the news item.
function ResourcePicker({ value, onChange }) {
  const { directory } = useAppData();
  const [query, setQuery] = useState("");

  // Accepts EITHER a directory id_no or an organization name — in practice the
  // id is often what's known, and a name-only search silently matched nothing
  // when a number was typed.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const list = directory || [];
    if (/^\d+$/.test(q)) {
      return list.filter((d) => String(d.id_no).startsWith(q)).slice(0, 8);
    }
    if (q.length < 2) return [];
    return list.filter((d) => (d.organization || "").toLowerCase().includes(q)).slice(0, 8);
  }, [query, directory]);

  const chosen = value ? (directory || []).find((d) => d.id_no === Number(value)) : null;

  return (
    <div>
      <span style={LABEL}>CRG resource link</span>
      {chosen ? (
        <div className="flex items-center" style={{ gap: "8px" }}>
          <span style={{ fontSize: "13px" }}>
            <strong>#{chosen.id_no}</strong> {chosen.organization}
            {chosen.org_city ? ` — ${chosen.org_city}` : ""}
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery("");
            }}
            style={{ fontSize: "12px", color: "#B8001F", textDecoration: "underline" }}
          >
            remove
          </button>
        </div>
      ) : (
        <>
          <input
            style={INPUT}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Organization name or id_no…"
          />
          {/* Typing alone attaches nothing — the value is only set on click, so
              say so rather than silently dropping it at Publish time. */}
          {query.trim() && (
            <p
              style={{
                fontSize: "11px",
                marginTop: "3px",
                color: matches.length ? "var(--color-text-secondary)" : "#B8001F",
              }}
            >
              {matches.length ? "Click a result to attach it." : "No match — nothing will be attached."}
            </p>
          )}
          {matches.length > 0 && (
            <div
              style={{
                border: "1px solid #DDD",
                borderRadius: "4px",
                marginTop: "3px",
                maxHeight: "160px",
                overflowY: "auto",
              }}
            >
              {matches.map((d) => (
                <button
                  key={d.id_no}
                  type="button"
                  onClick={() => {
                    onChange(d.id_no);
                    setQuery("");
                  }}
                  className="w-full text-left hover:bg-gray-100"
                  style={{ padding: "5px 8px", fontSize: "12.5px", display: "block" }}
                >
                  <strong>#{d.id_no}</strong> {d.organization}
                  {d.org_city ? ` — ${d.org_city}` : ""}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FindingCard({ item, mode, onDone }) {
  const [draft, setDraft] = useState({
    category: item.category,
    directory_id_no: item.directory_id_no,
    expires_at: item.expires_at || todayPlus(7),
    notes: item.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);
  const isLive = mode === "published";

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  // status: "published" | "dismissed" | null (save edits in place, stay live)
  const act = async (status) => {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const patch =
        status === "dismissed"
          ? { status }
          : { ...draft, directory_id_no: draft.directory_id_no || null, ...(status ? { status } : {}) };
      await callAdmin({ action: "update", id: item.id, patch });
      // Publishing or dismissing removes it from the queue tab; saving edits to
      // an already-live story leaves it in place.
      if (status || !isLive) {
        onDone(item.id);
      } else {
        setSaved(true);
        setBusy(false);
      }
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <div style={CARD} className="font-opensans">
      <div className="flex items-start justify-between" style={{ gap: "12px" }}>
        <h3 style={{ fontSize: "17px", fontWeight: 600, lineHeight: 1.3 }}>{item.title}</h3>
        {item.confidence && (
          <span
            style={{
              flexShrink: 0,
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "2px 8px",
              borderRadius: "999px",
              color: "#222831",
              backgroundColor:
                item.confidence === "high" ? "#8FBC8F" : item.confidence === "medium" ? "#FFDA6A" : "#E0E0E0",
            }}
          >
            {item.confidence}
          </span>
        )}
      </div>

      <p style={{ fontSize: "14px", margin: "6px 0", lineHeight: 1.45 }}>{item.summary}</p>

      <p style={{ fontSize: "12.5px", color: "var(--color-text-secondary)", marginBottom: "10px" }}>
        {[item.county && `${item.county} County`, item.org_name, item.deadline && `Deadline: ${item.deadline}`]
          .filter(Boolean)
          .join(" · ")}
        {item.source_url && (
          <>
            {" · "}
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#0066cc", textDecoration: "underline" }}
            >
              {item.source || "source"}
            </a>
          </>
        )}
      </p>

      <div className="grid gap-3 md:grid-cols-3" style={{ marginBottom: "12px" }}>
        <div>
          <span style={LABEL}>Category</span>
          <select style={INPUT} value={draft.category} onChange={(e) => set("category", e.target.value)}>
            {NEWS_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span style={LABEL}>Expires</span>
          <input
            type="date"
            style={INPUT}
            value={draft.expires_at || ""}
            onChange={(e) => set("expires_at", e.target.value)}
          />
        </div>
        <ResourcePicker value={draft.directory_id_no} onChange={(v) => set("directory_id_no", v)} />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <span style={LABEL}>Your note (shows on the news item)</span>
        <input
          style={INPUT}
          value={draft.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Optional"
        />
      </div>

      {err && <p style={{ color: "#B8001F", fontSize: "13px", marginBottom: "8px" }}>{err}</p>}

      <div className="flex items-center" style={{ gap: "10px" }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => act(isLive ? null : "published")}
          className="hover:brightness-110"
          style={{
            backgroundColor: "#3DB800",
            color: "#FFF",
            fontWeight: 700,
            fontSize: "13.5px",
            padding: "8px 18px",
            borderRadius: "5px",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {isLive ? "Save changes" : "Publish"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => act("dismissed")}
          className="hover:brightness-110"
          style={{
            backgroundColor: "#FF0000",
            color: "#FFF",
            fontWeight: 700,
            fontSize: "13.5px",
            padding: "8px 18px",
            borderRadius: "5px",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {isLive ? "Remove from feed" : "Dismiss"}
        </button>
        {saved && (
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#3DB800" }}>Saved ✓</span>
        )}
      </div>
    </div>
  );
}

const EMPTY_STORY = {
  title: "",
  summary: "",
  category: "food",
  source: "",
  source_url: "",
  county: "",
  org_name: "",
  deadline: "",
  directory_id_no: null,
  notes: "",
  expires_at: todayPlus(7),
};

function AddStoryForm({ onAdded }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY_STORY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await callAdmin({ action: "create", fields: f });
      setF(EMPTY_STORY);
      setOpen(false);
      onAdded();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hover:brightness-110 font-opensans"
        style={{
          backgroundColor: "#222831",
          color: "#FFC857",
          fontWeight: 700,
          fontSize: "14px",
          padding: "10px 20px",
          borderRadius: "6px",
          marginBottom: "18px",
        }}
      >
        + Add a story
      </button>
    );
  }

  return (
    <div style={CARD} className="font-opensans">
      <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "10px" }}>
        Add a story (publishes immediately)
      </h3>

      <div className="grid gap-3 md:grid-cols-2" style={{ marginBottom: "10px" }}>
        <div className="md:col-span-2">
          <span style={LABEL}>Headline *</span>
          <input style={INPUT} value={f.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <span style={LABEL}>Summary *</span>
          <textarea
            style={{ ...INPUT, minHeight: "70px" }}
            value={f.summary}
            onChange={(e) => set("summary", e.target.value)}
          />
        </div>
        <div>
          <span style={LABEL}>Category *</span>
          <select style={INPUT} value={f.category} onChange={(e) => set("category", e.target.value)}>
            {NEWS_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span style={LABEL}>Source name</span>
          <input style={INPUT} value={f.source} onChange={(e) => set("source", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <span style={LABEL}>Source URL</span>
          <input style={INPUT} value={f.source_url} onChange={(e) => set("source_url", e.target.value)} />
        </div>
        <div>
          <span style={LABEL}>County</span>
          <input style={INPUT} value={f.county} onChange={(e) => set("county", e.target.value)} />
        </div>
        <div>
          <span style={LABEL}>Organization</span>
          <input style={INPUT} value={f.org_name} onChange={(e) => set("org_name", e.target.value)} />
        </div>
        <div>
          <span style={LABEL}>Deadline (free text)</span>
          <input style={INPUT} value={f.deadline} onChange={(e) => set("deadline", e.target.value)} />
        </div>
        <div>
          <span style={LABEL}>Expires</span>
          <input
            type="date"
            style={INPUT}
            value={f.expires_at}
            onChange={(e) => set("expires_at", e.target.value)}
          />
        </div>
        <ResourcePicker value={f.directory_id_no} onChange={(v) => set("directory_id_no", v)} />
      </div>

      {err && <p style={{ color: "#B8001F", fontSize: "13px", marginBottom: "8px" }}>{err}</p>}

      <div className="flex items-center" style={{ gap: "10px" }}>
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="hover:brightness-110"
          style={{
            backgroundColor: "#3DB800",
            color: "#FFF",
            fontWeight: 700,
            fontSize: "13.5px",
            padding: "8px 18px",
            borderRadius: "5px",
            opacity: busy ? 0.6 : 1,
          }}
        >
          Publish story
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{ fontSize: "13.5px", textDecoration: "underline" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const AdminReviewPage = ({ loggedInUser }) => {
  // "new" = the review queue; "published" = what's LIVE and unexpired right now
  // (the server applies the same expiry filter the feed does), so a story can be
  // edited after publishing — that's what makes expires_at (repeat a story)
  // usable without going into Supabase.
  const [tab, setTab] = useState("new");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAdmin = Number(loggedInUser?.account_id) === ADMIN_ACCOUNT_ID;

  const load = () => {
    setLoading(true);
    fetch(`/admin-findings?status=${tab}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error || "Failed to load");
        setItems(data.items || []);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, tab]);

  // Non-admins never see this page (the server refuses them anyway).
  if (!isAdmin) return <Navigate to="/find" replace />;

  return (
    <div className="h-screen flex flex-row overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <nav
          className="bg-navbar1-bg flex items-center justify-between"
          style={{
            height: "var(--height-navbar1)",
            paddingLeft: "var(--padding-navbar1-left)",
            paddingRight: "var(--padding-navbar1-right)",
          }}
        >
          <div className="flex items-center" style={{ gap: "var(--gap-navbar1-logo-title)" }}>
            <img
              src="/images/CRG Logo 2025.webp"
              alt="CRG Logo"
              style={{ width: "var(--size-navbar1-logo)", height: "var(--size-navbar1-logo)" }}
              className="object-contain"
            />
            <h1
              className="text-navbar1-title font-comfortaa"
              style={{
                fontSize: "var(--font-size-navbar1-title)",
                fontWeight: "var(--font-weight-navbar1-title)",
                letterSpacing: "var(--letter-spacing-navbar1-title)",
              }}
            >
              Community Resources Guide Houston
            </h1>
          </div>
          <span
            className="font-opensans"
            style={{
              color: "var(--color-navbar1-section-title)",
              fontSize: "var(--font-size-navbar1-btn)",
              fontWeight: "var(--font-weight-navbar1-btn)",
              letterSpacing: "var(--letter-spacing-navbar1-btn)",
            }}
          >
            Admin Review
          </span>
        </nav>

        <main
          className="flex-1 overflow-y-auto"
          style={{ backgroundColor: "var(--color-page-background)", padding: "26px 24px 40px" }}
        >
          <div style={{ maxWidth: "980px", margin: "0 auto" }}>
            <header style={{ marginBottom: "16px" }}>
              <h2 className="font-opensans" style={{ fontSize: "24px", fontWeight: 700 }}>
                {tab === "new" ? "Review Queue" : "Live on the Feed"}
              </h2>
              <p
                className="font-opensans"
                style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "3px" }}
              >
                {(() => {
                  if (loading) return "Loading…";
                  const n = items.length;
                  return tab === "new"
                    ? `${n} finding${n === 1 ? "" : "s"} awaiting review. Published stories appear on the News page and in the chyron.`
                    : `${n} ${n === 1 ? "story is" : "stories are"} live and unexpired. Change the expiration to keep a story running, or remove it from the feed.`;
                })()}
              </p>
            </header>

            {/* Queue / Published toggle */}
            <div className="flex" style={{ gap: "8px", marginBottom: "16px" }}>
              {[
                { key: "new", label: "Review Queue" },
                { key: "published", label: "Published" },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className="font-opensans hover:brightness-110"
                  style={{
                    fontSize: "13.5px",
                    fontWeight: 700,
                    padding: "7px 16px",
                    borderRadius: "6px",
                    backgroundColor: tab === t.key ? "#652C57" : "transparent",
                    color: tab === t.key ? "#FFC857" : "var(--color-text-primary)",
                    border: tab === t.key ? "none" : "1px solid #B4AFA6",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <AddStoryForm onAdded={load} />

            {error && (
              <div className="font-opensans" style={{ color: "#B8001F", marginBottom: "12px" }}>
                {error}
              </div>
            )}

            {!loading && items.length === 0 && !error && (
              <div className="font-opensans" style={{ color: "var(--color-text-secondary)" }}>
                {tab === "new"
                  ? "Nothing to review. The next weekly scan will fill this up."
                  : "Nothing is live right now. Publish something from the Review Queue."}
              </div>
            )}

            {items.map((item) => (
              <FindingCard
                key={item.id}
                item={item}
                mode={tab}
                onDone={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
              />
            ))}
          </div>
        </main>

        <Footer />
      </div>

      <VerticalNavBar />
    </div>
  );
};

export default AdminReviewPage;
