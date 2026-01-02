/** @type { import('@storybook/react-webpack5').Preview } */

// ✅ Safe global var setup
if (typeof window !== "undefined" && !window.__STORYBOOK__) {
  window.__STORYBOOK__ = true;
}

const preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
