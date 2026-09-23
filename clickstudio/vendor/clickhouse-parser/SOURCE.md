# ClickHouse native parser

- Source repository: `ClickHouse/ClickHouse`
- Source PR: [#118591](https://github.com/ClickHouse/ClickHouse/pull/118591)
- Source commit: `68085149131ee43144b975f7c0ec01137208fb8a`
- Original CI artifact path: `build_wasm_parser/parser.wasm`
- Local build: `utils/wasm-parser/npm` using the upstream `npm run setup` and `npm run build` scripts with WASI SDK 33.
- License: Apache-2.0; see [LICENSE](./LICENSE).

The CI artifact URL was not accessible when this file was vendored, so `parser.wasm` was rebuilt from the exact pinned source commit. The checksum records these vendored bytes; it does not claim byte-for-byte identity with the original CI artifact.
