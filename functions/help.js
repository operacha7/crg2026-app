// Cloudflare Pages Function: POST /help
// Endpoint: http(s)://<host>/help
// LLM-powered help system using Claude to answer questions about the CRG app

import { createClient } from "@supabase/supabase-js";
import { LLM_MODEL } from "./config.js";
// Single source of truth for the Help assistant's knowledge of the app.
// Edit functions/help-knowledge.js (not this file) to keep Help current.
import { HELP_SYSTEM_PROMPT } from "./help-knowledge.js";

// Inbound payload caps. Per-IP rate limiting is enforced separately at the
// Cloudflare dashboard via Rate Limiting Rules on the /help path.
const MAX_QUESTION_LENGTH = 1000;
const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_MSG_CHARS = 2000;

// Generate a simple anonymous session ID (not tied to user identity)
function generateSessionId() {
  return `help_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Log help query to Supabase for improvement tracking
async function logHelpQuery(env, question, response, sessionId, regOrganization) {
  try {
    // Support both VITE_ prefixed (existing Cloudflare config) and non-prefixed names
    const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
    const supabaseKey = env.VITE_SUPABASE_SECRET_KEY || env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.log("⚠️ Supabase not configured, skipping help log");
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase.from("help_logs").insert({
      question: question,
      response: response,
      session_id: sessionId,
      reg_organization: regOrganization,
    });

    if (error) {
      console.error("⚠️ Failed to log help query:", error.message, error.code, error.details);
    } else {
      console.log("📝 Help query logged successfully");
    }
  } catch (err) {
    // Don't fail the request if logging fails
    console.error("⚠️ Help logging error:", err.message);
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Preflight
  if (request.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("❓ Incoming help request...");

  if (!env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Help service not configured",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const { question, conversationHistory = [], regOrganization = null } = await request.json();

    if (!question || typeof question !== "string" || question.trim() === "") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Question is required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Hard caps on inbound payload to keep the LLM bill bounded if a client
    // (or attacker) tries to push a giant question or fabricated history. The
    // help UI sends short questions and ~6 messages of history, so these
    // ceilings are well above legitimate use.
    if (question.length > MAX_QUESTION_LENGTH) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Question is too long (max ${MAX_QUESTION_LENGTH} characters).`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("📦 Question:", question);

    // Trim history to the most recent N exchanges and clamp each message's
    // content length. Defensive against a client that bypasses the UI cap.
    const trimmedHistory = (Array.isArray(conversationHistory) ? conversationHistory : [])
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m) => ({
        role: m?.role,
        content:
          typeof m?.content === "string" && m.content.length > MAX_HISTORY_MSG_CHARS
            ? m.content.slice(0, MAX_HISTORY_MSG_CHARS)
            : m?.content,
      }));

    // Build messages array with conversation history
    const messages = [
      ...trimmedHistory,
      {
        role: "user",
        content: question,
      },
    ];

    // Call Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        max_tokens: 1024,
        system: HELP_SYSTEM_PROMPT,
        messages: messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Claude API error:", data);
      return new Response(
        JSON.stringify({
          success: false,
          message: data.error?.message || "Help service failed",
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const answer = data.content[0].text;
    console.log("✅ Help response generated");

    // Log the query for improvement tracking (non-blocking, but kept alive via waitUntil)
    const sessionId = generateSessionId();
    console.log("📝 Starting help log...");
    context.waitUntil(logHelpQuery(env, question, answer, sessionId, regOrganization));

    return new Response(
      JSON.stringify({
        success: true,
        answer: answer,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("🚨 Help function error:", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
