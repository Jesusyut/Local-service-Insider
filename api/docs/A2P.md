# Production messaging activation

SMS is disabled by default. Deploy and test the application with `SMS_ENABLED=false`; messages are persisted as `logged`, not sent. Dry-run entries are never replayed automatically when sending is enabled.

Before changing the flag:

- Register the actual legal business and appropriate brand type in Twilio. Supply business details directly in Twilio, never in Git.
- Register the messaging campaign and attach the approved sending number / messaging setup. Describe lead intake, scheduling, reminders, partner notifications, consent collection, STOP and HELP honestly.
- Publish approved privacy and terms pages. Set their public URLs in the turf configuration and verify the mobile form links work. State the purpose of mobile data collection and sharing with the installation partner; do not claim general marketing-list consent.
- Supply the exact checkbox disclosure, proof of opt-in, sample messages, expected volume, and the real public quiz URL. Keep the checkbox unchecked by default.
- Obtain operational SMS consent from each partner notification recipient. Set the partner timezone, notification consent and alert-recipient timezone explicitly. Never infer these from the ad's area label.
- Keep Twilio's own opt-out handling enabled. Configure POST inbound webhooks to `API_BASE_URL/api/sms/inbound` exactly; mismatched public URLs fail signature checks.
- Verify the brand, campaign, sender and relevant destination permissions are approved in Twilio. Follow the current [Twilio registration guide](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc).
- Configure provider secrets only in Render. Set `ALERT_EMAIL`, and optional `ALERT_PHONE`, `ALERT_TIMEZONE`, `ALERT_SMS_CONSENT=true` only for an opted-in operator.
- With an inbox and phone controlled by the owner, test opt-in, booking, confirmations, reminders, STOP, HELP, provider failures and partner notification routing. Do not send production traffic during unapproved testing.
- After approval and those checks, set `SMS_ENABLED=true`. Record the approving operator, approval references and activation time in the operational change record. Monitor the first leads and delivery-failure dashboard.

Every SMS, including partner/operator alerts, uses the recipient's configured timezone and the 08:00–20:00 send window. Partner email alerts are immediate. Unassigned homeowner holding texts use the browser-supplied validated contact timezone because no partner exists yet. STOP suppression is global by normalized phone and cancels queued messages for that lead.

An SMS already accepted by the provider cannot be recalled. A network timeout after acceptance can have an ambiguous outcome; inspect Twilio delivery history before manually replaying a dead-letter message. The local queue prevents duplicate application scheduling, but a provider's ambiguous acknowledgement cannot provide an exactly-once network-delivery guarantee.
