// src/components/HelpPanel.js
// LLM-powered help panel with chat interface
// Opens from the Information icon in VerticalNavBar
// Draggable and non-modal - user can interact with app while open

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppData } from "../Contexts/AppDataContext";
import {
  HomeIcon,
  HelpBubbleIcon,
  ReportsIcon,
  AnnouncementsIcon,
  PrivacyPolicyIcon,
  ContactSupportIcon,
  DistanceIcon,
  FoodPantriesIcon,
  RentIcon,
  UtilitiesIcon,
} from "../icons";
import { LOADING_MESSAGES } from "../constants/loadingMessages";

// Map of icon keywords to components for inline rendering
// These render miniature UI mockups in chat bubbles - colors must match actual UI
// Using CSS variables where possible for consistency with design tokens
const ICON_MAP = {
  // Sidebar icons
  "[[HOME_ICON]]": <HomeIcon size={20} active={true} />,
  "[[INFO_ICON]]": <HelpBubbleIcon size={20} active={true} />,
  "[[REPORTS_ICON]]": <ReportsIcon size={20} active={true} />,
  "[[ANNOUNCEMENTS_ICON]]": <AnnouncementsIcon size={20} active={true} />,
  "[[PRIVACY_ICON]]": <PrivacyPolicyIcon size={20} active={true} />,
  "[[CONTACT_ICON]]": <ContactSupportIcon size={20} active={true} />,

  // Assistance type icons
  "[[FOOD_ICON]]": <FoodPantriesIcon size={20} />,
  "[[RENT_ICON]]": <RentIcon size={20} />,
  "[[UTILITIES_ICON]]": <UtilitiesIcon size={20} />,

  // Counters in header (uses NavBar1 counter tokens)
  "[[ORANGE_CIRCLE]]": (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold" style={{ backgroundColor: "var(--color-navbar1-counter-filtered)", color: "var(--color-navbar1-counter-text-filtered)" }}>5</span>
  ),
  "[[BLUE_CIRCLE]]": (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold" style={{ backgroundColor: "var(--color-navbar1-counter-selected)", color: "var(--color-navbar1-counter-text-selected)" }}>2</span>
  ),

  // Header buttons (uses NavBar1 button tokens)
  "[[EMAIL_BTN]]": (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "var(--color-navbar1-btn-email-bg)", color: "var(--color-navbar1-btn-email-text)" }}>Send Email</span>
  ),
  "[[PDF_BTN]]": (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "var(--color-navbar1-btn-pdf-bg)", color: "var(--color-navbar1-btn-pdf-text)" }}>Create PDF</span>
  ),

  // Search mode buttons (uses NavBar2 tokens)
  "[[ZIP_CODE_BTN]]": (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "var(--color-navbar2-btn-active-bg)", color: "var(--color-navbar2-btn-active-text)" }}>Zip Code</span>
  ),
  "[[ORGANIZATION_BTN]]": (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "var(--color-navbar2-bg)", color: "var(--color-navbar2-btn-inactive-text)" }}>Organization</span>
  ),
  "[[LOCATION_BTN]]": (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "var(--color-navbar2-bg)", color: "var(--color-navbar2-btn-inactive-text)" }}>Location</span>
  ),
  "[[LLM_SEARCH_BTN]]": (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "var(--color-navbar2-bg)", color: "var(--color-navbar2-btn-inactive-text)" }}>LLM Search</span>
  ),

  // Dropdowns and input fields (uses NavBar2 dropdown tokens)
  "[[ZIP_DROPDOWN]]": (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "var(--color-navbar2-dropdown-bg)", color: "var(--color-navbar2-dropdown-text)" }}>77002 ▾</span>
  ),
  "[[LLM_INPUT]]": (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "var(--color-navbar2-bg)", color: "var(--color-navbar2-btn-inactive-text)" }}>What are you looking for today?</span>
  ),

  // Distance icon
  "[[DISTANCE_ICON]]": (
    <span className="inline-flex items-center justify-center rounded" style={{ backgroundColor: "var(--color-navbar2-bg)", padding: "2px 4px" }}>
      <DistanceIcon size={20} />
    </span>
  ),

  // Assistance bar elements (uses NavBar3 tokens)
  "[[SELECT_ASSISTANCE_BTN]]": (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "var(--color-navbar3-bg)", color: "var(--color-navbar3-chip-active-text)" }}>Select Assistance ▾</span>
  ),
  "[[CHIP_ACTIVE]]": (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "var(--color-navbar3-chip-active-bg)", color: "var(--color-navbar3-chip-active-text)" }}>Food</span>
  ),
  "[[CHIP_INACTIVE]]": (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "var(--color-navbar3-chip-inactive-bg)", color: "var(--color-navbar3-chip-inactive-text)", border: "1px solid var(--color-navbar3-chip-inactive-border)" }}>Rent</span>
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

export default function HelpPanel({ isOpen, onClose, resetKey }) {
  const { loggedInUser } = useAppData();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [error, setError] = useState(null);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isMobile, setIsMobile] = useState(false);

  // Check for mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  // Rotate loading messages while loading
  useEffect(() => {
    if (!isLoading) return;

    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % LOADING_MESSAGES.length;
      setLoadingMessage(LOADING_MESSAGES[index]);
    }, 1500);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset conversation when resetKey changes (user clicked Help icon)
  useEffect(() => {
    setMessages([]);
    setQuestion("");
    setError(null);
    // Position panel in top-left area, leaving room for nav bars
    setPosition({ x: 50, y: 220 });
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [resetKey, isOpen]);

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
          regOrganization: loggedInUser?.reg_organization || "Guest",
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
          // On mobile: full screen. On desktop: draggable with fixed size
          left: isMobile ? 0 : position.x,
          top: isMobile ? 0 : position.y,
          right: isMobile ? 0 : "auto",
          bottom: isMobile ? 0 : "auto",
          width: isMobile ? "100%" : "var(--width-help-panel)",
          height: isMobile ? "100%" : "var(--height-help-panel)",
          maxWidth: isMobile ? "100%" : "calc(100vw - 32px)",
          maxHeight: isMobile ? "100%" : "calc(100vh - 32px)",
          borderRadius: isMobile ? 0 : "var(--radius-panel)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          border: isMobile ? "none" : "2px solid var(--color-panel-border, #F3EED9)",
          cursor: isDragging && !isMobile ? "grabbing" : "default",
        }}
      >
          {/* Header - draggable, follows standard panel formatting */}
          <div
            onMouseDown={handleMouseDown}
            className="flex flex-col items-center justify-center px-4 relative"
            style={{
              backgroundColor: "var(--color-panel-header-bg)",
              height: "var(--height-panel-header)",
              flexShrink: 0,
              cursor: isMobile ? "default" : (isDragging ? "grabbing" : "grab"),
            }}
          >
            <h2
              className="font-opensans select-none"
              style={{
                color: "var(--color-panel-title)",
                fontSize: "var(--font-size-panel-title)",
                fontWeight: "var(--font-weight-panel-title)",
                letterSpacing: "var(--letter-spacing-panel-title)",
              }}
            >
              Help
            </h2>
            <p
              className="font-opensans select-none"
              style={{
                color: "var(--color-panel-subtitle)",
                fontSize: "var(--font-size-panel-subtitle)",
                letterSpacing: "var(--letter-spacing-panel-subtitle)",
              }}
            >
              Ask me anything about using the CRG app!
            </p>
            <div className="absolute right-4 flex items-center gap-3">
              <span
                className="font-opensans select-none"
                style={{ color: "var(--color-help-drag-hint)", fontSize: "var(--font-size-help-drag-hint)" }}
              >
                drag to move
              </span>
              <button
                onClick={onClose}
                className="text-white hover:brightness-125 transition-all"
                style={{ fontSize: "var(--font-size-help-close-btn)", lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div
            className="flex-1 overflow-y-auto p-4"
            style={{
              backgroundColor: "var(--color-help-body-bg)",
            }}
          >
            {messages.length === 0 && !isLoading && (
              <div className="text-center py-8">
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
                      className="block w-full text-left px-3 py-2 rounded transition-colors font-opensans"
                      style={{
                        fontSize: "var(--font-size-help-suggestion)",
                        color: "var(--color-help-suggestion-text)",
                        backgroundColor: "var(--color-help-suggestion-bg)",
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = "var(--color-help-suggestion-hover-bg)"}
                      onMouseLeave={(e) => e.target.style.backgroundColor = "var(--color-help-suggestion-bg)"}
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
                  className="inline-block px-3 py-2 rounded-lg font-opensans"
                  style={{
                    maxWidth: "90%",
                    fontSize: "var(--font-size-help-message)",
                    lineHeight: "var(--line-height-help-message)",
                    whiteSpace: "pre-wrap",
                    backgroundColor: msg.type === "user"
                      ? "var(--color-help-user-bubble-bg)"
                      : "var(--color-help-assistant-bubble-bg)",
                    color: msg.type === "user"
                      ? "var(--color-help-user-bubble-text)"
                      : "var(--color-help-assistant-bubble-text)",
                    boxShadow: msg.type === "assistant"
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
                  className="inline-block px-4 py-2 rounded-lg font-opensans"
                  style={{
                    backgroundColor: "var(--color-help-assistant-bubble-bg)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    fontSize: "var(--font-size-help-message)",
                    color: "var(--color-help-assistant-bubble-text)",
                    fontStyle: "italic",
                  }}
                >
                  {loadingMessage}
                </div>
              </div>
            )}

            {error && (
              <div className="text-left mb-3">
                <div
                  className="inline-block px-4 py-2 rounded-lg font-opensans"
                  style={{
                    fontSize: "var(--font-size-help-message)",
                    backgroundColor: "var(--color-help-error-bg)",
                    color: "var(--color-help-error-text)",
                  }}
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
              borderTop: "1px solid var(--color-help-input-border)",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Type your question..."
              disabled={isLoading}
              className="flex-1 px-3 py-2 rounded font-opensans focus:outline-none focus:ring-2"
              style={{
                fontSize: "var(--font-size-help-input)",
                backgroundColor: "var(--color-help-input-bg)",
                border: "1px solid var(--color-help-input-border)",
                "--tw-ring-color": "var(--color-form-focus-ring)",
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !question.trim()}
              className="font-opensans transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "var(--color-panel-btn-ok-bg)",
                color: "var(--color-panel-btn-text)",
                fontSize: "var(--font-size-panel-btn)",
                letterSpacing: "var(--letter-spacing-panel-btn)",
                width: "var(--width-panel-btn)",
                height: "var(--height-panel-btn)",
                borderRadius: "var(--radius-panel-btn)",
              }}
            >
              Ask
            </button>
          </form>
      </motion.div>
    </AnimatePresence>
  );
}
