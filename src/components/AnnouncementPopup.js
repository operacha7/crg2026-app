// src/components/AnnouncementPopup.js
import React from 'react';
import { motion } from 'framer-motion';

const AnnouncementPopup = ({ announcement, onClose, onNext }) => {
  // Use English content
  const title = announcement.title_en;
  const message = announcement.message_en;

  // Check if this is a high priority announcement
  const isHighPriority = announcement.priority === 1;

  // Format the date to display in a user-friendly way
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white rounded-lg shadow-xl p-4 md:p-8 max-w-3xl w-full"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col">
          <h2
            className="text-xl md:text-3xl font-bold mb-2"
            style={{
              color: isHighPriority ? '#000000' : '#4A4E69'
            }}
          >
            {title}
          </h2>

          <div className="flex justify-between text-xs md:text-sm text-gray-500 mt-2 md:mt-4 mb-2 md:mb-4">
            <span>{formatDate(announcement.created_at)}</span>
            <span className="text-green-500">{formatDate(announcement.expiration_date)}</span>
          </div>

          <div
            className="mb-4 md:mb-6 text-base md:text-xl prose max-w-none"
            style={{
              whiteSpace: 'pre-line',
              color: isHighPriority ? '#FF0000' : 'inherit'
            }}
          >
            {message}
          </div>

          <div className="flex justify-end">
            <button
              className="bg-[#4A4E69] text-white text-base md:text-xl px-4 md:px-6 py-2 rounded hover:bg-[#117299f2] transition"
              onClick={onClose}
            >
              OK
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AnnouncementPopup;
