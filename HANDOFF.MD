# Rapoo MT760 — Open-Source Mouse Configurator

**Technical Handoff & Development Plan**

- **Status:** Planning / Initial Research
- **Date:** 2026-10-15
- **Project type:** Open-source software
- **Primary approach:** WebHID-first
- **Alternative approach:** Desktop application with native HID access
- **Primary target:** Rapoo MT760 family
- **Initial development environment:** Linux (Ubuntu)
- **Development methodology:** Research-driven, evidence-based reverse engineering

---

## 1. Project Overview

### 1.1 Objective

Develop an independent, open-source configuration application for Rapoo MT760 mice, eliminating or reducing dependency on the manufacturer's proprietary configuration software.

The application should allow users to customize supported hardware settings and, whenever technically possible, save these configurations directly to the mouse's onboard memory.

The preferred implementation is a web application that communicates directly with the mouse using the WebHID API.

If browser restrictions prevent access to the necessary HID interfaces, the project should support a native desktop alternative.

### 1.2 Project Philosophy

- Open source and community-driven.
- Local-first, with no mandatory cloud services.
- No user account or authentication required.
- Cross-platform whenever technically possible.
- Prefer direct communication with hardware over background remapping services.
- Prioritize compatibility, reliability, and safety.
- Keep hardware communication independent from the graphical interface.
- Use reverse engineering to document protocols rather than reproducing proprietary source code.
- Make discoveries reproducible and verifiable.

### 1.3 Definition of Success

The initial technical objective is:

**Successfully communicate with a Rapoo MT760 using an independent application and modify one confirmed hardware configuration, such as DPI, without requiring the official Rapoo software.**

The longer-term objective is a complete configurator with persistent settings stored on the device where supported.

---

## 2. Target Hardware

### 2.1 Mouse Family

Primary target: Rapoo MT760.

Related variants to investigate:

- Rapoo MT760
- Rapoo MT760L
- Rapoo MT760M
- Rapoo MT760 Pro
- Rapoo MT760 Infinity

Different variants may use different firmware, HID interfaces, communication protocols, or hardware capabilities.

**Do not assume protocol compatibility between variants.**

### 2.2 Connection Methods

Investigate the following connection methods independently:

| Connection       | Priority | Notes                                             |
| ---------------- | -------- | ------------------------------------------------- |
| Wired USB        | High     | Prefer for initial investigation if supported     |
| 2.4 GHz receiver | High     | Potentially different configuration interface     |
| Bluetooth        | Low      | May expose different HID services or restrictions |

The actual interfaces must be identified experimentally.

### 2.3 Hardware Capabilities to Investigate

- DPI configuration.
- Programmable buttons.
- Scroll-wheel functionality.
- Gesture or shortcut configuration.
- Onboard profiles.
- Persistent configuration storage.
- Battery information.
- Connection information.
- Firmware and device identification.

These are investigation targets, not confirmed capabilities exposed by an accessible protocol.

### 2.4 Critical Unknowns

Before implementation, determine:

1. The exact MT760 variant and firmware version.
2. USB Vendor ID and Product ID.
3. Available HID interfaces and report descriptors.
4. Whether a dedicated vendor-specific HID interface exists.
5. Whether configuration works over wired USB, 2.4 GHz, Bluetooth, or only selected modes.
6. Whether configuration writes directly to the mouse or through a receiver.
7. Which settings are actually stored in onboard memory.
8. Whether configurations survive disconnecting the mouse, changing computers, and rebooting.
9. Whether settings require a proprietary service running continuously.

---

## 3. Research and Existing Software

Existing applications should be used both as technical references and as examples of software architecture.

### 3.1 ClickSync

**Repository:** https://github.com/Nuitfanee/ClickSync

A multi-brand mouse configurator based on the WebHID API, with support for selected Rapoo devices and other manufacturers.

Potential research areas:

- WebHID device discovery.
- Device-specific protocol implementations.
- HID report construction.
- Feature report communication.
- DPI configuration workflows.
- Button configuration workflows.
- Profile serialization.
- Error handling and device compatibility.

**Important:** Compatibility with the MT760 has not been confirmed. ClickSync's implementation for other Rapoo devices must not be assumed to work with this mouse.

Inspect the repository's current license before copying or adapting code.

### 3.2 ClickSync WebHID Workbench

**Reference path to investigate:**

https://github.com/Nuitfanee/ClickSync/blob/main/tools/WebHID_Workbench.js

A previously identified utility associated with inspecting WebHID interactions.

Determine whether the utility is still available at that path and examine its actual capabilities before adopting it.

Research objectives:

- Capture `sendReport()` calls.
- Capture `sendFeatureReport()` calls.
- Capture `receiveFeatureReport()` calls.
- Record command payloads.
- Compare configuration changes.
- Export traces for analysis.

Potentially useful alongside the Rapoo browser-based configurator.

### 3.3 Rapoo Official Software

**Rapoo Download Center:**

https://rapoo.com/en/support/downloadcenter

**Rapoo Web HUB:**

https://hub.rapoo.cn/

Investigate the relevant official software for the exact mouse variant, including Rapoo A HUB Office and any available legacy driver.

The official application is the primary behavioral reference for understanding how the manufacturer communicates with the device.

Research objectives:

- Determine application architecture.
- Identify native modules and device communication libraries.
- Discover device detection mechanisms.
- Find HID-related API calls.
- Understand packet construction.
- Understand how DPI and button settings are encoded.
- Determine how configurations are read, written, and persisted.

The availability of web-based configuration for the exact MT760 variant must be tested, rather than assumed.

### 3.4 Piper and libratbag

**Piper:**

https://github.com/libratbag/piper

**libratbag:**

https://github.com/libratbag/libratbag

Useful Linux-focused reference implementations.

Research areas:

- Separation of frontend and hardware backend.
- Device discovery and capability modeling.
- Device configuration interfaces.
- Profile management.
- Error handling.
- Abstraction of hardware-specific features.

These projects are primarily architectural references. They are not confirmed to support the MT760.

### 3.5 Solaar

**Repository:**

https://github.com/pwr-Solaar/Solaar

Useful for examining how Linux software manages wireless peripherals, receiver communication, device features, and persistent configuration.

Solaar mainly targets Logitech hardware and its protocols should not be treated as Rapoo protocols.

### 3.6 Linux HID Rapoo Driver

**Linux kernel source:**

https://github.com/torvalds/linux/blob/master/drivers/hid/hid-rapoo.c

Investigate existing Rapoo-specific HID handling and device quirks.

The kernel driver may reveal useful identifiers or behavior, but it is not necessarily a source for the proprietary configuration protocol.

### 3.7 Other Functional References

**X-Mouse Button Control:**

https://www.highrez.co.uk/downloads/XMouseButtonControl.htm

**Mac Mouse Fix:**

https://macmousefix.com/

These projects are useful for studying interaction design, user-facing features, button mapping, gestures, and macro workflows.

They are less relevant for reproducing persistent configuration at the hardware protocol level.

---

## 4. Reverse Engineering Strategy

### 4.1 Primary Tool: REA

**Repository:**

https://github.com/morluto/rea

**Documentation:**

https://rea.tools/

REA (Reverse Engineer Anything) provides reverse-engineering workflows accessible through AI agents and MCP tooling.

The project supports analysis of:

- Native executables.
- Dynamic libraries.
- JavaScript and Electron applications.
- .NET assemblies.
- Application behavior.
- Recorded network and packet artifacts.
- Additional supported binary formats.

For native binaries, it can integrate with tools such as Ghidra, Hopper, or IDA.

### 4.2 Installation

Review the project's current installation requirements.

Documented setup command:

```bash
npx rea-agents setup
```

Configure integration with the preferred coding agent, such as Codex or Claude Code.

Native binary analysis may require a separately installed and configured decompiler.

### 4.3 Static Analysis

Download the official software from the Rapoo website.

Record:

- Download URL.
- Software version.
- SHA-256 checksum.
- Target mouse variants.
- Operating system.
- Installation contents.

Identify:

- Executables.
- DLLs.
- Drivers.
- Background services.
- Configuration resources.
- Electron or .NET components, if present.

Search relevant functions and imports, including:

```text
HidD_GetHidGuid
HidD_GetAttributes
HidD_GetFeature
HidD_SetFeature
HidD_GetPreparsedData
CreateFileW
ReadFile
WriteFile
DeviceIoControl
SetupDiGetClassDevs
SetupDiEnumDeviceInterfaces
```

Trace relevant calls to understand how the application discovers and communicates with the mouse.

Investigate the code paths associated with DPI, button remapping, profiles, and persistence.

### 4.4 Dynamic Analysis

Static analysis alone may not reveal the full device protocol.

Perform controlled behavioral tests using the official software while capturing communication with the device.

**Windows tools:**

- Wireshark: https://www.wireshark.org/
- USBPcap: https://desowin.org/usbpcap/
- Process Monitor: https://learn.microsoft.com/en-us/sysinternals/downloads/procmon

**Linux tools:**

- usbmon: https://docs.kernel.org/usb/usbmon.html
- Wireshark.
- `lsusb`.
- `hid-recorder` from hid-tools.
- `usbhid-dump` where appropriate.

Capture one configuration change per experiment.

Example:

1. Establish the initial DPI value using the official application.
2. Start recording communication.
3. Change DPI from one supported value to another.
4. Stop recording.
5. Restore the original DPI.
6. Repeat the same experiment.
7. Compare the generated reports.

Repeat using other settings.

Do not assume that changing a UI control immediately writes to the device. Investigate whether there is a separate Apply or Save operation.

### 4.5 Evidence Requirements

Document every proposed command with:

- Device VID/PID.
- Interface number or HID collection.
- Report type.
- Report ID.
- Payload length.
- Request payload.
- Observed response.
- Configuration before and after.
- Connection mode.
- Firmware version.
- Number of successful repetitions.
- Confidence level.
- Source of evidence.

Example schema:

```yaml
feature: set_dpi
status: unverified
connection: unknown
vendor_id: null
product_id: null
report_type: unknown
report_id: null
payload_length: null
command_id: null
payload: null
response: null
confidence: unknown
evidence: []
```

Never populate unknown fields with guessed values.

### 4.6 Protocol Investigation

For each observed packet, determine whether it contains:

- Command identifier.
- Feature identifier.
- Parameter bytes.
- Device or profile identifier.
- Checksum or CRC.
- Sequence number.
- Status code.
- Response payload.

Use comparisons across multiple captures.

Do not assume that every byte changing between two captures represents DPI or another configuration parameter.

### 4.7 Reverse Engineering Safety

- Begin with read-only device inspection.
- Avoid undocumented write commands.
- Never experiment with firmware updates during the initial phases.
- Avoid pairing resets and receiver reconfiguration.
- Keep known-good settings recorded.
- Do not replay packets with unknown side effects.
- Perform one controlled change at a time.
- Test only on devices you own or have permission to examine.
- Document recovery procedures.
- Review legal and licensing restrictions applicable to interoperability research.

---

## 5. WebHID Feasibility Study

### 5.1 Preferred Architecture

The preferred application is a local-first browser configurator using WebHID.

```text
React + TypeScript
        |
        v
Application Services
        |
        v
Rapoo Protocol Implementation
        |
        v
WebHID Transport
        |
        v
Mouse / Receiver
        |
        v
Onboard Configuration Storage
```

This assumes the hardware and browser expose an accessible interface through which the necessary configuration commands can be exchanged.

### 5.2 Why WebHID First?

Potential benefits:

- No desktop installer.
- Simple deployment.
- No application-specific background process.
- Cross-platform access through compatible browsers.
- No cloud infrastructure necessary for device communication.
- Easy open-source distribution.
- Potential to save settings directly into the device.

### 5.3 WebHID Limitations

**Reference:**

https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API

WebHID is not available in all browsers.

Access requires a secure context, such as HTTPS or localhost, and explicit permission for supported device access.

Protected HID collections may be inaccessible.

WebHID does not guarantee access to all endpoints or vendor-specific protocols.

Some devices may expose only standard mouse interfaces, which can be blocked by browser protections.

Bluetooth HID behavior may differ from USB or receiver-based communication.

### 5.4 Initial Browser Experiment

Create a minimal static web page that:

1. Checks whether `navigator.hid` is available.
2. Requests device selection through a user action.
3. Identifies the selected HID device.
4. Displays VID/PID.
5. Lists exposed HID collections and reports.
6. Attempts to open the device.
7. Displays clear permission and connection errors.
8. Does not send configuration commands.

Use Chromium or Chrome in the initial tests.

**Success criterion:** A relevant configuration-capable HID interface is exposed and can be opened.

**Failure criterion:** WebHID is unavailable or relevant interfaces are inaccessible.

An accessible standard HID device is not sufficient proof that hardware configuration is possible.

### 5.5 Persistence Validation

If a documented protocol allows configuration writes:

1. Record the original setting.
2. Apply a safe, known configuration change.
3. Verify the change.
4. Close the browser.
5. Disconnect and reconnect the mouse.
6. Restart the operating system.
7. Test on another computer without Rapoo software.
8. Verify that the configuration persists.

Distinguish between:

- Browser-local settings.
- Operating-system remapping.
- Volatile device settings.
- Persistent device memory.

Only the last category meets the desired onboard-storage objective.

---

## 6. Alternative: Native Desktop Application

If WebHID cannot access the required interface, use a native HID transport.

### 6.1 Recommended Technologies

- Rust.
- hidapi: https://github.com/libusb/hidapi
- Tauri: https://tauri.app/
- React and TypeScript.

### 6.2 Proposed Architecture

```text
React UI
   |
   v
Application API
   |
   v
Core Domain
   |
   v
Rapoo Protocol
   |
   +---------------------+
   |                     |
   v                     v
WebHID Transport    Native HID Transport
   |                     |
   +----------+----------+
              |
              v
         Rapoo Mouse
```

The protocol data model, command definitions, and feature validation should remain as transport-independent as possible.

The native implementation must separately handle operating-system device permissions and I/O differences.

### 6.3 Important Design Decision

Do not build the desktop application first solely because it provides broader device access.

Begin with a focused feasibility experiment.

If the browser can perform all required configuration operations, keep the web application as the primary product.

If it cannot, introduce a native transport without rewriting the entire interface.

A desktop app does not automatically solve an unknown or undocumented protocol.

---

## 7. Proposed Technical Architecture

### 7.1 Frontend

Recommended stack:

- React.
- TypeScript.
- Vite.
- Accessible UI components.
- Responsive layout.

The interface should be simple, focused, and functional.

Avoid unnecessary dashboards, user accounts, and cloud features.

### 7.2 Core Modules

**Device Discovery**

Responsible for detecting supported devices and determining their capabilities.

**Protocol Layer**

Responsible for translating high-level configuration requests into device-specific HID messages.

**Transport Layer**

Responsible for opening connections, sending reports, receiving responses, and handling transport errors.

**Device Capabilities**

Responsible for recording confirmed features, supported values, connection restrictions, and device variants.

**Configuration Management**

Responsible for reading, editing, validating, comparing, and applying configurations.

**Profile Management**

Responsible for handling device profiles where supported and maintaining optional local backups.

### 7.3 Suggested Repository Structure

```text
rapoo-configurator/
├── apps/
│   └── web/
│       └── src/
├── packages/
│   ├── core/
│   ├── protocol-rapoo/
│   ├── transport-webhid/
│   └── device-definitions/
├── native/
│   └── hid-transport/
├── research/
│   ├── device-identification/
│   ├── software-analysis/
│   ├── captures/
│   └── experiments/
├── docs/
│   ├── architecture.md
│   ├── protocol.md
│   ├── compatibility.md
│   └── research-log.md
├── tests/
├── README.md
└── LICENSE
```

Treat the native directory as optional until the WebHID feasibility study is complete.

Avoid premature abstraction where no confirmed implementation exists.

---

## 8. Functional Requirements

### 8.1 MVP

Target capabilities:

- Detect a compatible Rapoo MT760.
- Display basic device information.
- Identify connection mode where possible.
- Read at least one confirmed configurable property.
- Change one supported property, ideally DPI.
- Verify the result through the hardware or official application.
- Save the setting to device memory if supported.
- Provide user-friendly error handling.

Not every feature is mandatory for the first technical proof of concept.

### 8.2 Post-MVP Features

Subject to protocol and firmware capabilities:

- Custom DPI levels.
- DPI presets.
- Programmable button mapping.
- Multiple device profiles.
- Profile switching.
- Onboard profile storage.
- Battery display.
- Configuration import/export.
- Factory configuration restoration through verified commands.
- Support for additional Rapoo variants.
- Optional desktop application.

### 8.3 Out of Scope Initially

- Firmware flashing.
- Bootloader modifications.
- Proprietary driver replacement.
- Kernel development.
- Cloud synchronization.
- User accounts.
- Telemetry.
- Automatic updates to device firmware.
- Unsupported Bluetooth configuration.
- System-wide remapping of arbitrary applications.

---

## 9. Development Roadmap

### Phase 0 — Research and Inventory

**Goal:** Understand the target hardware and available software.

Tasks:

- [ ] Identify exact mouse variant.
- [ ] Record firmware version if available.
- [ ] Determine available connection modes.
- [ ] Record USB VID/PID.
- [ ] Inspect HID report descriptors.
- [ ] Download the correct official software.
- [ ] Record software version and hash.
- [ ] Inspect ClickSync's architecture and protocol implementations.
- [ ] Check whether Rapoo Web HUB supports this mouse.
- [ ] Create a research log.

**Deliverable:** Device inventory and research baseline.

### Phase 1 — WebHID Proof of Concept

**Goal:** Determine whether a browser can communicate with a relevant device interface.

Tasks:

- [ ] Create a minimal Vite project.
- [ ] Implement WebHID support detection.
- [ ] Implement user-initiated device selection.
- [ ] Enumerate HID collections and report definitions.
- [ ] Attempt a non-destructive connection.
- [ ] Record browser restrictions and errors.
- [ ] Document the feasibility decision.

**Deliverable:** Browser-based read-only device inspector.

**Decision gate:** Continue with WebHID or investigate native transport.

### Phase 2 — Reverse Engineering

**Goal:** Understand the official communication protocol.

Tasks:

- [ ] Install and configure REA.
- [ ] Configure a native analysis provider if necessary.
- [ ] Analyze official executables and libraries.
- [ ] Locate HID communication functions.
- [ ] Capture controlled official-software operations.
- [ ] Identify likely command structures.
- [ ] Compare static and dynamic evidence.
- [ ] Document known commands and unknown fields.
- [ ] Investigate persistent storage behavior.

**Deliverable:** Evidence-backed protocol documentation.

### Phase 3 — Independent Protocol Implementation

**Goal:** Reproduce one safe, documented configuration operation.

Tasks:

- [ ] Implement device identification.
- [ ] Implement transport interface.
- [ ] Implement known report encoding.
- [ ] Implement response validation.
- [ ] Add protocol fixtures.
- [ ] Test on the physical device.
- [ ] Verify behavior using the official application.
- [ ] Test disconnect/reconnect persistence.

**Deliverable:** Functional independent command-line or browser proof of concept.

### Phase 4 — Web Configurator MVP

**Goal:** Create a usable configuration interface.

Tasks:

- [ ] Design device overview.
- [ ] Add DPI control if supported.
- [ ] Display supported features dynamically.
- [ ] Add Apply/Save functionality.
- [ ] Display connection and operation errors.
- [ ] Prevent unsupported commands.
- [ ] Add configuration readback where possible.
- [ ] Test using supported connection modes.

**Deliverable:** Usable web-based configurator.

### Phase 5 — Broader Features and Compatibility

**Goal:** Expand functionality without compromising reliability.

Tasks:

- [ ] Add button mapping if protocol supports it.
- [ ] Add profiles.
- [ ] Add import/export.
- [ ] Test related MT760 variants.
- [ ] Add native fallback if necessary.
- [ ] Improve automated tests.
- [ ] Publish compatibility documentation.
- [ ] Prepare community contribution guidelines.

**Deliverable:** Expanded open-source release.

---

## 10. Testing Strategy

### 10.1 Unit Tests

Test:

- Payload serialization.
- Payload parsing.
- Command validation.
- Supported value ranges.
- Device capabilities.
- Profile data models.

Use recorded fixtures.

### 10.2 Integration Tests

Test transport behavior using mock implementations first.

Where real hardware is available, test known commands with explicit device identification.

### 10.3 Hardware Tests

For each supported device and firmware version:

- Read device details.
- Apply a supported setting.
- Confirm hardware behavior.
- Verify configuration readback where available.
- Reconnect the device.
- Restart the operating system.
- Confirm persistence.
- Repeat across relevant connection modes.

### 10.4 Compatibility Matrix

Maintain a table containing:

| Model     | Firmware | Connection | Read     | Write    | Persistence |
| --------- | -------- | ---------- | -------- | -------- | ----------- |
| MT760     | Unknown  | USB        | Untested | Untested | Untested    |
| MT760     | Unknown  | 2.4 GHz    | Untested | Untested | Untested    |
| MT760     | Unknown  | Bluetooth  | Untested | Untested | Untested    |
| MT760 Pro | Unknown  | Unknown    | Untested | Untested | Untested    |

Never mark features as supported without physical verification or sufficiently strong reproducible evidence.

---

## 11. Engineering Principles

- Evidence before implementation.
- No invented protocol constants.
- No unverified device compatibility claims.
- Keep research artifacts separate from production code.
- Prefer minimal vertical slices.
- Separate transport from protocol logic.
- Separate protocol logic from UI.
- Prefer composition over unnecessary inheritance.
- Keep interfaces focused and small.
- Use clear error types and meaningful diagnostics.
- Avoid speculative abstractions.
- Do not assume all mouse variants behave identically.
- Do not modify device firmware.
- Preserve an auditable research history.

Use AI agents to accelerate investigation and development, but validate hardware-related conclusions against actual traces and physical tests.

---

## 12. Agent Handoff Instructions

### Agent Role

You are a software engineer specializing in USB/HID communication, browser hardware APIs, reverse engineering, and cross-platform application development.

Your objective is to investigate the Rapoo MT760 configuration protocol and develop an independent open-source configuration tool.

### Primary Instructions

1. Read this document before making architectural decisions.
2. Begin with hardware identification and WebHID feasibility.
3. Research existing implementations before writing new protocol code.
4. Use ClickSync as a technical reference.
5. Use REA and native analysis tools where appropriate.
6. Prefer observations from controlled captures over assumptions derived from pseudocode.
7. Identify unknown protocol details explicitly.
8. Produce reproducible documentation for each discovery.
9. Start with read-only operations.
10. Obtain protocol evidence before attempting configuration writes.
11. Avoid unknown commands, firmware operations, and pairing resets.
12. Keep the implementation modular.
13. Use WebHID first, but switch to native HID if technical constraints require it.
14. Do not build a complex UI before proving hardware communication.
15. Report technical blockers and recommend the smallest meaningful next experiment.

### Suggested First Task

```text
Read HANDOFF.md and begin Phase 0 and Phase 1.

Research the Rapoo MT760 device family and
the ClickSync repository.

Create a minimal read-only WebHID application
capable of detecting a user-selected device
and inspecting exposed HID collections.

Do not send configuration commands.

Document the device capabilities, unknowns,
browser restrictions and evidence.

Do not implement the full UI or reverse engineer
the entire official application yet.

The first milestone is establishing whether
WebHID can access a configuration-capable
interface on the Rapoo MT760.
```

### Suggested Reverse Engineering Task

```text
Investigate the official Rapoo MT760 software
using REA and an appropriate native analysis
provider.

Identify the software architecture, relevant
executables, DLLs, services and device APIs.

Trace USB/HID device discovery and communication
functions.

Locate the code responsible for DPI changes,
button mapping and profile storage.

Reconstruct command formats only where
the available evidence permits.

Correlate static-analysis findings with
controlled USB captures.

Document confirmed findings, hypotheses,
unknowns, and supporting evidence.

Do not issue undocumented write commands,
change pairing information, or update firmware.

Produce a protocol specification suitable
for an independent implementation.
```

---

## 13. Risk Register

| Risk                         | Impact                           | Mitigation                                  |
| ---------------------------- | -------------------------------- | ------------------------------------------- |
| Protected HID interface      | Web application unavailable      | Native transport fallback                   |
| Different firmware protocols | Incorrect communication          | Per-device capability definitions           |
| Unknown write commands       | Device malfunction               | Read-only first, validated commands only    |
| No onboard persistence       | Main goal partially unattainable | Explicit feature limitations                |
| Receiver-dependent protocol  | Increased complexity             | Separate connection investigations          |
| Browser incompatibility      | Reduced platform coverage        | Chromium baseline and native option         |
| Proprietary licensing        | Distribution constraints         | Independent implementation and legal review |
| Incomplete packet captures   | Incorrect protocol assumptions   | Controlled repeated experiments             |

---

## 14. Reference Links

### Hardware and Official Software

- [Rapoo Download Center](https://rapoo.com/en/support/downloadcenter)
- [Rapoo Web HUB](https://hub.rapoo.cn/)

### Reverse Engineering

- [REA — Reverse Engineer Anything](https://github.com/morluto/rea)
- [REA Documentation](https://rea.tools/)
- [Ghidra](https://github.com/NationalSecurityAgency/ghidra)
- [Wireshark](https://www.wireshark.org/)
- [USBPcap](https://desowin.org/usbpcap/)
- [Microsoft Process Monitor](https://learn.microsoft.com/en-us/sysinternals/downloads/procmon)
- [Linux usbmon Documentation](https://docs.kernel.org/usb/usbmon.html)

### Mouse Configuration Projects

- [ClickSync](https://github.com/Nuitfanee/ClickSync)
- [ClickSync WebHID Workbench — path to verify](https://github.com/Nuitfanee/ClickSync/blob/main/tools/WebHID_Workbench.js)
- [Piper](https://github.com/libratbag/piper)
- [libratbag](https://github.com/libratbag/libratbag)
- [Solaar](https://github.com/pwr-Solaar/Solaar)
- [Linux Rapoo HID Driver](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-rapoo.c)
- [X-Mouse Button Control](https://www.highrez.co.uk/downloads/XMouseButtonControl.htm)
- [Mac Mouse Fix](https://macmousefix.com/)

### Application Development

- [WebHID API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API)
- [WebHID Specification](https://wicg.github.io/webhid/)
- [hidapi](https://github.com/libusb/hidapi)
- [Tauri](https://tauri.app/)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)

---

## 15. Immediate Next Actions

The project should start with a short, evidence-focused research cycle rather than full application development.

**First action:** Identify the exact mouse variant and accessible HID interfaces.

**Second action:** Test whether WebHID can open a relevant device interface.

**Third action:** Inspect existing Rapoo support implementations in ClickSync.

**Fourth action:** Obtain and inventory the official Rapoo software.

**Fifth action:** Use REA and controlled packet captures to investigate configuration operations.

Only after these steps should the application begin implementing hardware writes.

### Final Architectural Recommendation

**WebHID-first, protocol-driven, with an optional native HID transport.**

The preferred final experience is a lightweight web application that connects directly to the user's mouse, allows supported hardware customization, saves changes to onboard memory where possible, and can be closed afterward.

The project's defining technical milestone is not its graphical interface.

It is establishing a reliable, documented, independently implemented communication protocol for the Rapoo MT760.

---

**End of Handoff — Version 1.0**
