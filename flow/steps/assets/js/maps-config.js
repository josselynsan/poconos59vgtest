/* ============================================================
   Google Maps / Places key for THIS payment flow
   ------------------------------------------------------------
   Put the browser API key for the hosts that serve THIS checkout
   here. Do NOT reuse a key locked to another product's hosts —
   Google will 403 on every other origin.

   Google Cloud Console checklist for this key:
     1. Application restriction: HTTP referrers (websites)
     2. Add every host that will serve this checkout, e.g.
          https://getaways.vacationvip.com/*      ← primary host for Poconos
          https://getaways.vacationgurus.com/*
          https://*.vacationvip.com/*
          https://*.vacationgurus.com/*
          http://localhost:8080/*          ← only if you need local QA
          http://127.0.0.1:8080/*
     3. API restriction: Places API (New) only
     4. Paste the key below

   NOTE: the key below was carried over from the Pigeon Forge funnel,
   whose referrer allow-list covers *.vacationgurus.com. Poconos is
   served mainly from getaways.vacationvip.com, so that host must be
   added to the key's referrer list (or a dedicated key pasted here)
   before the dropdown will work in production.

   Empty string = feature off. Address stays a normal text input.
   ============================================================ */
window.pfMapsConfig = {
  /* >>> PUT THE GOOGLE MAPS API KEY HERE <<< */
  apiKey: "AIzaSyBlMhXTs2daDZZq-6QWeqyu3ksmAoi7Fow"
};
