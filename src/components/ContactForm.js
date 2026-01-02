// src/components/ContactForm.js
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

const ContactForm = ({ loggedInUser = null, onSubmitSuccess = null }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organization: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success', 'error', or null

  const subjectOptions = [
    { value: "", label: "Select a subject..." },
    { value: "Bug Report", label: "Bug Report" },
    { value: "Feature Request", label: "Feature Request" },
    { value: "Login/Access Issues", label: "Login/Access Issues" },
    { value: "PDF/Email Issues", label: "PDF/Email Issues" },
    { value: "Data Questions", label: "Data Questions" },
    { value: "General Support", label: "General Support" },
  ];

  // Auto-fill organization if user is logged in
  useEffect(() => {
    if (loggedInUser?.registered_organization) {
      setFormData((prev) => ({
        ...prev,
        organization: loggedInUser.registered_organization,
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

    if (!formData.name.trim()) errors.push("Name is required");
    if (!formData.email.trim()) errors.push("Email is required");
    if (!formData.organization.trim()) errors.push("Organization is required");
    if (!formData.subject) errors.push("Subject is required");
    if (!formData.message.trim()) errors.push("Message is required");

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      errors.push("Please enter a valid email address");
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = validateForm();
    if (errors.length > 0) {
      alert("Please fix the following errors:\n" + errors.join("\n"));
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      // Route to Wrangler dev server on localhost:8788 during dev, otherwise use relative path
      const functionUrl =
        window.location.hostname === "localhost"
          ? "http://localhost:8788/sendSupportEmail"
          : "/sendSupportEmail";

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setSubmitStatus("success");
        // Reset form
        setFormData({
          name: "",
          email: "",
          organization: loggedInUser?.registered_organization || "",
          subject: "",
          message: "",
        });

        // Call success callback if provided
        if (onSubmitSuccess) {
          onSubmitSuccess();
        }
      } else {
        setSubmitStatus("error");
        console.error("Support email failed:", result.message);
      }
    } catch (error) {
      setSubmitStatus("error");
      console.error("Error sending support email:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-[#4A4E69] mb-6">
        Contact Support
      </h2>

      {submitStatus === "success" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded"
        >
          Your support request has been sent successfully. We'll get back to you
          soon!
        </motion.div>
      )}

      {submitStatus === "error" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded"
        >
          There was an error sending your support request. Please try again
          later.
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name Field */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-1"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4A4E69] focus:border-transparent"
            placeholder="Your full name"
          />
        </div>

        {/* Email Field */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4A4E69] focus:border-transparent"
            placeholder="your.email@example.com"
          />
        </div>

        {/* Organization Field */}
        <div>
          <label
            htmlFor="organization"
            className="block text-sm font-medium text-gray-700 mb-1"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4A4E69] focus:border-transparent"
            placeholder="Your organization name"
            readOnly={!!loggedInUser?.registered_organization}
          />
        </div>

        {/* Subject Field */}
        <div>
          <label
            htmlFor="subject"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Subject <span className="text-red-500">*</span>
          </label>
          <select
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4A4E69] focus:border-transparent"
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
            className="block text-sm font-medium text-gray-700 mb-1"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4A4E69] focus:border-transparent resize-vertical"
            placeholder="Please describe your issue or question in detail..."
          />
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 px-4 rounded-md text-white font-medium ${
              isSubmitting
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#4A4E69] hover:bg-[#5d6285] focus:outline-none focus:ring-2 focus:ring-[#4A4E69] focus:ring-offset-2"
            } transition duration-200`}
          >
            {isSubmitting ? "Sending..." : "Send Support Request"}
          </button>
        </div>
      </form>

      <div className="mt-4 text-sm text-gray-500 text-center">
        <span className="text-red-500">*</span> Required fields
      </div>
    </div>
  );
};

export default ContactForm;
