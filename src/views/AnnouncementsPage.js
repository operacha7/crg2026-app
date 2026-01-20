// src/views/AnnouncementsPage.js
// 2026 Redesign - Announcements page with memo display and navigation

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AnnouncementService from '../services/AnnouncementService';
import VerticalNavBar from '../layout/VerticalNavBar';
import Footer from '../layout/Footer';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';

// Inline memo display component (same as popup but without close button)
const MemoDisplay = ({ announcement }) => {
  // Format the date to display like "January 8, 2026"
  const formatDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const toText = AnnouncementService.getAudienceDisplayText(announcement);

  return (
    <div
      className="relative flex flex-col"
      style={{
        backgroundColor: 'var(--color-memo-bg)',
        maxWidth: 'var(--width-memo-max)',
        width: '100%',
        maxHeight: 'calc(80vh - 60px)', // Constrain height to viewport
        boxShadow: '10px 10px 30px var(--color-memo-shadow)',
        fontFamily: 'var(--font-family-body)',
      }}
    >
      {/* Fixed header section (doesn't scroll) */}
      <div
        style={{
          padding: 'var(--padding-memo)',
          paddingBottom: '0',
          flexShrink: 0,
        }}
      >
        {/* CRG Logo - top right */}
        <img
          src="/images/CRG Logo 2025.webp"
          alt="CRG Logo"
          style={{
            position: 'absolute',
            top: 'var(--top-memo-logo)',
            right: 'var(--padding-memo)',
            width: 'var(--size-memo-logo)',
            height: 'var(--size-memo-logo)',
          }}
        />

        {/* "memo" title - large, blue */}
        <h1
          style={{
            fontSize: 'var(--font-size-memo-title)',
            fontWeight: 'var(--font-weight-memo-title)',
            color: 'var(--color-memo-title)',
            letterSpacing: '0.15em',
            marginBottom: '40px',
            lineHeight: 1,
          }}
        >
          memo
        </h1>

        {/* Memo fields: Date, To, Subject */}
        <div
          style={{
            fontSize: 'var(--font-size-memo-label)',
            color: 'var(--color-memo-text)',
            marginBottom: '30px',
            lineHeight: 1.4,
          }}
        >
          <div className="flex mb-1">
            <span style={{ fontWeight: 'var(--font-weight-memo-label)', width: '80px' }}>
              Date:
            </span>
            <span style={{ fontWeight: 'var(--font-weight-memo-body)' }}>
              {formatDate(announcement.start_date)}
            </span>
          </div>
          <div className="flex mb-1">
            <span style={{ fontWeight: 'var(--font-weight-memo-label)', width: '80px' }}>
              To:
            </span>
            <span style={{ fontWeight: 'var(--font-weight-memo-body)' }}>
              {toText}
            </span>
          </div>
          <div className="flex">
            <span style={{ fontWeight: 'var(--font-weight-memo-label)', width: '80px' }}>
              Subject:
            </span>
            <span style={{ fontWeight: 'var(--font-weight-memo-body)' }}>
              {announcement.title}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable body section */}
      <div
        className="memo-body overflow-y-auto"
        style={{
          fontSize: 'var(--font-size-memo-body)',
          fontWeight: 'var(--font-weight-memo-body)',
          color: 'var(--color-memo-text)',
          lineHeight: 1.4,
          padding: '0 var(--padding-memo) var(--padding-memo) var(--padding-memo)',
          minHeight: '100px',
        }}
        dangerouslySetInnerHTML={{ __html: announcement.message_html }}
      />
    </div>
  );
};

// Navigation card component
const NavCard = ({ announcement, position, totalCount, onClick, direction }) => {
  // Format date as "Month Day, Year"
  const formatDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const isLeft = direction === 'left';

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-4 rounded-lg transition-all duration-200 hover:bg-black/10"
      style={{
        backgroundColor: 'transparent',
        color: '#000000',
        maxWidth: '280px',
        textAlign: isLeft ? 'right' : 'left',
        flexDirection: isLeft ? 'row' : 'row-reverse',
      }}
    >
      {/* Chevron */}
      <div className="flex-shrink-0">
        {isLeft ? (
          <ChevronLeftIcon size={24} color="#000000" />
        ) : (
          <ChevronRightIcon size={24} color="#000000" />
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col" style={{ textAlign: isLeft ? 'right' : 'left' }}>
        <div className="font-medium leading-tight mb-2" style={{ color: 'var(--color-text-primary)', fontSize: '16px' }}>
          {announcement.title}
        </div>
        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {formatDate(announcement.start_date)}
        </div>
        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {position}/{totalCount}
        </div>
      </div>
    </button>
  );
};

// Searchable hover dropdown for announcements
function AnnouncementDropdown({ announcements, currentIndex, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [hoveredOption, setHoveredOption] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  // Format date for display
  const formatDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  // Filter announcements based on search
  const filteredAnnouncements = announcements.filter((a) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const dateStr = formatDate(a.start_date);
    return (
      a.title.toLowerCase().includes(query) ||
      dateStr.toLowerCase().includes(query)
    );
  });

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsLocked(false);
        setSearchQuery('');
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    if (!isLocked) {
      setIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isLocked) {
      closeTimeoutRef.current = setTimeout(() => {
        setIsOpen(false);
        setSearchQuery('');
      }, 150);
    }
  };

  const handleClick = () => {
    setIsLocked(!isLocked);
    setIsOpen(true);
  };

  const handleSelect = (index) => {
    onSelect(index);
    setIsOpen(false);
    setIsLocked(false);
    setSearchQuery('');
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger button */}
      <button
        onClick={handleClick}
        className="font-opensans transition-all duration-200 text-left bg-transparent text-navbar2-btn-inactive-text hover:bg-white/10"
        style={{
          height: 'var(--height-navbar2-btn)',
          paddingLeft: 'var(--padding-navbar2-btn-x)',
          paddingRight: 'var(--padding-navbar2-btn-x)',
          borderRadius: 'var(--radius-navbar2-btn)',
          fontSize: '18px',
          fontWeight: 'var(--font-weight-navbar2-btn)',
          letterSpacing: 'var(--letter-spacing-navbar2-btn)',
          whiteSpace: 'nowrap',
        }}
      >
        Select Announcement
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className="absolute left-0 mt-2 rounded shadow-lg z-50"
          style={{
            backgroundColor: 'var(--color-dropdown-bg)',
            width: '400px',
          }}
        >
          {/* Search input */}
          <div className="p-3 border-b border-gray-300">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or date..."
              className="w-full px-3 py-2 rounded font-opensans"
              style={{
                backgroundColor: 'var(--color-dropdown-hover-bg)',
                color: 'var(--color-dropdown-text)',
                border: '1px solid #ccc',
                fontSize: '14px',
              }}
            />
          </div>

          {/* Announcement list */}
          <div className="max-h-[350px] overflow-y-auto">
            {filteredAnnouncements.length === 0 ? (
              <div className="text-center py-4 text-gray-500 font-opensans">
                No announcements found
              </div>
            ) : (
              filteredAnnouncements.map((announcement) => {
                const actualIndex = announcements.findIndex(a => a.id_no === announcement.id_no);
                return (
                  <button
                    key={announcement.id_no}
                    onClick={() => handleSelect(actualIndex)}
                    onMouseEnter={() => setHoveredOption(announcement.id_no)}
                    onMouseLeave={() => setHoveredOption(null)}
                    className="w-full text-left px-4 py-3 font-opensans"
                    style={{
                      fontSize: '14px',
                      color: 'var(--color-dropdown-text)',
                      backgroundColor:
                        hoveredOption === announcement.id_no
                          ? 'var(--color-dropdown-hover-bg)'
                          : actualIndex === currentIndex
                          ? 'var(--color-dropdown-active-bg)'
                          : 'transparent',
                    }}
                  >
                    <div className="font-medium">{formatDate(announcement.start_date)}</div>
                    <div className="text-sm opacity-70">{announcement.title}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const AnnouncementsPage = ({ loggedInUser }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [slideDirection, setSlideDirection] = useState(0);

  // Fetch all announcements on mount
  useEffect(() => {
    const fetchAnnouncements = async () => {
      if (!loggedInUser) return;

      try {
        const allAnnouncements = await AnnouncementService.getAllAnnouncements(loggedInUser);
        setAnnouncements(allAnnouncements);
      } catch (error) {
        console.error('Error fetching announcements:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
  }, [loggedInUser]);

  // Navigate to previous announcement (go back / left)
  const goToPrevious = () => {
    if (currentIndex > 0) {
      setSlideDirection(-1);
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Navigate to next announcement (go forward / right)
  const goToNext = () => {
    if (currentIndex < announcements.length - 1) {
      setSlideDirection(1);
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Jump to specific announcement from dropdown
  const jumpToAnnouncement = (index) => {
    setSlideDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  };

  const currentAnnouncement = announcements[currentIndex];
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < announcements.length - 1;

  // Slide animation variants
  const slideVariants = {
    enter: (direction) => ({
      x: direction > 0 ? -300 : 300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
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

          {/* Right side - Announcements label */}
          <span
            className="font-opensans"
            style={{
              color: 'var(--color-navbar1-title)',
              fontSize: 'var(--font-size-navbar1-btn)',
              fontWeight: 'var(--font-weight-navbar1-btn)',
              letterSpacing: 'var(--letter-spacing-navbar1-btn)',
            }}
          >
            Announcements
          </span>
        </nav>

        {/* NavBar2 - Select Announcement dropdown */}
        <nav
          className="bg-navbar2-bg flex items-center"
          style={{
            height: 'var(--height-navbar2)',
            paddingLeft: 'var(--padding-navbar2-left)',
            paddingRight: 'var(--padding-navbar2-right)',
          }}
        >
          <AnnouncementDropdown
            announcements={announcements}
            currentIndex={currentIndex}
            onSelect={jumpToAnnouncement}
          />
        </nav>

        {/* Main content - Memo with navigation */}
        <main className="flex-1 flex items-center justify-center gap-8 p-8 overflow-hidden" style={{ backgroundColor: 'var(--color-page-background)' }}>
          {loading ? (
            <div className="text-gray-600 text-xl">Loading announcements...</div>
          ) : announcements.length === 0 ? (
            <div className="text-gray-600 text-xl">No announcements available</div>
          ) : (
            <>
              {/* Left navigation card (go back / previous) */}
              <div style={{ width: '280px', visibility: hasPrevious ? 'visible' : 'hidden' }}>
                {hasPrevious && (
                  <NavCard
                    announcement={announcements[currentIndex - 1]}
                    position={currentIndex}
                    totalCount={announcements.length}
                    onClick={goToPrevious}
                    direction="left"
                  />
                )}
              </div>

              {/* Center - Memo display with animation */}
              <div
                className="relative overflow-hidden"
                style={{ maxWidth: 'var(--width-memo-max)', width: '100%' }}
              >
                <AnimatePresence initial={false} custom={slideDirection} mode="wait">
                  <motion.div
                    key={currentIndex}
                    custom={slideDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  >
                    <MemoDisplay announcement={currentAnnouncement} />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Right navigation card (go forward / next) */}
              <div style={{ width: '280px', visibility: hasNext ? 'visible' : 'hidden' }}>
                {hasNext && (
                  <NavCard
                    announcement={announcements[currentIndex + 1]}
                    position={currentIndex + 2}
                    totalCount={announcements.length}
                    onClick={goToNext}
                    direction="right"
                  />
                )}
              </div>
            </>
          )}
        </main>

        {/* Footer */}
        <Footer />
      </div>

      {/* Vertical nav bar */}
      <VerticalNavBar />
    </div>
  );
};

export default AnnouncementsPage;
