# ASTRA Q-Route

A self-contained browser application for routing ASTRA commands, inspecting QASM, bridging requests to Puter, recording episodes, and evolving routing policy locally. It does not train model weights.

## Features

- Route commands across QASM, episode export, Puter, and assistant workflows.
- Paste, edit, and validate QASM source in the browser.
- Send prompts through Puter's browser AI bridge.
- Store up to 500 episodes in local browser storage.
- Import and export episode JSON.
- Run a local bounded policy-learning cycle every minute after five episodes.
- Publish a static build automatically with GitHub Pages.

## Run locally

```sh
npm start
```

Open `http://localhost:4173`. Use `npm run check` for syntax and policy validation.

## Learning

Learning is opt-in. Enable **Learning Loop** in the application to let ASTRA evaluate stored episodes and evolve the routing weights used in later decisions. Episodes stay in the browser and are never uploaded by this application.

Policy updates are limited to the repository-defined value ranges in `src/policy.js`. Puter requests are sent only when the user clicks **Ask Puter**.

## Publish

Pushes to `main` run [ASTRA validation](.github/workflows/ci.yml). GitHub Pages deployment is handled by [the Pages workflow](.github/workflows/pages.yml).

1. In GitHub, open **Settings > Pages**.
2. Under **Build and deployment**, select **GitHub Actions**.
3. Push the repository to `main`.
4. Open the deployed Pages URL shown by the workflow.

No API keys are required by the static application; Puter handles authentication through its browser integration.

## Privacy

Episode data, routing state, and policy state are stored under the `astra-qroute-v1` key in local storage. Import or export JSON explicitly to move this data. The application contains no analytics or server-side persistence.
