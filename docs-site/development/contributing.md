# Contributing

Guidelines for contributing to Vibora.

## Development Setup

See the [Development Setup](/development/) page for getting started.

## Code Style

- **TypeScript** for all code
- **ESLint** for linting (`mise run lint`)
- **Prettier** for formatting (via ESLint)
- **No default exports** — Use named exports

## Commit Messages

Follow conventional commit format:

```
type(scope): description

feat(terminal): add resize support
fix(kanban): correct drag-drop ordering
docs(readme): update installation instructions
refactor(api): simplify task routes
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Run checks: `mise run check`
4. Open a PR with a clear description

### PR Checklist

- [ ] Code passes `mise run check`
- [ ] New features have documentation
- [ ] Breaking changes are noted
- [ ] Commit messages follow convention

## Architecture Guidelines

### Frontend

- **Components** — Organize by feature (`kanban/`, `terminal/`, etc.)
- **Hooks** — Extract reusable logic to `hooks/`
- **Stores** — Use MobX State Tree for complex local state
- **Queries** — Use React Query for server state

### Backend

- **Routes** — One file per resource in `routes/`
- **Services** — Business logic in `services/`
- **Types** — Shared types in `shared/`

### Database

- **Schema** — Define in `server/db/schema.ts`
- **Migrations** — Generate with `mise run db:generate`
- **Push** — Apply with `mise run db:push`

## Testing

Currently minimal test coverage. When adding tests:

```bash
mise run test        # Run all tests
mise run test:watch  # Watch mode
```

## Documentation

- Update `README.md` for user-facing changes
- Update `DEVELOPMENT.md` for developer-facing changes
- Add inline comments for complex logic

## Release Process

Releases are managed by maintainers:

1. `mise run bump` — Bump version
2. Commit version changes
3. Tag with `v{version}`
4. Push tag to trigger release workflow

## Getting Help

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- Provide reproduction steps for bugs
