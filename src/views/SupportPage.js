// src/views/SupportPage.js
import React from "react";
import PageLayout from "../layout/PageLayout";
import ContactForm from "../components/ContactForm";

const SupportPage = ({ loggedInUser }) => {
  const handleSubmitSuccess = () => {
    // Optional: Any additional actions after successful form submission
    console.log('Support request submitted successfully');
  };

  return (
    <PageLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-[#4A4E69]">Support</h1>
        </div>
        
        <div className="mb-6">
          <p className="text-lg text-gray-700 text-center">
            Need help with the Community Resources Guide? We're here to assist you with any questions or issues.
          </p>
        </div>
        
        <ContactForm 
          loggedInUser={loggedInUser}
          onSubmitSuccess={handleSubmitSuccess}
        />
      </div>
    </PageLayout>
  );
};

export default SupportPage;