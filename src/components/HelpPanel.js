// src/components/HelpPanel.js
// LLM-powered help panel with chat interface
// Opens from the Information icon in VerticalNavBar
// Draggable and non-modal - user can interact with app while open

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HomeIcon,
  HelpBubbleIcon,
  ReportsIcon,
  FoodPantriesIcon,
  RentIcon,
  UtilitiesIcon,
} from "../icons";

// Map of icon keywords to components for inline rendering
const ICON_MAP = {
  // Sidebar icons
  "[[HOME_ICON]]": <HomeIcon size={20} active={true} />,
  "[[INFO_ICON]]": <HelpBubbleIcon size={20} active={true} />,
  "[[REPORTS_ICON]]": <ReportsIcon size={20} active={true} />,

  // Assistance type icons
  "[[FOOD_ICON]]": <FoodPantriesIcon size={20} />,
  "[[RENT_ICON]]": <RentIcon size={20} />,
  "[[UTILITIES_ICON]]": <UtilitiesIcon size={20} />,

  // Counters in header
  "[[ORANGE_CIRCLE]]": (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold" style={{ backgroundColor: "#EB6E1F", color: "#002E62" }}>5</span>
  ),
  "[[BLUE_CIRCLE]]": (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold" style={{ backgroundColor: "#002E62", color: "#EB6E1F" }}>2</span>
  ),

  // Header buttons
  "[[EMAIL_BTN]]": (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "#E5BA66", color: "#222831" }}>Send Email</span>
  ),
  "[[PDF_BTN]]": (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "#6678e5", color: "#FFFFFF" }}>Create PDF</span>
  ),

  // Search mode buttons (gray bar) - use gray bg so they're visible in white chat bubbles
  "[[ZIP_CODE_BTN]]": (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "#222831", color: "#FFC857" }}>Zip Code</span>
  ),
  "[[ORGANIZATION_BTN]]": (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "#4A4F56", color: "#F3EED9" }}>Organization</span>
  ),
  "[[LOCATION_BTN]]": (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "#4A4F56", color: "#F3EED9" }}>Location</span>
  ),
  "[[LLM_SEARCH_BTN]]": (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "#4A4F56", color: "#F3EED9" }}>LLM Search</span>
  ),

  // Dropdowns (green)
  "[[ZIP_DROPDOWN]]": (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "#2d6552", color: "#F3EED9" }}>77002 ▾</span>
  ),

  // Distance icon
  "[[DISTANCE_ICON]]": (
    <span className="inline-block px-1 py-0.5 rounded text-xs" style={{ backgroundColor: "#4A4F56", color: "#F3EED9" }}>📍</span>
  ),

  // Assistance bar elements (tan bar) - use tan bg so visible in white chat bubbles
  "[[SELECT_ASSISTANCE_BTN]]": (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "#948979", color: "#F3EED9" }}>Select Assistance ▾</span>
  ),
  "[[CHIP_ACTIVE]]": (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "#2d6552", color: "#F3EED9" }}>Food</span>
  ),
  "[[CHIP_INACTIVE]]": (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "#F3EED9", color: "#000", border: "1px solid #000" }}>Rent</span>
  ),
};

// Parse message content and replace icon tokens with actual components
function renderMessageContent(content) {
  const parts = [];
  let lastIndex = 0;
  const regex = /\[\[[A-Z_]+\]\]/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    // Add the icon component or the original text if not found
    const iconKey = match[0];
    if (ICON_MAP[iconKey]) {
      parts.push(
        <span key={match.index} className="inline-flex items-center mx-1 align-middle">
          {ICON_MAP[iconKey]}
        </span>
      );
    } else {
      parts.push(iconKey);
    }
    lastIndex = regex.lastIndex;
  }
  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : content;
}

export default function HelpPanel({ isOpen, onClose }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens and reset position
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      // Position panel in top-left area, leaving room for nav bars
      setPosition({ x: 50, y: 220 });
    }
  }, [isOpen]);

  // Handle drag start
  const handleMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('input')) return;
    setIsDragging(true);
    const rect = panelRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // Handle drag move
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Build conversation history for API (last 6 messages for context)
  const buildConversationHistory = () => {
    return messages.slice(-6).map((msg) => ({
      role: msg.type === "user" ? "user" : "assistant",
      content: msg.content,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim() || isLoading) return;

    const userQuestion = question.trim();
    setQuestion("");
    setError(null);

    // Add user message
    setMessages((prev) => [...prev, { type: "user", content: userQuestion }]);
    setIsLoading(true);

    try {
      // Route to Wrangler dev server on localhost:8788 during dev
      const functionUrl =
        window.location.hostname === "localhost"
          ? "http://localhost:8788/help"
          : "/help";

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: userQuestion,
          conversationHistory: buildConversationHistory(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          { type: "assistant", content: data.answer },
        ]);
      } else {
        setError(data.message || "Failed to get help. Please try again.");
      }
    } catch (err) {
      console.error("Help API error:", err);
      setError("Unable to connect to help service. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed z-50 flex flex-col overflow-hidden"
        style={{
          left: position.x,
          top: position.y,
          width: "var(--width-help-panel)",
          height: "var(--height-help-panel)",
          borderRadius: "var(--radius-panel)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          border: "2px solid var(--color-panel-border, #F3EED9)",
          cursor: isDragging ? "grabbing" : "default",
        }}
      >
          {/* Header - draggable */}
          <div
            onMouseDown={handleMouseDown}
            className="flex items-center justify-between px-4"
            style={{
              backgroundColor: "var(--color-panel-header-bg)",
              height: "var(--height-help-header)",
              flexShrink: 0,
              cursor: isDragging ? "grabbing" : "grab",
            }}
          >
            <h2
              className="font-opensans select-none"
              style={{
                color: "var(--color-panel-title)",
                fontSize: "16px",
                fontWeight: "600",
              }}
            >
              ❓ Help
            </h2>
            <div className="flex items-center gap-2">
              <span
                className="font-opensans select-none"
                style={{ color: "#999", fontSize: "11px" }}
              >
                drag to move
              </span>
              <button
                onClick={onClose}
                className="text-white hover:brightness-125 transition-all"
                style={{ fontSize: "20px", lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div
            className="flex-1 overflow-y-auto p-4"
            style={{
              backgroundColor: "#f5f5f5",
            }}
          >
            {messages.length === 0 && !isLoading && (
              <div className="text-center py-8">
                <p
                  className="font-opensans mb-4"
                  style={{ color: "#666", fontSize: "14px" }}
                >
                  Ask me anything about using the CRG app!
                </p>
                <div className="space-y-2">
                  {[
                    "How do I email resources to a client?",
                    "How do I filter by assistance type?",
                    "What does the distance icon do?",
                    "How do I use LLM Search?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setQuestion(suggestion);
                        inputRef.current?.focus();
                      }}
                      className="block w-full text-left px-3 py-2 rounded hover:bg-white transition-colors font-opensans"
                      style={{
                        fontSize: "13px",
                        color: "#2d6552",
                        backgroundColor: "rgba(45, 101, 82, 0.1)",
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, index) => (
              <div
                key={index}
                className={`mb-3 ${msg.type === "user" ? "text-right" : "text-left"}`}
              >
                <div
                  className={`inline-block px-3 py-2 rounded-lg font-opensans ${
                    msg.type === "user"
                      ? "bg-[#2d6552] text-white"
                      : "bg-white text-gray-800"
                  }`}
                  style={{
                    maxWidth: "90%",
                    fontSize: "13px",
                    lineHeight: "1.6",
                    whiteSpace: "pre-wrap",
                    boxShadow:
                      msg.type === "assistant"
                        ? "0 1px 3px rgba(0,0,0,0.1)"
                        : "none",
                  }}
                >
                  {msg.type === "assistant"
                    ? renderMessageContent(msg.content)
                    : msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="text-left mb-3">
                <div
                  className="inline-block px-4 py-2 rounded-lg bg-white"
                  style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
                >
                  <span className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="text-left mb-3">
                <div
                  className="inline-block px-4 py-2 rounded-lg bg-red-100 text-red-700 font-opensans"
                  style={{ fontSize: "14px" }}
                >
                  {error}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <form
            onSubmit={handleSubmit}
            className="flex gap-2 p-3"
            style={{
              backgroundColor: "var(--color-panel-body-bg)",
              borderTop: "1px solid #ddd",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Type your question..."
              disabled={isLoading}
              className="flex-1 px-3 py-2 rounded font-opensans focus:outline-none focus:ring-2 focus:ring-[#2d6552]"
              style={{
                fontSize: "14px",
                backgroundColor: "white",
                border: "1px solid #ccc",
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !question.trim()}
              className="px-4 py-2 rounded font-opensans transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "var(--color-panel-btn-ok-bg)",
                color: "var(--color-panel-btn-text)",
                fontSize: "14px",
              }}
            >
              Ask
            </button>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearChat}
                className="px-3 py-2 rounded font-opensans transition-all hover:brightness-110"
                style={{
                  backgroundColor: "#999",
                  color: "white",
                  fontSize: "14px",
                }}
                title="Clear chat"
              >
                Clear
              </button>
            )}
          </form>
      </motion.div>
    </AnimatePresence>
  );
}
