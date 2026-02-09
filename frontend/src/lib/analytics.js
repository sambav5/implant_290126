import posthog from "posthog-js";

export const initAnalytics = () => {

  if (!import.meta.env.VITE_POSTHOG_KEY) {
    console.warn("PostHog key missing");
    return;
  }

  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {

    api_host: "https://app.posthog.com",

    // Disable auto capture for privacy control
    autocapture: false,
    capture_pageview: false,

    // Healthcare privacy safety
    mask_all_text: true,
    mask_all_element_attributes: true
  });
};

export const trackEvent = (event, properties = {}) => {
  posthog.capture(event, properties);
};

export const identifyUser = (userId) => {
  posthog.identify(userId);
};
