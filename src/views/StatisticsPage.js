// src/views/StatisticsPage.js
import React, { useState } from 'react';
import { motion } from "framer-motion";
import PageLayout from "../layout/PageLayout";
import { StatisticsProvider, useStatistics } from "../Contexts/StatisticsContext";
import ZipCodeChartsContainer from '../components/charts/containers/ZipCodeChartsContainer';
import EmailChartsContainer from '../components/charts/containers/EmailChartsContainer';
import PdfChartsContainer from '../components/charts/containers/PdfChartsContainer';
import TopZipCodes from '../components/charts/TopZipCodes';
import TopReferrals from '../components/charts/TopReferrals';
import UserActionsContainer from '../components/charts/containers/UserActionsContainer';
import SearchActivityContainer from '../components/charts/containers/SearchActivityContainer';
import AssistanceUsageContainer from '../components/charts/containers/AssistanceUsageContainer';

const StatisticsPageContent = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChart, setActiveChart] = useState("zip");
  const { selectedDate, setSelectedDate, getCentralTimeDate } = useStatistics();

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const renderChart = () => {
    switch (activeChart) {
      case "zip":
        return <ZipCodeChartsContainer />;
      case "email":
        return <EmailChartsContainer />;
      case "pdf":
        return <PdfChartsContainer />;
      case "topZips":
        return <TopZipCodes />;
      case "topReferrals":
        return <TopReferrals />;
      case "userActions":
        return <UserActionsContainer />;
      case "searchActivity":
        return <SearchActivityContainer />;
      case "assistanceUsage":
        return <AssistanceUsageContainer />;
      default:
        return <div>Select a chart type</div>;
    }
  };

  // Show date picker for charts that need it
  const showDatePicker = ["zip", "email", "pdf", "userActions", "searchActivity", "assistanceUsage"].includes(activeChart);

  return (
    <PageLayout>
      <div className="flex min-h-[calc(100vh-120px)]">
        {/* Main content area */}
        <div className="flex-1 p-6" style={{ 
          paddingRight: isOpen ? '300px' : '80px'
        }}>
          {renderChart()}
        </div>

        {/* Sidebar toggle button */}
        <button
          onClick={toggleSidebar}
          className="fixed right-0 top-40 z-20 p-0 rounded-r-none rounded-l-md bg-[#4A4E69] text-white"
        >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-10 w-10"
          fill="none"
          viewBox="0 0 30 34"
          stroke="currentColor"
         >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 0v34" // full height line
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={isOpen ? "M21 12l4 5-5 5" : "M21 12l-5 5 5 5"} // more space
          />
        </svg>
        </button>

        {/* Sidebar */}
        <motion.div
          className="fixed right-0 top-30 h-full bg-white shadow-lg z-10"
          initial={{ width: "60px" }}
          animate={{ width: isOpen ? "280px" : "60px" }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex flex-col h-full pt-72 bg-gray-50">
            
            {/* Date Picker - show for charts that need it */}
            {isOpen && showDatePicker && (
              <div className="px-4 pb-4 border-b border-gray-300">
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Select Date:
                </label>
                <input
                  type="date"
                  value={selectedDate || ''}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {selectedDate === getCentralTimeDate() ? 'Today' : 'Historical data'}
                </p>
              </div>
            )}

            {/* Chart Navigation Icons */}
            
            {/* 1. ZIP CODE SEARCHES */}
            <div
              className={`p-3 cursor-pointer flex justify-start pl-4 ${activeChart === "zip" ? "bg-gray-200" : ""}`}
              onClick={() => setActiveChart("zip")}
            >
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-[#4A4E69] flex items-center justify-center text-white text-xs font-bold">
                  ZIP
                </div>
                {isOpen && (
                  <span className="ml-3 whitespace-nowrap">
                    Zip Code Searches
                  </span>
                )}
              </div>
            </div>

            {/* 2. EMAILS SENT */}
            <div
              className={`p-3 cursor-pointer flex justify-start pl-4 ${activeChart === "email" ? "bg-gray-200" : ""}`}
              onClick={() => setActiveChart("email")}
            >
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-[#4A4E69] flex items-center justify-center text-white">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                {isOpen && (
                  <span className="ml-3 whitespace-nowrap">
                    Emails Sent
                  </span>
                )}
              </div>
            </div>

            {/* 3. PDFS CREATED */}
            <div
              className={`p-3 cursor-pointer flex justify-start pl-4 ${activeChart === "pdf" ? "bg-gray-200" : ""}`}
              onClick={() => setActiveChart("pdf")}
            >
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-[#4A4E69] flex items-center justify-center text-white">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                {isOpen && (
                  <span className="ml-3 whitespace-nowrap">
                    PDFs Created
                  </span>
                )}
              </div>
            </div>

            {/* 4. TOP ZIP CODES */}
            <div
              className={`p-3 cursor-pointer flex justify-start pl-4 ${activeChart === "topZips" ? "bg-gray-200" : ""}`}
              onClick={() => setActiveChart("topZips")}
            >
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-[#4A4E69] flex items-center justify-center text-white text-xs">
                  77027
                </div>
                {isOpen && (
                  <span className="ml-3 whitespace-nowrap">
                    Top Zip Codes
                  </span>
                )}
              </div>
            </div>

            {/* 5. TOP REFERRALS */}
            <div
              className={`p-3 cursor-pointer flex justify-start pl-4 ${activeChart === "topReferrals" ? "bg-gray-200" : ""}`}
              onClick={() => setActiveChart("topReferrals")}
            >
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-[#4A4E69] flex items-center justify-center text-white text-xs">
                  ORG
                </div>
                {isOpen && (
                  <span className="ml-3 whitespace-nowrap">
                    Top Referrals
                  </span>
                )}
              </div>
            </div>

            {/* 6. USER ACTIONS (EMAIL/PDF) */}
            <div
              className={`p-3 cursor-pointer flex justify-start pl-4 ${activeChart === "userActions" ? "bg-gray-200" : ""}`}
              onClick={() => setActiveChart("userActions")}
            >
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-[#4A4E69] flex items-center justify-center text-white">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2 3h20v18H2z M2 12h6l2 3h4l2-3h6"
                    />
                  </svg>
                </div>
                {isOpen && (
                  <span className="ml-3 whitespace-nowrap">
                    User Actions
                  </span>
                )}
              </div>
            </div>

            {/* 7. SEARCH ACTIVITY */}
            <div
              className={`p-3 cursor-pointer flex justify-start pl-4 ${activeChart === "searchActivity" ? "bg-gray-200" : ""}`}
              onClick={() => setActiveChart("searchActivity")}
            >
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-[#4A4E69] flex items-center justify-center text-white">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                {isOpen && (
                  <span className="ml-3 whitespace-nowrap">
                    Search Activity
                  </span>
                )}
              </div>
            </div>

            {/* 8. ASSISTANCE USAGE */}
            <div
              className={`p-3 cursor-pointer flex justify-start pl-4 ${activeChart === "assistanceUsage" ? "bg-gray-200" : ""}`}
              onClick={() => setActiveChart("assistanceUsage")}
            >
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-[#4A4E69] flex items-center justify-center text-white">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                    />
                  </svg>
                </div>
                {isOpen && (
                  <span className="ml-3 whitespace-nowrap">
                    Assistance Usage
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </PageLayout>
  );
};

const StatisticsPage = () => {
  return (
    <StatisticsProvider>
      <StatisticsPageContent />
    </StatisticsProvider>
  );
};

export default StatisticsPage;