// src/components/AnimatedCounter.js
// Animated counter that smoothly transitions between values
// Used in NavBar1 for filtered and selected record counts

import { useState, useEffect, useRef } from "react";

/**
 * AnimatedCounter - displays a number with smooth count up/down animation
 * and a glowing ring border that pulses when value changes
 *
 * @param {number} value - The target value to display
 * @param {number} duration - Animation duration in milliseconds (default: 800)
 * @param {string} className - CSS classes for the container
 * @param {object} style - Inline styles for the container
 * @param {string} glowColor - Color for the glowing ring effect (default: white)
 */
export default function AnimatedCounter({
  value,
  duration = 800,
  className = "",
  style = {},
  glowColor = "rgba(255, 255, 255, 0.8)",
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isGlowing, setIsGlowing] = useState(false);
  // Mirrors the latest rendered value. We can't use displayValue directly
  // inside the effect because the effect's deps shouldn't include it (would
  // re-run mid-animation), and we can't use a write-once "previous value"
  // ref because React StrictMode in dev runs each effect twice — setup,
  // cleanup, setup — which would cause the second run to think the value
  // hadn't changed from the previousValueRef set during the first run, and
  // bail out before any frame painted. Tracking the actual rendered value
  // makes the second run start from 0 (or wherever we really are visually)
  // rather than from a phantom "previously committed" value.
  const displayValueRef = useRef(0);
  const animationRef = useRef(null);

  useEffect(() => {
    const startValue = displayValueRef.current;
    const endValue = value;

    // Genuinely no change — skip the animation entirely.
    if (startValue === endValue) {
      return undefined;
    }

    // Trigger glow effect
    setIsGlowing(true);
    const glowTimeout = setTimeout(() => setIsGlowing(false), duration + 500);

    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startTime = performance.now();
    const diff = endValue - startValue;

    // Easing function for smooth deceleration
    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);

      const currentValue = Math.round(startValue + diff * easedProgress);
      setDisplayValue(currentValue);
      displayValueRef.current = currentValue;

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      clearTimeout(glowTimeout);
    };
  }, [value, duration]);

  // Glowing ring styles
  const glowStyles = isGlowing
    ? {
        boxShadow: `0 0 0 3px ${glowColor}, 0 0 15px 5px ${glowColor}`,
        transition: "box-shadow 0.3s ease-out",
      }
    : {
        boxShadow: "none",
        transition: "box-shadow 0.5s ease-out",
      };

  return (
    <div
      className={className}
      style={{
        ...style,
        ...glowStyles,
      }}
    >
      {displayValue}
    </div>
  );
}
