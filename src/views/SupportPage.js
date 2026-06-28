// src/views/SupportPage.js
// 2026 Redesign - Contact Support page (recommendation-first / subject-routed)
//
// One page, three runtime states driven by the Subject dropdown (Panel 2):
//   A) No subject chosen  -> nothing below Panel 2
//   B) Urgent subject     -> Text lane (primary) + collapsible email form
//   C) Any other subject  -> Email lane only
// The panel color-coding (blush/urgent-red/calm-teal left bars) and the
// subject routing are the heart of the design; everything is token-driven for
// the planned rebrand. See README handoff "Contact Support (Recommendation-First)".

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import VerticalNavBar from '../layout/VerticalNavBar';
import Footer from '../layout/Footer';
import MobileMenu from '../components/MobileMenu';
import { useAppData } from '../Contexts/AppDataContext';
import { SUPPORT_PHONE_E164 } from '../data/constants';
import { getBrowserInfo } from '../utils/browserInfo';

// Subject options. `value` is the stable router key; `label` is shown and sent
// as the email subject. Subjects in URGENT_SUBJECTS route to the text lane.
const SUBJECT_OPTIONS = [
  { value: '', label: 'Select a subject…' },
  { value: 'broken', label: "A feature or function isn't working" },
  { value: 'training', label: 'Training' },
  { value: 'account', label: 'I would like to setup an account' },
  { value: 'resource', label: 'Add or Change Resource Information' },
  { value: 'suggest', label: 'Suggestion to improve the site' },
  { value: 'other', label: 'Other' },
];

// Product decision (per handoff "Tweaks"): which subjects unlock texting.
// Default: only a broken feature is urgent. Add 'account' here to also treat
// login trouble as urgent.
const URGENT_SUBJECTS = new Set(['broken']);

// Required-field asterisk.
const Req = () => <span style={{ color: '#C0202A' }}> *</span>;

// Small uppercase recommendation label above each lane.
const RecoTag = ({ color, children }) => (
  <div className="flex items-center gap-2 mb-3" style={{ color }}>
    <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
    <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {children}
    </span>
  </div>
);

const SupportPage = ({ loggedInUser }) => {
  const { onLogout } = useAppData();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
    message: '',
  });
  const [subject, setSubject] = useState('');
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success', 'error', or null

  // Text lane: the browser/OS is captured read-only so the developer gets
  // accurate diagnostics fast. The user can remove it ("in or out") but cannot
  // edit it — re-adding always restores the true captured value, so we never
  // receive incorrect browser info. The message is a separate field.
  const [smsBrowser, setSmsBrowser] = useState('');
  const [includeBrowser, setIncludeBrowser] = useState(true);
  const [smsMessage, setSmsMessage] = useState('');
  useEffect(() => {
    setSmsBrowser(getBrowserInfo());
  }, []);

  // Composed text body = browser line (only when included) + the message.
  const smsBody = [
    includeBrowser && smsBrowser.trim() ? `Browser: ${smsBrowser.trim()}` : '',
    smsMessage,
  ]
    .filter(Boolean)
    .join('\n');
  const smsHref = `sms:${SUPPORT_PHONE_E164}?body=${encodeURIComponent(smsBody)}`;
  // Countdown on the message field (same pattern as the Email/PDF note).
  const MESSAGE_MAX = 160;
  const messageCharsRemaining = MESSAGE_MAX - smsMessage.length;
  const isUrgent = URGENT_SUBJECTS.has(subject);
  const showResult = subject !== '';

  // Auto-fill organization if user is logged in (not Guest)
  useEffect(() => {
    if (loggedInUser?.reg_organization && !loggedInUser?.isGuest) {
      setFormData((prev) => ({ ...prev, organization: loggedInUser.reg_organization }));
    }
  }, [loggedInUser]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const errors = [];
    if (!formData.name.trim()) errors.push('Name is required');
    if (!formData.email.trim()) errors.push('Email is required');
    if (!formData.organization.trim()) errors.push('Organization is required');
    if (!formData.message.trim()) errors.push('Message is required');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      errors.push('Please enter a valid email address');
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = validateForm();
    if (errors.length > 0) {
      alert('Please fix the following errors:\n' + errors.join('\n'));
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const functionUrl =
        window.location.hostname === 'localhost'
          ? 'http://localhost:8788/sendSupportEmail'
          : '/sendSupportEmail';

      // Subject now comes from the Panel 2 router, not a field inside the form.
      const subjectLabel = SUBJECT_OPTIONS.find((o) => o.value === subject)?.label || subject;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, subject: subjectLabel }),
      });

      const result = await response.json();

      if (result.success) {
        setSubmitStatus('success');
        setFormData({
          name: '',
          email: '',
          organization: (!loggedInUser?.isGuest && loggedInUser?.reg_organization) || '',
          message: '',
        });
      } else {
        setSubmitStatus('error');
        console.error('Support email failed:', result.message);
      }
    } catch (error) {
      setSubmitStatus('error');
      console.error('Error sending support email:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Same green slide-down toast used for Email/PDF/Text in the main app
  // (see showAnimatedToast in ZipCodePage). Slightly longer duration here so it
  // lingers a beat more before sliding away.
  const showAnimatedToast = (msg, type = 'success') => {
    toast.custom(
      () => (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 400, opacity: 1 }}
          exit={{ y: 300, opacity: 0 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className={`mx-auto px-6 py-4 rounded-lg shadow-lg text-lg font-semibold text-white w-fit ${
            type === 'error' ? 'bg-red-500' : 'bg-green-600'
          }`}
        >
          {msg}
        </motion.div>
      ),
      { duration: 5500 }
    );
  };

  // Text lane has no server submit (the message sends from the user's phone via
  // the QR's sms: link). This button gives the same closure as the email Send:
  // fully reset the form (including the subject, which collapses the result back
  // to the start) and toast. Optimistic — same fidelity model as email/PDF.
  const handleTextSent = () => {
    setSubject('');
    setEmailExpanded(false);
    setSubmitStatus(null);
    setSmsMessage('');
    setSmsBrowser(getBrowserInfo());
    setIncludeBrowser(true);
    setFormData({
      name: '',
      email: '',
      organization: (!loggedInUser?.isGuest && loggedInUser?.reg_organization) || '',
      message: '',
    });
    showAnimatedToast('Thanks — I’ll reply as soon as I get your text.');
  };

  // ----- shared style fragments -----
  const fieldClass =
    'w-full focus:outline-none focus:ring-2 focus:ring-[var(--color-support-accent-amber)]';
  const fieldStyle = {
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--color-support-field-border)',
    borderRadius: 8,
    padding: '13px 14px',
    fontSize: 15,
    color: 'var(--color-support-ink)',
    // Form controls don't inherit font-family — set it so inputs/select/textarea
    // are Open Sans like the rest of the page.
    fontFamily: 'var(--font-family-body)',
  };
  const labelStyle = { fontSize: 15, fontWeight: 600, color: 'var(--color-support-ink)' };

  // ----- email form (used by State C directly and State B's expander) -----
  const renderEmailForm = (submitLabel) => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-support-ink)', margin: '0 0 6px' }}>
          Email Me
        </h3>
        <p style={{ fontSize: 14, color: 'var(--color-support-ink)', margin: 0, lineHeight: 1.5 }}>
          For questions, an account, resource updates — anything that isn&rsquo;t urgent.
          Send me the details and I&rsquo;ll reply by email.
        </p>
      </div>

      <div>
        <label htmlFor="name" className="block mb-1" style={labelStyle}>
          Name<Req />
        </label>
        <input
          type="text" id="name" name="name" value={formData.name}
          onChange={handleInputChange} required
          className={fieldClass} style={fieldStyle} placeholder="Your full name"
        />
      </div>

      <div>
        <label htmlFor="email" className="block mb-1" style={labelStyle}>
          Email Address<Req />
        </label>
        <input
          type="email" id="email" name="email" value={formData.email}
          onChange={handleInputChange} required
          className={fieldClass} style={fieldStyle} placeholder="your.email@example.com"
        />
      </div>

      <div>
        <label htmlFor="organization" className="block mb-1" style={labelStyle}>
          Organization<Req />
        </label>
        <input
          type="text" id="organization" name="organization" value={formData.organization}
          onChange={handleInputChange} required
          className={fieldClass} style={fieldStyle} placeholder="Your organization name"
          readOnly={!loggedInUser?.isGuest && !!loggedInUser?.reg_organization}
        />
      </div>

      <div>
        <label htmlFor="message" className="block mb-1" style={labelStyle}>
          Message<Req />
        </label>
        <textarea
          id="message" name="message" value={formData.message}
          onChange={handleInputChange} required rows={6}
          className={`${fieldClass} resize-vertical`} style={fieldStyle}
          placeholder="Please describe your issue or question in detail…"
        />
      </div>

      <div className="pt-1 flex justify-center">
        <button
          type="submit" disabled={isSubmitting}
          className="font-opensans transition-all duration-200 hover:brightness-95"
          style={{
            backgroundColor: isSubmitting
              ? 'var(--color-btn-disabled-bg)'
              : 'var(--color-support-bar-calm)',
            color: '#FFFFFF',
            fontWeight: 400, // matches the assistance-panel buttons (normal weight)
            borderRadius: 8,
            padding: '13px 26px',
            border: 'none',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
          }}
        >
          {isSubmitting ? 'Sending…' : submitLabel}
        </button>
      </div>
    </form>
  );

  return (
    <div className="h-screen flex flex-row overflow-hidden">
      <Helmet>
        <title>Contact Support | CRG Houston</title>
        <meta
          name="description"
          content="Contact the Community Resources Guide Houston for support, questions, feedback, or to suggest updates to the directory."
        />
        <link rel="canonical" href="https://crghouston.org/support" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://crghouston.org/support" />
        <meta property="og:title" content="Contact Support | CRG Houston" />
        <meta
          property="og:description"
          content="Contact the Community Resources Guide Houston for support, questions, feedback, or to suggest updates to the directory."
        />
      </Helmet>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* NavBar1 - Header */}
        <nav
          className="bg-navbar1-bg flex items-center justify-between"
          style={{
            height: 'var(--height-navbar1)',
            paddingLeft: 'var(--padding-navbar1-left)',
            paddingRight: 'var(--padding-navbar1-right)',
          }}
        >
          <div className="flex items-center" style={{ gap: 'var(--gap-navbar1-logo-title)' }}>
            <img
              src="/images/CRG Logo 2025.webp"
              alt="CRG Logo"
              style={{ width: 'var(--size-navbar1-logo)', height: 'var(--size-navbar1-logo)' }}
              className="object-contain"
            />
            <h1
              className="text-navbar1-title font-comfortaa"
              style={{
                fontSize: 'var(--font-size-navbar1-title)',
                fontWeight: 'var(--font-weight-navbar1-title)',
                letterSpacing: 'var(--letter-spacing-navbar1-title)',
              }}
            >
              Community Resources Guide Houston
            </h1>
          </div>

          <span
            className="hidden lg:inline font-opensans"
            style={{
              color: 'var(--color-navbar1-title)',
              fontSize: 'var(--font-size-navbar1-btn)',
              fontWeight: 'var(--font-weight-navbar1-btn)',
              letterSpacing: 'var(--letter-spacing-navbar1-btn)',
            }}
          >
            Contact Support
          </span>
          <div className="lg:hidden">
            <MobileMenu onLogout={onLogout} />
          </div>
        </nav>

        {/* Main content - Contact card */}
        <main
          className="flex-1 overflow-y-auto flex items-start justify-center p-8"
          style={{ backgroundColor: 'var(--color-home-right-area-bg)' }}
        >
          <div className="w-full" style={{ maxWidth: 600 }}>
            <div
              style={{
                backgroundColor: 'var(--color-support-card-bg)',
                borderRadius: 12,
                boxShadow: '0 18px 48px rgba(0,0,0,0.16)',
                padding: '40px 40px 44px',
                fontFamily: 'var(--font-family-body)',
              }}
            >
              <h2
                className="text-center"
                style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-support-heading)', marginBottom: 22 }}
              >
                Contact Me
              </h2>

              {/* Success / error */}
              {submitStatus === 'success' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded"
                >
                  Your message has been sent successfully. I&rsquo;ll get back to you soon!
                </motion.div>
              )}
              {submitStatus === 'error' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded"
                >
                  There was an error sending your message. Please try again later.
                </motion.div>
              )}

              {/* Panel 1 — personal intro */}
              <div
                className="flex gap-4 mb-5"
                style={{
                  backgroundColor: 'var(--color-support-panel-blush)',
                  border: '1px solid var(--color-support-hairline)',
                  borderLeft: '5px solid var(--color-support-bar-brand)',
                  borderRadius: 10,
                  padding: '18px 20px',
                }}
              >
                <img
                  src="/images/CRG Logo 2025.webp"
                  alt="CRG Logo"
                  className="flex-shrink-0 object-contain"
                  style={{ width: 46, height: 46 }}
                />
                <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--color-support-body-blush)', margin: 0 }}>
                  <strong>Hi, I&rsquo;m Omar Peracha</strong> — I built this site, and I&rsquo;m the one who
                  reads every message you send here. There&rsquo;s no help desk and no ticket queue:
                  whatever you write comes straight to me. Tell me what&rsquo;s going on below and
                  I&rsquo;ll point you to the fastest way to reach me.
                </p>
              </div>

              {/* Panel 2 — subject router */}
              <div
                style={{
                  backgroundColor: 'var(--color-support-panel-blush)',
                  border: '1px solid var(--color-support-hairline)',
                  borderLeft: '5px solid var(--color-support-bar-brand)',
                  borderRadius: 10,
                  padding: '20px 22px',
                  marginBottom: 26,
                }}
              >
                <label htmlFor="subject" className="block mb-2" style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-support-ink)' }}>
                  What&rsquo;s this about?<Req />
                </label>
                <select
                  id="subject" value={subject}
                  onChange={(e) => { setSubject(e.target.value); setEmailExpanded(false); }}
                  required
                  className="w-full focus:outline-none focus:ring-2 focus:ring-[var(--color-support-accent-amber)]"
                  style={{ ...fieldStyle, width: '100%' }}
                >
                  {SUBJECT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} disabled={option.value === ''}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: 13.5, color: 'var(--color-support-muted)', marginTop: 8 }}>
                  Choose a reason and I&rsquo;ll show you the best way to reach me.
                </p>
              </div>

              {/* Result region — A: nothing; B: text lane; C: email lane */}
              {showResult && (
                <motion.div
                  key={isUrgent ? 'urgent' : 'normal'}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  {isUrgent ? (
                    <>
                      {/* ---- Text lane (primary) ---- */}
                      <RecoTag color="var(--color-support-bar-urgent)">Urgent · fastest way to reach me</RecoTag>
                      <div
                        style={{
                          backgroundColor: 'var(--color-support-panel-urgent)',
                          border: '1px solid var(--color-support-hairline)',
                          borderLeft: '5px solid var(--color-support-bar-urgent)',
                          borderRadius: 10,
                          padding: '22px 24px',
                        }}
                      >
                        <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-support-ink)', margin: '0 0 6px' }}>
                          Text Me
                        </h3>
                        <p style={{ fontSize: 14, color: 'var(--color-support-lead-urgent)', margin: '0 0 16px', lineHeight: 1.5 }}>
                          When something&rsquo;s broken I want to hear right away. Type your message,
                          scan the code, and it sends from your phone — no name or email needed.
                        </p>

                        {/* Browser: auto-captured and read-only so we always get an
                            accurate string. Can be removed ("in or out") but never
                            edited; re-adding restores the true captured value. */}
                        <div>
                          <div className="block mb-1" style={labelStyle}>
                            Browser
                          </div>
                          {includeBrowser ? (
                            <>
                              <div
                                style={{
                                  ...fieldStyle,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 8,
                                }}
                              >
                                <span>{smsBrowser}</span>
                                <button
                                  type="button"
                                  onClick={() => setIncludeBrowser(false)}
                                  aria-label="Remove browser information"
                                  className="hover:brightness-110"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--color-support-muted)',
                                    fontSize: 18,
                                    lineHeight: 1,
                                    padding: '0 2px',
                                    flexShrink: 0,
                                  }}
                                >
                                  &times;
                                </button>
                              </div>
                              <p style={{ fontSize: 12.5, color: 'var(--color-support-muted)', marginTop: 6 }}>
                                Your browser version is filled in automatically so I can help faster —
                                remove it if you prefer not to share it.
                              </p>
                            </>
                          ) : (
                            <p style={{ fontSize: 12.5, color: 'var(--color-support-muted)', marginTop: 6 }}>
                              Browser information removed.{' '}
                              <button
                                type="button"
                                onClick={() => { setSmsBrowser(getBrowserInfo()); setIncludeBrowser(true); }}
                                className="hover:brightness-110"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  color: 'var(--color-support-ink)',
                                  fontWeight: 600,
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                  fontSize: 12.5,
                                }}
                              >
                                Add it back
                              </button>
                            </p>
                          )}
                        </div>

                        {/* Message */}
                        <div style={{ marginTop: 16 }}>
                          <label htmlFor="sms-message" className="block mb-1" style={labelStyle}>
                            Message
                          </label>
                          <textarea
                            id="sms-message" value={smsMessage}
                            onChange={(e) => setSmsMessage(e.target.value)} rows={4}
                            maxLength={MESSAGE_MAX}
                            placeholder="What's not working"
                            className={`${fieldClass} resize-vertical placeholder:italic placeholder:text-gray-400`}
                            style={fieldStyle}
                          />
                          <div
                            className="text-right"
                            style={{
                              fontSize: 12.5,
                              marginTop: 4,
                              color: messageCharsRemaining <= 20 ? '#C0202A' : 'var(--color-support-muted)',
                            }}
                          >
                            {messageCharsRemaining} characters remaining
                          </div>
                        </div>

                        {/* Text trigger, centered. Desktop scans a QR to hop the
                            message to a separate phone; mobile taps straight into
                            the native messaging app. */}
                        <div className="flex flex-col items-center" style={{ marginTop: 18 }}>
                          {/* Desktop: QR code */}
                          <div className="hidden lg:flex flex-col items-center">
                            <div style={{ padding: 8, background: '#FFFFFF', border: '1px solid var(--color-support-hairline)', borderRadius: 6 }}>
                              <QRCodeSVG value={smsHref} size={140} level="M" />
                            </div>
                            <p style={{ fontSize: 12.5, color: 'var(--color-support-muted)', marginTop: 8 }}>
                              Scan to text
                            </p>
                          </div>

                          {/* Mobile: tap-to-text — opens the phone's messaging app
                              with the details filled in, and optimistically closes
                              out (same model as the desktop "I've sent my text"). */}
                          <a
                            href={smsHref}
                            onClick={handleTextSent}
                            className="lg:hidden font-opensans transition-all duration-200 hover:brightness-95 text-center"
                            style={{
                              backgroundColor: 'var(--color-support-bar-urgent)',
                              color: '#FFFFFF',
                              fontWeight: 400,
                              borderRadius: 8,
                              padding: '12px 26px',
                              textDecoration: 'none',
                            }}
                          >
                            Text Me
                          </a>
                          <p className="lg:hidden" style={{ fontSize: 12.5, color: 'var(--color-support-muted)', marginTop: 8, textAlign: 'center' }}>
                            Opens your messaging app with the details filled in.
                          </p>

                          {/* Desktop closure button (mobile closes via the tap above) */}
                          <button
                            type="button"
                            onClick={handleTextSent}
                            className="hidden lg:block font-opensans transition-all duration-200 hover:brightness-95"
                            style={{
                              marginTop: 12,
                              backgroundColor: 'var(--color-support-bar-urgent)',
                              color: '#FFFFFF',
                              fontWeight: 400, // matches the assistance-panel buttons (normal weight)
                              borderRadius: 8,
                              padding: '10px 22px',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            I&rsquo;ve sent my text
                          </button>
                        </div>
                      </div>

                      {/* ---- "Prefer email?" expander ---- */}
                      <div style={{ borderTop: '1px solid var(--color-support-hairline)', marginTop: 18 }}>
                        <button
                          type="button"
                          onClick={() => setEmailExpanded((v) => !v)}
                          className="font-opensans w-full flex items-center justify-between hover:brightness-95 transition-all"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '14px 2px' }}
                        >
                          <span>
                            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-support-ink)' }}>Prefer email?</span>
                            <span style={{ fontSize: 13.5, color: 'var(--color-support-muted)', marginLeft: 8 }}>Write a full message instead.</span>
                          </span>
                          <motion.span animate={{ rotate: emailExpanded ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ color: 'var(--color-support-muted)' }}>
                            ▾
                          </motion.span>
                        </button>
                        {emailExpanded && (
                          <div
                            style={{
                              backgroundColor: 'var(--color-support-panel-calm)',
                              border: '1px solid var(--color-support-hairline)',
                              borderLeft: '5px solid var(--color-support-bar-calm)',
                              borderRadius: 10,
                              padding: '20px 22px',
                              marginTop: 4,
                            }}
                          >
                            {renderEmailForm('Send Email instead')}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* ---- Email lane only ---- */}
                      <RecoTag color="var(--color-support-bar-calm)">Best way to reach me</RecoTag>
                      <div
                        style={{
                          backgroundColor: 'var(--color-support-panel-calm)',
                          border: '1px solid var(--color-support-hairline)',
                          borderLeft: '5px solid var(--color-support-bar-calm)',
                          borderRadius: 10,
                          padding: '20px 22px',
                        }}
                      >
                        {renderEmailForm('Send Email')}
                      </div>
                    </>
                  )}

                  <div className="mt-4 text-center" style={{ fontSize: 13, color: 'var(--color-support-muted)' }}>
                    <span style={{ color: '#C0202A' }}>*</span> Required fields
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <Footer />
      </div>

      {/* Vertical nav bar — desktop only; mobile uses the hamburger in NavBar1 */}
      <div className="hidden lg:block">
        <VerticalNavBar />
      </div>
    </div>
  );
};

export default SupportPage;
