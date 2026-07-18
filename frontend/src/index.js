import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { PostHogProvider } from '@posthog/react';
import { POSTHOG_HOST, POSTHOG_KEY } from '@/config/runtimeConfig';

const options = {
  api_host: POSTHOG_HOST,
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <PostHogProvider 
      apiKey={POSTHOG_KEY}
      options={options}
    >
      <App />
    </PostHogProvider>
  </React.StrictMode>,
);
