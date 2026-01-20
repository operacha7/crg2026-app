// src/views/SupportPage.js
// 2026 Redesign - Contact Support page

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import VerticalNavBar from '../layout/VerticalNavBar';
import Footer from '../layout/Footer';

const SupportPage = ({ loggedInUser }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success', 'error', or null

  const subjectOptions = [
    { value: '', label: 'Select a subject...' },
    { value: "I'd like an account", label: "I'd like an account" },
    { value: 'I have updated info on resources', label: 'I have updated info on resources' },
    { value: 'Can you add an organization', label: 'Can you add an organization' },
    { value: 'Something is not working', label: 'Something is not working' },
    { value: 'Other', label: 'Other' },
  ];

  // Auto-fill organization if user is logged in (not Guest)
  useEffect(() => {
    if (loggedInUser?.reg_organization && !loggedInUser?.isGuest) {
      setFormData((prev) => ({
        ...prev,
        organization: loggedInUser.reg_organization,
      }));
    }
  }, [loggedInUser]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    const errors = [];

    if (!formData.name.trim()) errors.push('Name is required');
    if (!formData.email.trim()) errors.push('Email is required');
    if (!formData.organization.trim()) errors.push('Organization is required');
    if (!formData.subject) errors.push('Subject is required');
    if (!formData.message.trim()) errors.push('Message is required');

    // Basic email validation
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
      // Route to Wrangler dev server on localhost:8788 during dev, otherwise use relative path
      const functionUrl =
        window.location.hostname === 'localhost'
          ? 'http://localhost:8788/sendSupportEmail'
          : '/sendSupportEmail';

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setSubmitStatus('success');
        // Reset form
        setFormData({
          name: '',
          email: '',
          organization: (!loggedInUser?.isGuest && loggedInUser?.reg_organization) || '',
          subject: '',
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

  return (
    <div className="h-screen flex flex-row overflow-hidden">
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
          {/* Left side - Logo and Title */}
          <div
            className="flex items-center"
            style={{ gap: 'var(--gap-navbar1-logo-title)' }}
          >
            <img
              src="/images/CRG Logo 2025.webp"
              alt="CRG Logo"
              style={{
                width: 'var(--size-navbar1-logo)',
                height: 'var(--size-navbar1-logo)',
              }}
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

          {/* Right side - Page label */}
          <span
            className="font-opensans"
            style={{
              color: 'var(--color-navbar1-title)',
              fontSize: 'var(--font-size-navbar1-btn)',
              fontWeight: 'var(--font-weight-navbar1-btn)',
              letterSpacing: 'var(--letter-spacing-navbar1-btn)',
            }}
          >
            Contact Support
          </span>
        </nav>

        {/* NavBar2 - Empty but maintains visual consistency */}
        <nav
          className="bg-navbar2-bg"
          style={{
            height: 'var(--height-navbar2)',
          }}
        />

        {/* Main content - Contact form */}
        <main
          className="flex-1 overflow-y-auto flex items-center justify-center p-8"
          style={{ backgroundColor: 'var(--color-page-background)' }}
        >
          <div
            className="w-full max-w-xl bg-white rounded-lg p-8"
            style={{
              boxShadow: '10px 10px 30px rgba(0, 0, 0, 0.3)',
              fontFamily: 'var(--font-family-body)',
            }}
          >
            {/* Success message */}
            {submitStatus === 'success' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded"
              >
                Your support request has been sent successfully. We'll get back to you soon!
              </motion.div>
            )}

            {/* Error message */}
            {submitStatus === 'error' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded"
              >
                There was an error sending your support request. Please try again later.
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name Field */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--color-form-label)' }}
                >
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2d6552] focus:border-transparent"
                  placeholder="Your full name"
                />
              </div>

              {/* Email Field */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--color-form-label)' }}
                >
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2d6552] focus:border-transparent"
                  placeholder="your.email@example.com"
                />
              </div>

              {/* Organization Field */}
              <div>
                <label
                  htmlFor="organization"
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--color-form-label)' }}
                >
                  Organization <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="organization"
                  name="organization"
                  value={formData.organization}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2d6552] focus:border-transparent"
                  placeholder="Your organization name"
                  readOnly={!loggedInUser?.isGuest && !!loggedInUser?.reg_organization}
                />
              </div>

              {/* Subject Field */}
              <div>
                <label
                  htmlFor="subject"
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--color-form-label)' }}
                >
                  Subject <span className="text-red-500">*</span>
                </label>
                <select
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2d6552] focus:border-transparent"
                >
                  {subjectOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Message Field */}
              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--color-form-label)' }}
                >
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  required
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2d6552] focus:border-transparent resize-vertical"
                  placeholder="Please describe your issue or question in detail..."
                />
              </div>

              {/* Submit Button - using standard panel button tokens */}
              <div className="pt-4 flex justify-center">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="font-opensans transition-all duration-200 hover:brightness-110"
                  style={{
                    backgroundColor: isSubmitting ? 'var(--color-btn-disabled-bg)' : 'var(--color-panel-btn-ok-bg)',
                    color: 'var(--color-panel-btn-text)',
                    width: 'var(--width-panel-btn)',
                    height: 'var(--height-panel-btn)',
                    borderRadius: 'var(--radius-panel-btn)',
                    fontSize: 'var(--font-size-panel-btn)',
                    letterSpacing: 'var(--letter-spacing-panel-btn)',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    border: 'none',
                  }}
                >
                  {isSubmitting ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>

            <div className="mt-4 text-sm text-gray-500 text-center">
              <span className="text-red-500">*</span> Required fields
            </div>
          </div>
        </main>

        {/* Footer */}
        <Footer />
      </div>

      {/* Vertical nav bar */}
      <VerticalNavBar />
    </div>
  );
};

export default SupportPage;
