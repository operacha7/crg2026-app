// TourProvider.js - Ultra simple version with named tours
import React, { createContext, useState, useRef, useCallback, useContext } from 'react';

const TourContext = createContext();

export const TourProvider = ({ children }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [activeTour, setActiveTour] = useState(null); // Track which tour is active
  const toursRef = useRef({});  // Store different tours separately
  const targetRefs = useRef({});

  // Modified addStep to include tour name
  const addStep = useCallback((tourName, ref, content, placement = 'bottom') => {
    if (!toursRef.current[tourName]) {
      toursRef.current[tourName] = [];
    }
    toursRef.current[tourName].push({ ref, content, placement });
  }, []);

  // Modified startTour to accept tour name
  const startTour = useCallback((tourName = null) => {
    if (tourName && toursRef.current[tourName] && toursRef.current[tourName].length > 0) {
      setActiveTour(tourName);
      setCurrentStepIndex(0);
    } else {
      // No tour available for this name, do nothing
      console.log(`No tour available for: ${tourName}`);
    }
  }, []);

  const nextStep = useCallback(() => {
    if (activeTour && toursRef.current[activeTour]) {
      setCurrentStepIndex((prevIndex) => 
        Math.min(prevIndex + 1, toursRef.current[activeTour].length - 1)
      );
    }
  }, [activeTour]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex((prevIndex) => Math.max(prevIndex - 1, 0));
  }, []);

  const endTour = useCallback(() => {
    setCurrentStepIndex(-1);
    setActiveTour(null);
  }, []);

  const registerRef = useCallback((name) => {
    targetRefs.current[name] = React.createRef();
    return targetRefs.current[name];
  }, []);

  const getTargetElement = useCallback((stepIndex) => {
    if (activeTour && toursRef.current[activeTour]) {
      const step = toursRef.current[activeTour][stepIndex];
      if (step && step.ref && targetRefs.current[step.ref]) {
        return targetRefs.current[step.ref].current;
      }
    }
    return null;
  }, [activeTour]);

  // Get current steps for the active tour
  const getSteps = useCallback(() => {
    if (activeTour && toursRef.current[activeTour]) {
      return toursRef.current[activeTour];
    }
    return [];
  }, [activeTour]);

  return (
    <TourContext.Provider
      value={{
        currentStepIndex,
        getSteps,
        addStep,
        startTour,
        nextStep,
        prevStep,
        endTour,
        registerRef,
        getTargetElement,
        activeTour,
      }}
    >
      {children}
    </TourContext.Provider>
  );
};

export const useTour = () => useContext(TourContext);