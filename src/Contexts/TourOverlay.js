// TourOverlay.js with live translation of content
import React, { useEffect, useState } from 'react';
import { useTour } from './TourProvider';
import { useTranslate } from '../Utility/Translate';
import { useLanguage } from '../Contexts/LanguageContext';

const TourOverlay = () => {
  const { currentStepIndex, getSteps, nextStep, prevStep, endTour, getTargetElement } = useTour();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [targetRect, setTargetRect] = useState(null);
  
  // Get current language and translate function
  const { language } = useLanguage();
  const { translate } = useTranslate();
  
  const highlightPadding = 10;
  const steps = getSteps(); // Get steps from provider

  useEffect(() => {
    if (currentStepIndex >= 0 && currentStepIndex < steps.length) {
      const targetElement = getTargetElement(currentStepIndex);

      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        setTargetRect(rect);
        
        const placement = steps[currentStepIndex].placement;
        const overlayWidth = 400;
        const overlayHeight = 150;
        const padding = 15;
        let newPosition = {};

        switch (placement) {
          case 'top':
            newPosition = {
              top: rect.top - overlayHeight - padding + window.scrollY,
              left: rect.left + rect.width / 2 - overlayWidth / 2 + window.scrollX,
            };
            break;
            case 'top-high1':
              newPosition = {
                top: rect.top - overlayHeight - padding - 195 + window.scrollY,
                left: rect.left + rect.width / 2 - overlayWidth / 2 + window.scrollX,
              };
              break;
            case 'top-high':
              newPosition = {
                top: rect.top - overlayHeight - padding - 365 + window.scrollY,
                left: rect.left + rect.width / 2 - overlayWidth / 2 + window.scrollX,
              };
              break;
          case 'bottom':
          default:
            newPosition = {
              top: rect.bottom + padding + window.scrollY,
              left: rect.left + rect.width / 2 - overlayWidth / 2 + window.scrollX,
            };
            break;
          case 'left':
            newPosition = {
              top: rect.top + rect.height / 2 - overlayHeight / 2 + window.scrollY,
              left: rect.left - overlayWidth - padding + window.scrollX,
            };
            break;
          case 'right':
            newPosition = {
              top: rect.top + rect.height / 2 - overlayHeight / 2 + window.scrollY,
              left: rect.right + padding + window.scrollX,
            };
            break;
        }
        setPosition(newPosition);
      }
    }
  }, [currentStepIndex, steps, getTargetElement]);

  if (currentStepIndex < 0 || steps.length === 0) {
    return null;
  }

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  
  // Get current step content and check if it looks like a translation key
  const currentContentRaw = steps[currentStepIndex]?.content || '';
  
  // If content is a string and looks like a translation key, translate it on the fly
  const currentContent = typeof currentContentRaw === 'string' && 
                         currentContentRaw.startsWith('tour') 
                         ? translate(currentContentRaw) 
                         : currentContentRaw;

  // For debugging
  console.log('Tour step content:', {
    raw: currentContentRaw,
    translated: currentContent,
    language: language
  });

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1000, pointerEvents: 'none' }}>
      {/* Top mask */}
      {targetRect && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: targetRect.top + window.scrollY - highlightPadding,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          pointerEvents: 'auto',
        }} />
      )}
      
      {/* Left mask */}
      {targetRect && (
        <div style={{
          position: 'absolute',
          top: targetRect.top + window.scrollY - highlightPadding,
          left: 0,
          width: targetRect.left + window.scrollX - highlightPadding,
          height: targetRect.height + (highlightPadding * 2),
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          pointerEvents: 'auto',
        }} />
      )}
      
      {/* Right mask */}
      {targetRect && (
        <div style={{
          position: 'absolute',
          top: targetRect.top + window.scrollY - highlightPadding,
          left: targetRect.left + targetRect.width + window.scrollX + highlightPadding,
          width: '100%',
          height: targetRect.height + (highlightPadding * 2),
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          pointerEvents: 'auto',
        }} />
      )}
      
      {/* Bottom mask */}
      {targetRect && (
        <div style={{
          position: 'absolute',
          top: targetRect.top + targetRect.height + window.scrollY + highlightPadding,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          pointerEvents: 'auto',
        }} />
      )}
      
      {/* Border around the highlighted element */}
      {targetRect && (
        <div
          style={{
            position: 'absolute',
            top: targetRect.top + window.scrollY - highlightPadding,
            left: targetRect.left + window.scrollX - highlightPadding,
            width: targetRect.width + (highlightPadding * 2),
            height: targetRect.height + (highlightPadding * 2),
            borderRadius: '0px',
            backgroundColor: 'transparent',
            pointerEvents: 'none',
            zIndex: 1001,
          }}
        />
      )}

      {/* Tour popup box */}
      <div
        style={{
          position: 'absolute',
          ...position,
          backgroundColor: 'white',
          padding: '20px',
          border: '6px solid #4A4E69',
          borderRadius: '25px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          width: '400px',
          zIndex: 1002,
          pointerEvents: 'auto',
        }}
      >
        {/* Close button */}
        <button
          onClick={endTour}
          style={{
            position: 'absolute',
            bottom: '25px',
            left: '30px',
            background: 'none',
            border: 'none',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            color: '#e74c3c',
          }}
          aria-label="Close"
        >
          {translate("tClose")}
        </button>
        
        <p style={{ marginTop: '8px', marginBottom: '15px' }}>
          {currentContent}
        </p>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '15px' }}>
          {!isFirstStep && (
            <button 
              onClick={prevStep} 
              style={{ 
                marginRight: '10px',
                padding: '6px 12px',
                backgroundColor: '#9A8C98',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {translate("tPrevious")}
            </button>
          )}
          {!isLastStep ? (
            <button 
              onClick={nextStep}
              style={{ 
                padding: '6px 12px',
                backgroundColor: '#4A4E69',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {translate("tNext")}
            </button>
          ) : (
            <button 
              onClick={endTour}
              style={{ 
                padding: '6px 12px',
                backgroundColor: '#EB6E1F',
                color: 'white',
                border: 'none',
                borderRadius: '4px', 
                cursor: 'pointer',
              }}
            >
              {translate("tDone")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TourOverlay;