import posthog from "posthog-js";

export const initAnalytics = () => {

  if (!import.meta.env.VITE_POSTHOG_KEY) return;

  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: "https://app.posthog.com",

    autocapture: false,
    capture_pageview: false,

    mask_all_text: true,
    mask_all_element_attributes: true
  });
};

export const trackEvent = (event, props = {}) => {
  posthog.capture(event, props);
};

export const identifyUser = (id) => {
  posthog.identify(id);
};

export const trackPageView = (path) => {
  posthog.capture("$pageview", { path });
};
