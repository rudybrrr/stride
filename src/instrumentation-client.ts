// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

Sentry.init({
  dsn: "https://0752816f456da9b8ffe1c41401c1d53f@o4511155004375040.ingest.us.sentry.io/4511155004571648",

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});

posthog.init('phc_urUNzVHREitd7GiBZLS6VnqGz4FYSqHbvC2AVRGua8UD', {
    api_host: 'https://us.i.posthog.com',
    defaults: '2026-01-30'
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
