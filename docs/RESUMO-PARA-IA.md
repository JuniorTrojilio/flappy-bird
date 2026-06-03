# Resumo técnico do projeto — handoff para outra IA

Repositório: `flappy-bird` (GitHub: `JuniorTrojilio/flappy-bird`)  
Stack: **React 19 + Vite 6 + TypeScript + Tailwind 4 + Canvas 2D**  
Linguagem da UI/documentação voltada ao usuário: **português (BR)**.

---

## 1. Objetivo do produto

Jogo **Flappy Bird** no navegador com dois modos:

1. **Modo IA (treino)** — população de pássaros controlados por redes neurais; evolução por **algoritmo genético**; painel educativo mostra entradas, rede, pesos, progresso e evolução.
2. **Modo jogador** — humano joga com clique/Espaço; placar, medalhas, game over no estilo do HTML original.

Não há backend. Persistência em **`localStorage`**.

---

## 2. Arquitetura da rede neural

Configurável via painel (`src/lib/nn-config.ts`):

| Parâmetro | Valores | Default típico |
|-----------|---------|----------------|
| `inputMode` | `basic` (3 entradas) / `extended` (5) | `basic` |
| `hiddenSize` | 4, 6, 8, 12, 16 | 4 |
| `outputSize` | 1 (fixo) | 1 |
| `evalSeeds` | 1, 3, 5, 10 mapas/pássaro ao fim da geração | 5 |

Topologia: **entrada → oculta (sigmoid) → saída (sigmoid)**. Decisão: `output > 0.5` → bater asa.

Implementação: `src/lib/neural-network.ts` — pesos em `Float32Array`, índice `ih[i * hiddenSize + j]`.

### Entradas (`src/game/nn-inputs.ts`)

- `distancia_cano`: distância horizontal ao próximo cano / largura da tela
- `altura_passaro`: posição na fenda (0 topo, 1 base)
- `velocidade`: velocidade vertical normalizada
- Modo extended: `distancia_segundo`, `altura_segundo` (segundo cano à frente)

Todas relativas ao estado atual — **não memorizam layout fixo de canos**.

---

## 3. Motor do jogo (`src/game/game-engine.ts`)

Classe **`GameEngine`**:
- Canvas 288×512 (ver `constants.ts`)
- `PopulationMode` para N pássaros (default UI: 1)
- `displayNn` — rede do campeão usada para diagrama/painel
- Loop `requestAnimationFrame`: `runSimulationSteps` → `draw`

### Turbo de treino
- `gameSpeed` 1–10 (`MAX_GAME_SPEED = 10`)
- Acumulador `simAccumulator`: N passos de simulação por frame desenhado
- **Não altera** física por passo; só acelera relógio
- Modo jogador força ×1

### Removido: Ultraturbo (UT)
Havia rajada de ~24k passos sem desenho; substituído por botão **×15** (depois removido; máximo **×10**).

### Fim de geração (`onGenerationComplete` — async)
1. `generationEnding = true` (evita reentrância)
2. Mensagem UI se `evalSeeds > 1`: avaliando fitness
3. `await population.endGeneration()`
4. Hall of fame + `installHallOfFameChampion`
5. `startFreshRun()`
6. Atualiza `training.recorde`, `historico`, `lastGeneralizacao`
7. `saveTraining()` via `queueMicrotask`

### Recorde vs fitness (correção importante)
- **Tela / `bestScore` / `recorde` / `historico` / hall (score)** → melhor pontuação da **partida visível** (inteiros, `roundScore`)
- **Evolução genética** → ranking por **fitness** (média em `evalSeeds` partidas silenciosas quando > 1)
- `visualBestSnapshot` capturado **antes** do ranking por fitness (`snapshotOfBestScore` em `population-mode.ts`)

Motivo do bug relatado pelo usuário: recorde usava `fitnessBest` (média) que era menor que placar visual (ex. 38 na tela, 29 no recorde).

---

## 4. População e evolução

### `src/game/population-mode.ts`
- Arrays: `y`, `speed`, `alive`, `score`, `networks[]`
- `step(world, scaled, opts)` — física + forward + colisão por pássaro
- `endGeneration()` async:
  - `visualScores` da partida atual
  - `visualBestSnapshot`
  - `fitnessScores` via worker se `evalSeedCount > 1`
  - `captureRankedSnapshots(fitnessScores)` para evolução
  - `evolvePopulation` (`src/lib/population-evolution.ts`)

### `src/lib/population-evolution.ts`
- ~15% elites, filhos por mutação, ~5% imigrantes (redes novas)
- `n === 1`: mutação adaptativa (`mutateSoloBird`) conforme estagnação

### Hall of fame (`game-engine.ts`)
- `hallOfFameScore` + `hallOfFameSnapshot` — melhor genoma **visual** histórico
- Reinstalado como campeão a cada geração; mutação leve se 1 pássaro e hall ≥ 15

---

## 5. Fitness e performance

### `src/game/fitness-eval.ts`
- `runSilentEpisode(network, seed, cfg)` — simula até `MAX_FRAMES = 14_000`
- `averageFitnessAcrossSeeds` — média para generalização

### Worker
- `fitness.worker.ts` — avalia array de `NetworkSnapshot`
- `fitness-worker-client.ts` — Promise API; fallback para thread principal se Worker falhar

### Pausa no fim da geração
Custo dominante: `população × evalSeeds × frames` por rede. **Não é** `localStorage`. Worker reduz travamento da UI, não elimina tempo total.

GPU **não** utilizada (JS no main thread + Worker CPU). WebGPU exigiria reescrita.

---

## 6. Persistência (`src/lib/training-storage.ts`)

| Chave | Versão | Conteúdo |
|-------|--------|----------|
| `flappy-bird-nn-training` | `SAVE_VERSION = 3` | networks[], generation, historico, recorde, hall, inputMode, hiddenSize, evalSeeds |
| `flappy-bird-nn-prefs` | `PREFS_VERSION = 1` | preferências de arquitetura (sobrevive reload mesmo sem treino) |

`loadTrainingState` valida tamanhos de pesos com `snapshotMatchesArchitecture`.  
`clearTrainingState` remove chaves `flappy-bird*`.

---

## 7. Interface (`src/App.tsx`, `src/components/`)

Layout: coluna fixa canvas + `NeuralPanel` flex.

### Painel — blocos principais
- **Arquitetura & generalização** — `NetworkConfigPicker`
- **O que a IA vê** — `AiSensesBlock` (3 ou 5 sentidos conforme `inputMode`)
- **Decisão** — z, confiança, BATE/PARA
- **Pesos** — agregados por sentido; hall of fame em âmbar
- **Progresso** — `HistoryChart` + recorde
- **Rede neural** — `NetworkDiagram` SVG dinâmico (layout por `hiddenSize` / `inputSize`)
- **Evolução genética** — `EvolutionSection`

### Controles header
- Modo IA / Jogador
- População (input + Aplicar)
- Limpar treino (confirm + `clearTrainingState` + engine `clearTraining`)
- ×1, ×5, ×10
- Pausa

### Performance painel
`speed >= 5` → `slowSnapshot` a cada 2 frames para métricas pesadas; estado ao vivo para ×1.

---

## 8. Modo jogador

- `setPlayerMode(true)` → 1 pássaro, sem turbo
- `player-ui-sprites.ts`: medalhas em (73,181) no sprite 606×428 — tiers 10/20/30/40 bronze/silver/gold/platinum
- Coordenadas de medalha em `y:202` estavam erradas (quase vazio) — corrigido
- Game over sempre desenhado após morte (`playerShowGameOver`)

---

## 9. Histórico de desenvolvimento (commits relevantes)

| Commit | Conteúdo |
|--------|----------|
| `681a053` | Base React/Vite + evolução genética |
| `eb1737b` | Ultraturbo, hall of fame, medalhas, painel didático, fix limpar treino, fix turbo/painel, pesos hall, diagrama rede |
| `9774f55` | Arquitetura configurável (3/5 entradas, ocultos 4–16), fitness multi-seed, prefs localStorage v3, worker fitness |
| (este commit) | Remoção UT; recorde visual; worker; prefs reload; AiSensesBlock; docs; comentários nos arquivos |

### Bugs corrigidos na conversa
1. Medalhas invisíveis (coords + `drawPlayerMedal` após placar)
2. Limpar treino regravava estado (`clearTraining` sem `saveTraining` depois)
3. Painel “voltava” dados ao mudar velocidade (`slowSnapshot` stale)
4. Turbo alterava lógica por passo — corrigido para só acelerar frames
5. Barras do painel mudavam largura com texto — `MetricBar` flex fixo
6. Recorde < placar — fitness vs visual separados
7. Meio ponto na UI — `roundScore` / fitness arredondado

---

## 10. Mapa de arquivos (src)

```
src/
├── main.tsx
├── App.tsx
├── components/
│   ├── GameCanvas.tsx
│   ├── NeuralPanel.tsx
│   └── panel/
│       ├── AiSensesBlock.tsx
│       ├── EvolutionSection.tsx
│       ├── HistoryChart.tsx
│       ├── MetricBar.tsx
│       ├── NetworkConfigPicker.tsx
│       ├── NetworkDiagram.tsx
│       ├── PanelToasts.tsx
│       ├── PopulationInput.tsx
│       └── ProgressBlock.tsx
├── game/
│   ├── game-engine.ts      # loop, treino, hall, save
│   ├── population-mode.ts  # N pássaros, step, endGeneration
│   ├── fitness-eval.ts
│   ├── fitness.worker.ts
│   ├── fitness-worker-client.ts
│   ├── nn-inputs.ts
│   ├── collision.ts, constants.ts, bird-sprites.ts
│   └── player-ui-sprites.ts
└── lib/
    ├── neural-network.ts
    ├── nn-config.ts
    ├── panel-types.ts
    ├── training-storage.ts
    ├── score.ts
    └── utils.ts
```

---

## 11. Tipos centrais (`panel-types.ts`)

- `PanelState` — snapshot completo para UI (inputs, diagram, weights, progresso, arquitetura, generalizacao, campeaoHistorico…)
- `PanelUiEvents` — toasts, banner recorde, `backpropDeath` (nome legado = “evoluindo”), mensagens
- `PanelArquitetura`, `PanelGeneralizacao`, `PanelCampeaoHistorico`

---

## 12. Decisões de design para manter

1. **Generalização:** fitness multi-seed na evolução; recorde/histórico visual para o usuário.
2. **Mudança de arquitetura** (`applyNnConfig`): confirma e zera treino incompatível; prefs sempre salvas.
3. **1 pássaro default na UI** após restore (treino salvo pode ter N redes; resize para 1 com `preserveChampion`).
4. **Sem backprop real** — mensagens “Evoluindo” são genético, não gradiente.
5. **Pontuação** = canos passados (inteiro).

---

## 13. Extensões sugeridas (não implementadas)

- Fitness multi-seed só no top-K da população
- `MAX_FRAMES` menor em avaliação silenciosa
- Indicador de progresso % no worker
- Separar “recorde visual” e “recorde fitness” no painel explicitamente
- WebGPU / WASM para fitness (grande esforço)

---

## 14. Comandos

```bash
npm install
npm run dev      # http://localhost:5173 típico
npm run build    # dist/
```

Path alias: `@/` → `src/`.

---

## 15. Documentação para humanos

- [`GUIA-DO-CODIGO.md`](./GUIA-DO-CODIGO.md) — guia por pasta/arquivo, linguagem acessível

Cabeçalhos `/** … */` nos arquivos principais apontam para esse guia.

---

## 16. Contexto da conversa que gerou este estado

Pedidos do usuário ao longo do tempo:
- Medalhas game over, limpar localStorage de verdade
- Turbo visual sem alterar evolução por passo
- Explicar regressão da rede / estagnação
- Ultraturbo + hall of fame (sem garantia perfeita)
- Melhorar diagrama rede (rótulos, nós ativos)
- Pesos do campeão histórico no painel
- Generalização multi-seed + arquitetura configurável + prefs
- Remover ×15, manter até ×10
- Entradas 5 no painel “O que a IA vê”
- Recorde alinhado ao placar visual
- Explicar pausa no fim da geração (fitness)
- Documentação para adolescente + este resumo

---

*Última atualização: recorde visual, score inteiro, worker fitness, prefs `flappy-bird-nn-prefs`, sem ultraturbo.*
