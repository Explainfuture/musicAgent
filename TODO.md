# TODO

## Memory trimming and summarization

- Add hard limits for local playback history, skipped tracks, feedback memory, and recent conversation context before sending agent requests.
- Summarize older user events into a compact profile instead of sending raw history indefinitely.
- Keep enough recent signal for recommendations while preventing request payloads and LLM prompts from growing over time.
- Add tests that lock down the maximum request memory size and summary behavior.
