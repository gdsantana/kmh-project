# Rapoo protocol

Reserved for reusable evidence-backed command encoding and response validation.
This package has no implementation yet. Fixed read experiments live in
`research/experiments/read-mt760.py` and `apps/web/src/webhid-probe.ts`; the Linux
bridge in `apps/bridge` delivers battery/DPI to the browser. See
`research/experiments/browser-telemetry.md` for evidence and limitations.
A separate supervised experiment in `research/experiments/write-mt760-dpi.py` tests and restores one inactive DPI value. See `research/experiments/write-dpi.md`. The web API remains read-only; pairing and firmware updates are not implemented.
Do not reuse ClickSync's Rapoo protocol without proving compatibility with this exact device.
