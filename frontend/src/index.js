import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { PostHogProvider } from '@posthog/react';

const options = {
  api_host: process.env.REACT_APP_POSTHOG_HOST || 'https://us.i.posthog.com',
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <PostHogProvider 
      apiKey={process.env.REACT_APP_POSTHOG_KEY}
      options={options}
    >
      <App />
    </PostHogProvider>
  </React.StrictMode>,
);
