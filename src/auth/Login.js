// src/auth/Login.js
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PageLayout from "../layout/PageLayout";
import { dataService } from "../services/dataService";
import ContactForm from "../components/ContactForm";

export default function LoginPage({ onLoginSuccess }) {
  const [orgList, setOrgList] = useState([]);
  const [org, setOrg] = useState("");
  const [, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const [orgData, setOrgData] = useState([]);
  const [showContactForm, setShowContactForm] = useState(false);
  const [scrollingOrgs, setScrollingOrgs] = useState([]); // Organizations for sidebar scroll
  const navigate = useNavigate();
  const formRef = useRef(null);
  const passcodeInputRef = useRef(null);

  useEffect(() => {
    setPasscode("");
  }, []);

  // Fetch registered organizations for login dropdown
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const data = await dataService.getRegisteredOrganizations();
        const uniqueOrgs = [
          ...new Set(data.map((item) => item.reg_organization)),
        ];
        setOrgList(uniqueOrgs);
        setOrgData(data);
      } catch (err) {
        console.error("Error loading organizations:", err);
      }
    };
    fetchOrganizations();
  }, []);

  // Fetch organizations table for sidebar scrolling display
  useEffect(() => {
    const fetchScrollingOrgs = async () => {
      try {
        const data = await dataService.getOrganizations();
        const orgNames = data
          .filter((item) => item.id_no <= 8000)
          .map((item) => item.organization);
        setScrollingOrgs(orgNames);
      } catch (err) {
        console.error("Error loading scrolling organizations:", err);
      }
    };
    fetchScrollingOrgs();
  }, []);

  // Focus on passcode field when organization is selected
  useEffect(() => {
    if (org && passcodeInputRef.current) {
      passcodeInputRef.current.focus();
    }
  }, [org]);

  useEffect(() => {
    if (!org && passcodeInputRef.current) {
      passcodeInputRef.current.value = "";
    }
  }, [org]);

  // Handle guest access - bypass login with guest user object
  const handleGuestAccess = () => {
    setIsAnimating(true);
    setTimeout(() => {
      // Pass guest user object (no email/PDF access)
      onLoginSuccess({
        id: 'guest',
        organization: 'Guest',
        isGuest: true,
        canEmail: false,
        canPdf: false,
      });

      // Preserve UTM parameters
      const searchParams = new URLSearchParams(window.location.search);
      const utmParams = new URLSearchParams();
      for (const [key, value] of searchParams.entries()) {
        if (key.startsWith('utm_')) {
          utmParams.append(key, value);
        }
      }
      const utmString = utmParams.toString();
      navigate(utmString ? `/?${utmString}` : '/');
    }, 600);
  };

  const handleLogin = (e) => {
    if (e) e.preventDefault();

    const enteredPasscode = passcodeInputRef.current?.value || "";

    const matched = orgData.find(
      (entry) =>
        entry.reg_organization === org &&
        entry.org_passcode === enteredPasscode
    );

    if (matched) {
      setError("");
      setIsAnimating(true);
      setTimeout(() => {
        onLoginSuccess(matched);

        // Preserve UTM parameters from login URL
        const searchParams = new URLSearchParams(window.location.search);
        const utmParams = new URLSearchParams();
        for (const [key, value] of searchParams.entries()) {
          if (key.startsWith('utm_')) {
            utmParams.append(key, value);
          }
        }
        const utmString = utmParams.toString();
        navigate(utmString ? `/?${utmString}` : '/');
      }, 600);
    } else {
      setError(
        <div className="text-center">
          Invalid credentials.{" "}
          <button
            type="button"
            onClick={() => setShowContactForm(true)}
            className="underline hover:opacity-80"
            style={{ color: "var(--color-login-btn-guest-bg)" }}
          >
            Contact Support
          </button>
        </div>
      );
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <PageLayout showNav={false}>
      <AnimatePresence>
        {!isAnimating && (
          <motion.div
            className="flex flex-col items-center justify-center md:items-end md:justify-start md:pt-[80px] md:pr-[60px] bg-no-repeat relative"
            style={{
              backgroundImage: `url('images/CRG Background NEW 2025.webp')`,
              minHeight: 'calc(100vh - var(--height-footer))',
              backgroundSize: 'contain',
              backgroundPosition: 'left center',
              backgroundColor: '#5d0504',
            }}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
          >
            {/* Easter Egg - Only visible in the dark area to the right of the background image */}
            {/* Uses aspect-ratio calculation: image is ~1200x800, so at viewport height H, image width = H * 1.5 */}
            {/* This container starts where the image ends and fills the remaining space */}
            <div
              className="absolute top-0 bottom-0 right-0 overflow-hidden pointer-events-none flex flex-col items-center justify-center"
              style={{
                left: 'calc((100vh - var(--height-footer)) * 1.5)', // Image aspect ratio ~1.5:1
                minWidth: '150px', // Only show if there's enough space
              }}
            >
              {/* Animated logo video */}
              <video
                src="images/GPT-Image-15-Medium-dfb214ea.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-32 h-32 object-contain opacity-70"
              />

              {/* Floating sparkles - spread across full height */}
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute text-2xl"
                  style={{
                    left: `${20 + (i * 15) % 160}px`,
                    top: `${5 + (i * 8)}%`,
                  }}
                  animate={{
                    y: [0, -20, 0],
                    opacity: [0.3, 0.8, 0.3],
                    scale: [0.8, 1.2, 0.8],
                  }}
                  transition={{
                    duration: 3 + (i % 3),
                    repeat: Infinity,
                    delay: i * 0.4,
                    ease: "easeInOut",
                  }}
                >
                  ✨
                </motion.div>
              ))}

              {/* Scrolling organization names - continuous loop from bottom to top */}
              {scrollingOrgs.length > 0 && (
                <motion.div
                  className="absolute left-0 right-0 font-opensans text-sm"
                  style={{
                    color: "#F3EED9",
                    opacity: 0.5,
                    top: "100%", // Start from bottom of container
                    zIndex: 0, // Behind the login panel
                  }}
                  animate={{
                    y: [0, -(scrollingOrgs.length * 24 + window.innerHeight)],
                  }}
                  transition={{
                    duration: scrollingOrgs.length * 1.5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  {scrollingOrgs.map((orgName, i) => (
                    <div key={i} className="py-1 px-2 truncate" style={{ height: "24px" }}>
                      {orgName}
                    </div>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Login Panel */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="w-[90%] max-w-[500px] rounded-lg overflow-hidden"
              style={{
                boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.4)',
                border: 'var(--width-panel-border) solid var(--color-panel-border)',
                zIndex: 10,
                position: 'relative',
              }}
            >
              {/* Panel Header - Logo + Title */}
              <div
                className="flex items-center justify-center gap-3 px-4"
                style={{
                  backgroundColor: "var(--color-panel-header-bg)",
                  height: "var(--height-panel-header)",
                }}
              >
                <img
                  src="images/CRG Logo 2025.webp"
                  alt="CRG Logo"
                  className="w-[30px] h-[30px]"
                />
                <span
                  className="font-comfortaa"
                  style={{
                    color: "var(--color-panel-title)",
                    fontSize: "18px",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    marginTop: "4px",
                  }}
                >
                  Community Resources Guide Houston
                </span>
              </div>

              {/* Panel Body */}
              <div
                className="px-6 py-6"
                style={{ backgroundColor: "var(--color-panel-body-bg)" }}
              >
                {/* Browse Without Account Button */}
                <button
                  type="button"
                  onClick={handleGuestAccess}
                  className="w-full py-3 font-opensans hover:brightness-95 transition-all"
                  style={{
                    backgroundColor: "var(--color-login-btn-guest-bg)",
                    color: "var(--color-login-btn-guest-text)",
                    borderRadius: "var(--radius-login-btn)",
                    fontSize: "16px",
                    letterSpacing: "0.05em",
                    fontWeight: 500,
                  }}
                >
                  Browse Without Account
                </button>

                {/* Registered Organizations Section */}
                <div
                  className="mt-6 px-4 py-4 rounded"
                  style={{
                    backgroundColor: "var(--color-login-label-bg)",
                    borderRadius: "var(--radius-login-btn)",
                  }}
                >
                  {/* Section Label */}
                  <div
                    className="text-center mb-4 font-opensans"
                    style={{
                      color: "var(--color-login-label-text)",
                      fontSize: "14px",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Registered Organizations
                  </div>

                  <form ref={formRef} onSubmit={handleLogin} autoComplete="on" key={org || 'no-org'}>
                    {/* Select Organization Dropdown */}
                    <div className="relative mb-3">
                      <select
                        className="w-full px-4 py-2 font-opensans appearance-none cursor-pointer"
                        style={{
                          backgroundColor: "var(--color-login-input-bg)",
                          color: "var(--color-login-input-text)",
                          borderRadius: "var(--radius-login-btn)",
                          fontSize: "14px",
                          letterSpacing: "0.05em",
                        }}
                        value={org}
                        name={`organization-${org}`}
                        autoComplete="organization"
                        onChange={(e) => setOrg(e.target.value)}
                      >
                        <option value="">Select Organization</option>
                        {orgList.map((o, i) => (
                          <option key={i} value={o}>{o}</option>
                        ))}
                      </select>
                      {/* Dropdown Arrow */}
                      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="var(--color-login-input-text)"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>

                    {/* Hidden username field for password manager */}
                    <input
                      type="text"
                      name="username"
                      autoComplete="username"
                      value={org}
                      onChange={() => {}}
                      style={{ display: 'none' }}
                      tabIndex="-1"
                    />

                    {/* Enter Passcode Input */}
                    <style>
                      {`
                        .login-passcode-input:-webkit-autofill,
                        .login-passcode-input:-webkit-autofill:hover,
                        .login-passcode-input:-webkit-autofill:focus,
                        .login-passcode-input:-webkit-autofill:active {
                          -webkit-box-shadow: 0 0 0 30px var(--color-login-input-bg) inset !important;
                          -webkit-text-fill-color: var(--color-login-input-text) !important;
                          caret-color: var(--color-login-input-text) !important;
                          transition: background-color 5000s ease-in-out 0s;
                        }
                      `}
                    </style>
                    <input
                      ref={passcodeInputRef}
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter Passcode"
                      className="login-passcode-input w-full px-4 py-2 font-opensans mb-4"
                      style={{
                        backgroundColor: "var(--color-login-input-bg)",
                        color: "var(--color-login-input-text)",
                        borderRadius: "var(--radius-login-btn)",
                        fontSize: "14px",
                        letterSpacing: "0.05em",
                      }}
                      onKeyPress={handleKeyPress}
                    />

                    {/* Login Button */}
                    <button
                      type="submit"
                      className="w-full py-2 font-opensans hover:brightness-95 transition-all"
                      style={{
                        backgroundColor: "var(--color-login-btn-login-bg)",
                        color: "var(--color-login-btn-login-text)",
                        borderRadius: "var(--radius-login-btn)",
                        fontSize: "14px",
                        letterSpacing: "0.05em",
                        fontWeight: 500,
                      }}
                    >
                      Log in
                    </button>
                  </form>

                  {/* Error Message */}
                  {error && (
                    <div
                      className="mt-3 text-sm"
                      style={{ color: "#B8001F" }}
                    >
                      {error}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ContactForm Modal */}
      {showContactForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Contact Support</h2>
              <button
                onClick={() => setShowContactForm(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <ContactForm
              loginError="Invalid credentials - unable to access account"
              onClose={() => setShowContactForm(false)}
            />
          </div>
        </div>
      )}
    </PageLayout>
  );
}
