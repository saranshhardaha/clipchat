## Summary

<!-- What does this PR do? One paragraph. -->

## Type of change

- [ ] Bug fix
- [ ] New FFmpeg tool
- [ ] Enhancement to existing tool
- [ ] Documentation
- [ ] Chore / dependency update

## Checklist

- [ ] Tests pass (`npm test -w packages/engine`)
- [ ] New tool: tests added in `test/ffmpeg/`
- [ ] New tool: schema added to `src/types/tools.ts`
- [ ] New tool: registered in worker, tools route, and MCP server
- [ ] New tool: documented in `docs/tools-reference.md`
- [ ] No breaking changes to existing tool input schemas (or version bump noted)
- [ ] `CONTRIBUTING.md` steps followed

## Testing

<!-- How did you test this? Include the commands you ran. -->

```bash
DATABASE_URL=postgres://postgres:clipchat@localhost:5432/clipchat \
REDIS_URL=redis://localhost:6379 \
npm test -w packages/engine
```

## Related issues

<!-- Closes #123 -->
