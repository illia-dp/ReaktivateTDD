# Reaktivate — Fast-Test Homework

## Project Goal

Complete the original React take-home assignment using a clean, testable MVP/MVVM architecture.

Follow the original assignment requirements. Do not introduce unnecessary architecture, dependencies, or features.

## Architecture

- Strictly separate React Views from application logic.
- No business logic, calculations, filtering, or conditional business decisions in TSX/JSX.
- Use MobX and mobx-react for observable state and reactivity.
- Keep Controllers responsible for behavior and UX logic.
- Keep API integration isolated from Views.
- Use shared stores only for genuinely shared data.
- Prefer simple solutions over additional abstraction layers.
- Handle asynchronous operations, errors, and lifecycle cleanup.
- Avoid unnecessary MobX reactions and renders.

## Engineering Standards

- Use TypeScript with strict typing.
- Avoid `any` unless explicitly justified.
- Prefer small, focused, readable modules.
- Keep reusable and feature-specific components separate.
- Write meaningful unit tests for business logic and Controllers.
- Use dependency injection where it improves testability.
- Do not introduce unrelated changes.
- Do not use console.log in final code.

## Workflow

- Inspect existing code before making changes.
- Follow the approved implementation scope.
- For architectural changes, propose a plan before implementation.
- Implement incrementally and test each meaningful change.
- Run relevant tests, type checking, and builds when available.
- Report what changed, what was verified, and remaining issues.
- Do not claim tests passed unless they were actually executed.
- Do not invent API contracts or undocumented requirements.
- Never disable TLS certificate verification globally.

## Git Safety

- Never create commits or push without explicit approval.
- Never force-push, reset, or discard existing work without approval.
- Do not modify unrelated files.
