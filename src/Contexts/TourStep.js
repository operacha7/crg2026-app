// TourStep.js - Simplified to pass keys directly with tour name support
import { useEffect } from 'react';
import { useTour } from './TourProvider';

const TourStep = ({ tourName, targetRef, content, placement = 'bottom' }) => {
  const { addStep } = useTour();
  
  // Run only once when component mounts
  useEffect(() => {
    if (tourName && targetRef && content) {
      // Pass the tour name and content directly
      addStep(tourName, targetRef, content, placement);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - intentional, runs only once

  return null; // This component doesn't render anything directly
};

export default TourStep;