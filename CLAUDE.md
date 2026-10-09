# Merge Merge Merge! — instruções para o Claude

**Em todo chat novo, ANTES de analisar a primeira mensagem do usuário, leia `docs/PROJECT_CONTEXT.md` por completo**
(arquitetura, integrações Poki/AUDS, build/deploy, armadilhas e regras de trabalho). Só depois responda ao pedido.
Um hook `SessionStart` (`.claude/settings.json`) já injeta esse arquivo em chats novos; se ele não aparecer no contexto, leia manualmente.

- Responda sempre em português.
- Sem commit/push sem pedido explícito (push em `main` publica no GitHub Pages).
- Ao concluir mudanças relevantes (feature, integração, armadilha nova), atualize `docs/PROJECT_CONTEXT.md`.
- `PokiService.devRewardBypass` deve permanecer só-PREVIEW; nunca true na build publicada.
- Commits e PRs devem ter **apenas a autoria do usuario**: nunca adicionar `Co-Authored-By: Claude` nem rodape de atribuicao ao Claude.
