# Runtime recovery baseline

The repository's `main` branch at `f248cbc` is not runnable: it contains committed merge markers in JavaScript, CSS, documentation, and workspace configuration. Several marker-free commits immediately before it also fail when parsed as ES modules because `appKernel.js` contains an illegal top-level `return`.

This branch starts at `336c617`, the newest observed commit whose complete runtime JavaScript parses as ES modules. A local HTTP-served browser check additionally observed:

- the application loads its five sections;
- navigation from Home to Social completes;
- the renderer retains one mounted hero after navigation;
- no new browser error is emitted by this baseline.

The added tests make two recovery contracts repeatable:

1. every runtime JavaScript file is valid module source and contains no merge markers;
2. section/item identities are unique and every configured image hero resolves to a committed asset.

Later commits remain historical evidence. Reapply their behavior individually only when a focused test distinguishes a real improvement. Do not resolve the broken aggregate by selecting every `ours` or every `theirs` block.
