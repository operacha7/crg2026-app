// src/utils/browserInfo.js
// Best-effort human-readable "browser + version on OS" string derived from the
// User-Agent. Used to prefill the "text me" support message so problems can be
// diagnosed quickly (e.g. the outdated-Safari case where a user was stuck for
// months). Parsing UA strings is inherently imperfect; this targets the common
// browsers/OSes and degrades gracefully to "" when it can't tell.

export function getBrowserInfo() {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent || "";

  // Browser + version. Order matters: Edge and Opera both also contain
  // "Chrome", and Chrome contains "Safari", so check the more specific ones
  // first and Safari last.
  let browser = "";
  let version = "";
  let m;
  if ((m = ua.match(/Edg\/(\d+(?:\.\d+)?)/))) { browser = "Edge"; version = m[1]; }
  else if ((m = ua.match(/OPR\/(\d+(?:\.\d+)?)/))) { browser = "Opera"; version = m[1]; }
  else if ((m = ua.match(/Firefox\/(\d+(?:\.\d+)?)/))) { browser = "Firefox"; version = m[1]; }
  else if (/Chrome\//.test(ua) && (m = ua.match(/Chrome\/(\d+(?:\.\d+)?)/))) { browser = "Chrome"; version = m[1]; }
  else if (/Safari\//.test(ua) && (m = ua.match(/Version\/(\d+(?:\.\d+)?)/))) { browser = "Safari"; version = m[1]; }

  // Operating system
  let os = "";
  if (/Windows NT/.test(ua)) os = "Windows";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  const parts = [];
  if (browser) parts.push(version ? `${browser} ${version}` : browser);
  if (os) parts.push(`on ${os}`);
  return parts.join(" ");
}
