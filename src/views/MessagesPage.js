// src/views/MessagesPage.js
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslate } from '../Utility/Translate';
import AnnouncementService from '../services/AnnouncementService';
import PageLayout from '../layout/PageLayout';

const MessagesPage = ({ loggedInUser }) => {
  const { translate } = useTranslate();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  
  // Force component to re-render periodically
  const [, forceUpdate] = useState({});
  
  useEffect(() => {
    // Set up a timer to force re-render every second
    // This ensures we always display in the current language
    const timer = setInterval(() => {
      forceUpdate({});
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      if (!loggedInUser?.registered_organization) return;

      try {
        const allAnnouncements = await AnnouncementService.getAllAnnouncements(
          loggedInUser.registered_organization
        );
        setAnnouncements(allAnnouncements);
      } catch (error) {
        console.error('Error fetching announcements:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
  }, [loggedInUser]);

  // Toggle message expansion
  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Format date
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Get announcement status
  const getAnnouncementStatus = (announcement) => {
    const now = new Date();
    const startDate = new Date(announcement.start_date);
    const expDate = new Date(announcement.expiration_date);

    if (!announcement.is_active) {
      return { status: translate('tInactive'), className: 'text-gray-500' };
    } else if (now < startDate) {
      return { status: translate('tScheduled'), className: 'text-blue-500' };
    } else if (now > expDate) {
      return { status: translate('tExpired'), className: 'text-gray-500' };
    } else {
      return { status: translate('tActive'), className: 'text-green-500' };
    }
  };

  // Get a preview of the message (first 100 characters)
  const getMessagePreview = (message) => {
    if (!message) return '';
    return message.length > 100 ? `${message.substring(0, 100)}...` : message;
  };

  // Get the current language on each render
  const currentLanguage = sessionStorage.getItem('sessionLanguage') || 'English';

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-[#2B5D7D]">{translate('tMessages')}</h1>

        {loading ? (
          <div className="flex justify-center my-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#2B5D7D]"></div>
          </div>
        ) : announcements.length === 0 ? (
          <div className="bg-gray-100 rounded-lg p-6 text-center">
            <p className="text-gray-600">{translate('tNoMessages')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => {
              const status = getAnnouncementStatus(announcement);
              const isExpanded = expandedId === announcement.id;
              
              // Get title and message based on current language
              const title = currentLanguage === 'Español' ? 
                (announcement.title_es || announcement.title_en) : 
                announcement.title_en;
                
              const message = currentLanguage === 'Español' ? 
                (announcement.message_es || announcement.message_en) : 
                announcement.message_en;

              return (
                <motion.div
                  key={announcement.id}
                  className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer"
                  onClick={() => toggleExpand(announcement.id)}
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start">
                      <h2 className="text-xl font-semibold mb-2 text-[#2B5D7D]">
                        {title}
                      </h2>
                      <span className={`px-3 py-1 rounded-full text-sm ${status.className}`}>
                        {status.status}
                      </span>
                    </div>

                    <p className="text-sm text-gray-500 mb-4">
                      {formatDate(announcement.created_at)}
                    </p>

                    <div className="prose prose-sm max-w-none">
                      {isExpanded ? (
                        <div style={{ whiteSpace: 'pre-line' }}>{message}</div>
                      ) : (
                        <div>{getMessagePreview(message)}</div>
                      )}
                    </div>

                    <div className="mt-4 text-[#33839e] text-sm flex items-center">
                      {isExpanded ? (
                        <>
                          <span>{translate('tShowLess')}</span>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 ml-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 15l7-7 7 7"
                            />
                          </svg>
                        </>
                      ) : (
                        <>
                          <span>{translate('tReadMore')}</span>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 ml-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default MessagesPage;