// src/auth/Login.js
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import PageLayout from "../layout/PageLayout";
import { useTranslate } from "../Utility/Translate";
import { dataService } from "../services/dataService"; // Import the data service
import useFetchCRGData from "../data/FetchDataSupabase"; // Import for total record count
import ContactForm from "../components/ContactForm"; // Add this import

export default function LoginPage({ onLoginSuccess }) {
  const [orgList, setOrgList] = useState([]);
  const [org, setOrg] = useState("");
  const [, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const [orgData, setOrgData] = useState([]);
  const [showContactForm, setShowContactForm] = useState(false); // Add this state
  const navigate = useNavigate();
  const formRef = useRef(null);
  
  // Reference to the passcode input field
  const passcodeInputRef = useRef(null);

  // Add counter animation setup
  const { records } = useFetchCRGData(); // Get all records for total record count
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));

  useEffect(() => {
    setPasscode("");
  }, []);

  // Use translation utility
  const { translate } = useTranslate();

  // Fetch organizations using the data service
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const data = await dataService.getRegisteredOrganizations();
        
        const uniqueOrgs = [
          ...new Set(data.map((item) => item.registered_organization)),
        ];
        
        setOrgList(uniqueOrgs);
        setOrgData(data);
      } catch (err) {
        console.error("Error loading organizations:", err);
      }
    };

    fetchOrganizations();
  }, []);

  // Animate counter when records are loaded
  useEffect(() => {
    if (records.length > 0) {
      // Small delay to let the component settle, then animate
      const timer = setTimeout(() => {
        const anim = animate(count, records.length, { 
          duration: 0.7, 
          ease: "easeOut" 
        });
        return () => anim.stop();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [records.length, count]);

  // Focus on passcode field when organization is selected
  useEffect(() => {
    if (org && passcodeInputRef.current) {
      passcodeInputRef.current.focus();
    }
  }, [org]);

  useEffect(() => {
    // Clear passcode input manually if no organization is selected
    if (!org && passcodeInputRef.current) {
      passcodeInputRef.current.value = "";
    }
  }, [org]);

  const handleLogin = (e) => {
  if (e) e.preventDefault();

  const enteredPasscode = passcodeInputRef.current?.value || "";

  const matched = orgData.find(
    (entry) =>
      entry.registered_organization === org &&
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
      
      // Extract all UTM parameters
      for (const [key, value] of searchParams.entries()) {
        if (key.startsWith('utm_')) {
          utmParams.append(key, value);
        }
      }
      
      // Navigate with UTM parameters if they exist
      const utmString = utmParams.toString();
      navigate(utmString ? `/?${utmString}` : '/');
    }, 1000);
  } else {
    // Modified error message with ContactForm link
    setError(
      <div>
        ❌ Invalid credentials. Please try again or . . .{" "}
        <button
          type="button"
          onClick={() => setShowContactForm(true)}
          className="text-blue-600 underline hover:text-blue-800 ml-1"
        >
          Contact Support for Help or Access
        </button>
      </div>
    );
  }
};

  // Handle key press for Enter key
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  // Modified JSX with responsive classes
  return (
    <PageLayout showNav={false}>
      <AnimatePresence>
        {!isAnimating && (
          <motion.div
            className="flex flex-col items-center bg-cover mt-[-1rem] md:mt-[-1rem] bg-center min-h-[calc(100vh-110px)]"
            style={{ backgroundImage: `url('images/CRG Background NEW 2025.webp')` }}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.6 }}
          >
            {/* Animated Counter */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
              className="w-[6rem] h-[6rem] bg-[#002e62] text-[#EB6E1F] text-[36px] font-comfortaa font-bold rounded-full flex items-center justify-center mb-1 mt-12 md:mt-44"
              style={{ boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.3)' }}
            >
              <motion.span>{rounded}</motion.span>
            </motion.div>

            <div 
              className="bg-[#fef6e4] p-4 md:p-8 rounded-lg w-[90%] md:w-full max-w-[600px] border-[.2rem] mt-8 md:mt-10 relative"
              style={{
                backgroundImage: 'linear-gradient(to bottom, rgba(247, 242, 233, 0.9), #f7f2e9)',
                boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.55)'
              }}
            >
              {/* Wrap form elements in a form tag */}
              <form ref={formRef} 
                    onSubmit={handleLogin} autoComplete="on" key={org || 'no-org'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 mb-0">
                  <label className="text-[0.9rem] md:text-[1rem]">{translate("tSelectOrganization")}</label>
                  <label className="text-[0.9rem] md:text-[1rem] text-right hidden md:block">
                    
                  </label>
                </div>
                <div className="relative w-full mb-6 md:mb-10">
                  <select
                    className="appearance-none w-full px-3 py-2 border-2 border-[#2B5D7D] bg-[#f7f2e9] rounded-lg text-[1rem] md:text-[1.18rem]
                    text-[#002D62]"
                    style={{ boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.2)' }}
                    value={org}
                    name={`organization-${org}`}
                    autoComplete="organization"
                    onChange={(e) => {
                      setOrg(e.target.value);
                    }}
                  >
                    <option value="">-- {translate("tSelectOrganization")} --</option>
                    {orgList.map((o, i) => (
                      <option key={i} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>

                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg
                      className="w-4 h-4 text-[#002D62]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 mb-0">
                  <label className="text-[0.9rem] md:text-[1rem]">{translate("tEnterPassCode")}</label>
                  <label className="text-[0.9rem] md:text-[1rem] text-right hidden md:block">
                    
                  </label>
                </div>
                {/* Hidden username field for password manager */}
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={org}
                  onChange={() => {}} // Controlled by the select above
                  style={{ display: 'none' }}
                  tabIndex="-1"
                />
                
                <input
                  ref={passcodeInputRef}
                  type="password"
                 
                  autoComplete="current-password"
                  placeholder=""
                  className="w-full px-3 py-2 border-2 border-[#2B5D7D] bg-[#FCF7F0] text-[#002D62] rounded-lg text-[1rem] md:text-[1.18rem] mb-6 md:mb-10
                    focus:ring-5 focus:ring-[#2B5D7D] focus:outline-none"
                  style={{boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.2)'}}
                  onKeyPress={handleKeyPress}
                />

                <button
                  type="submit"
                  className="w-full bg-[#002D62] text-white py-2 rounded-lg text-[1rem] md:text-[1.18rem] hover:bg-[#557c96] hover:opacity-100 transition"
                >
                  {translate("tLogin")}
                </button>
              </form>
              {error && <div className="text-red-500 mt-4">{error}</div>}
            </div>
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