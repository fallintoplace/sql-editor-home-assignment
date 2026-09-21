# Stage 8: Voice and image input

## Mission

Make the workspace approachable without making it magical or unsafe. A user can show a screenshot or speak a question, but the result still becomes reviewable SQL and ClickHouse output.

Multimodal input is an accelerator, never a second product or a bypass around the SQL workspace.

## Borrow

- OpenAI image input: inspect screenshots, schema diagrams, error messages, and existing charts.
- OpenAI Realtime WebRTC: low-latency browser voice with a server-owned session configuration.
- Databricks and Metabase: keep the answer connected to a query and visualization instead of returning prose only.
- Hex and ClickHouse import flows: treat uploaded CSV or JSON as a previewable input with explicit downstream dependencies.

## Image flows

Start with high-value, bounded actions:

- Screenshot of an error → explain the error and suggest a SQL fix.
- Screenshot of a schema or dashboard → identify likely tables and ask for confirmation.
- Screenshot of a chart → suggest the ClickHouse query shape needed to reproduce it.
- CSV or JSON file → preview columns and propose an import mapping.

Never infer authorization or silently create tables from an image. Show the interpretation and the proposed action first.

An image is an input asset, not an authority. If it contains a chart, dashboard, or schema, show the extracted labels and the uncertain parts before proposing SQL. If it contains a CSV or JSON preview, show the column mapping and destination scope before any insert.

Images are attached to an artifact with a clear retention state. The user can remove the image after the interpretation is complete. The context preview must say whether the image, extracted text, query result, or all three will be sent to OpenAI.

## Voice flows

Voice should be a thin input layer over the same Ask Data and SQL flows:

- “Show daily active users for the last 30 days.”
- “Why did this query get slower?”
- “Explain the chart I am looking at.”

The screen remains authoritative. Show the transcript, proposed SQL, and execution state while audio is active. Allow interruption and correction.

Voice is push-to-talk or explicitly activated, with a visible recording state. Keyboard and text input remain complete alternatives. A voice response that proposes SQL still enters the same diff-and-review flow as typed OpenAI output.

Voice should control the existing workspace rather than create a parallel conversation product. “Filter this chart to Germany” becomes an explicit child query or view change, and “publish this” requires the same publish confirmation as a click.

Voice and image actions should resolve to the same command vocabulary as the keyboard and command palette: explain selection, open SQL, change filter, compare runs, preview import, and publish. This makes multimodal input an alternate shortcut, not an alternate permission system.

The action should land in the same file, result, and version-history surfaces used by typed work. If the user says “save this,” the product must clarify whether they mean a draft, a published question, a reusable snippet, or a dataset.

Multimodal follow-ups must preserve the same execution semantics as typed follow-ups. “Filter the chart” may be a local view filter or a database rerun; the confirmation should say which. “Add this to the dashboard” should create either a source reference or an explicit copy and show the difference.

“Monitor this” is allowed only as a guided handoff to the published-query monitor flow. Voice or image input may fill a proposed condition, schedule, or recipient list, but publication and notification permissions remain explicit.

## Technical boundary

- Image understanding uses a server-side OpenAI request with explicit image input.
- Voice uses WebRTC in a secure browser context and a server-created session.
- Both paths call the same schema lookup, SQL proposal, safety, execution, and artifact services.
- Voice output must not bypass the visible review step.
- OpenAI credentials stay on the server; browser sessions receive only the minimum session configuration.
- HyperDX records timing and failure telemetry, not raw audio by default.
- Image and audio artifacts have an owner, retention state, deletion action, and derived-text record.
- The multimodal path can fall back to text and keyboard when permissions, browser support, or transport fails.

## Acceptance gate

- Upload a screenshot and receive a useful, bounded interpretation.
- Speak a question and see the transcript and SQL proposal.
- Stop or correct a request mid-flow.
- No secret or unrestricted table data is sent to the model.
- All multimodal results are saved as ordinary artifacts.
- A user can complete the same task with keyboard and text only.
- No image or audio path can execute a mutation or DDL statement implicitly.
- A screenshot-to-query proposal shows extracted evidence, uncertainty, source columns, and the final SQL diff.
- A file import preview shows mapping, row limits, type coercion, and whether the next step is a temporary input or an explicit insert.
- A voice follow-up preserves the selected connection, parent artifact, and child-query lineage.
- Every voice or image action displays the command it intends to perform before applying it.
- Keyboard equivalents remain visible for every multimodal action.
- A failed transcription or image interpretation can be corrected as text without restarting the workspace.
- A multimodal-created query can be commented on, versioned, and reopened from the same workspace file browser as a typed query.
- A multimodal filter or save action states whether it creates a view change, child run, reference, or copy before applying it.
- A multimodal monitor proposal shows the published revision, condition, schedule, execution identity, and recipients before saving.

## Sources

- [OpenAI image input](https://developers.openai.com/api/docs/guides/images-vision)
- [OpenAI voice over WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc)
- [Hex SQL cells and uploaded inputs](https://learn.hex.tech/docs/explore-data/cells/sql-cells/sql-cells-introduction)
- [Databricks new SQL editor](https://docs.databricks.com/gcp/en/sql/user/sql-editor/)
- [Metabase SQL editor](https://www.metabase.com/docs/latest/questions/native-editor/writing-sql)

## Thread pickup

Ship image input before voice if time is limited. It has a clearer review workflow and helps with real SQL errors. Voice is the later wow layer. Keep the voice transport behind an interface so the core workflow does not depend on an active audio session.
