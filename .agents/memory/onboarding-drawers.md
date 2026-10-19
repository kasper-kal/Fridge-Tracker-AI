---
name: Immersive onboarding
description: Visual and interaction rules for every onboarding stage, including story, add flow, swipe, and account setup.
---

Use the same dimmed full-screen backdrop, floating card, progress indicator, and spotlight treatment across every onboarding stage: story slides, add prompt, method chooser, active add method, swipe tutorial, and username setup. Spotlight the current action while keeping its controls usable.

**Why:** The user explicitly asked for the immersive experience on every onboarding step, not only the add flow.

**How to apply:** Keep progress consistent across the full sequence. Spotlight the drawer's choices, active form or scanner, and swipe target; keep the floating card on-screen and preserve usable inputs and buttons. Advance past product entry only after a successful save; closing without saving must not mark it complete.

Keep username setup required when a user skips the tour. Products without a household are stored in a shared path, so anonymous access could expose data across devices.

**Why:** Skipping guidance should not silently make shared, unassigned product data available to anonymous users.

**How to apply:** Do not make account setup optional unless anonymous product storage is first isolated per device or otherwise safely scoped.