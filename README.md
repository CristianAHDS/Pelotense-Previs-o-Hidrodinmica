# Laranjal — Nível da Água (Monitoramento Hidrodinâmico)

Visualização do mapa de nível da água da região de Pelotas/Lagoa dos Patos, com foco na
**Praia do Laranjal**, recriada em React + Vite a partir dos dados públicos do sistema
**CIEX — Monitoramento Hidrodinâmico** (`https://hidrodinamica.ciex.org.br/`).

---

## Como os dados foram adquiridos

O site original é uma SPA (React + Redux + Mapbox GL JS). Ao inspecionar o bundle JavaScript
público, verificou-se que **todos os dados são arquivos estáticos (JSON/GeoJSON) servidos
na própria origem**, sob o caminho `/data/`. Nenhuma API ou autenticação é necessária —
basta fazer `fetch` nas URLs abaixo.

### Camada do mapa (nível da água)

| Recurso | Descrição |
| --- | --- |
| `/data/nivel_timestep_000.geojson` … `095` | Malha hidrodinâmica com o valor de nível por elemento. São **96 timesteps** (000 a 095), cada um com ~24 MB e ~107 mil polígonos. Propriedades: `nivel` (m), `elem_id`, além de `date`/`hour` no topo do GeoJSON. |

O mapa usa a camada `fill` do Mapbox com cor interpolada a partir da propriedade `nivel`,
na escala **viridis**:

| nivel (m) | cor |
| --- | --- |
| -0.5 | `#440154` |
| -0.25 | `#443983` |
| 0 | `#31688E` |
| 0.25 | `#21908C` |
| 0.5 | `#20A387` |
| 0.75 | `#35B779` |
| 1 | `#4EA53B` |
| 1.25 | `#B4DE2C` |
| 1.5 | `#FDE725` |
| 1.75 | `#F8961E` |
| 2 | `#DC2F02` |

A animação original avança 1 timestep a cada **2,5 s** (aqui desativada por padrão — autoplay
removido; o usuário controla pelo slider).

### Série temporal da estação (gráfico "Previsão de Nível")

| Recurso | Descrição |
| --- | --- |
| `/data/observado_sensor_Laranjal.json` | Array de `{ data, valor }` com os valores **observados** pelo sensor (em cm). |
| `/data/time_serie_Laranjal.json` | Array de `{ data, valor }` com a série **prevista** pelo modelo (em metros — multiplicada por 100 para virar cm). |
| `/data/correcao_niveis.json` | Objeto por estação com métricas de correção, ex.: `Laranjal.mae_corrigido_cm` (usado como margem de erro ±). |

O gráfico mescla as duas séries por timestamp, monta a **faixa de erro** (`previsão ± MAE`)
e exibe: `Observado` (laranja), `Previsão` (azul claro) e `Erro médio` (banda cinza).

### Token do Mapbox e estilo base

- Token público (extraído do bundle do site), configurado via variável de ambiente
  `VITE_MAPBOX_TOKEN` (ver `.env.example`). O token não é versionado.
- Estilo base: `mapbox://styles/mapbox/light-v11`
- Centro inicial: `[-51.5, -31.25]`, zoom 6; o app faz flyTo até a Praia do Laranjal (`[-52.226296, -31.764725]`, zoom 10).

### CORS e o proxy do Vite

O servidor **não envia** `Access-Control-Allow-Origin`, então o navegador bloquearia o
`fetch` de outra origem (ex.: `localhost:5173`). Para contornar, o Vite faz **proxy** de
`/data` para `https://hidrodinamica.ciex.org.br` (ver `vite.config.js`). Em produção, um
proxy reverso (ex.: nginx) deve replicar essa regra.

---

## Como rodar

```bash
npm install
npm run dev
```

Abrir o endereço exibido (ex.: `http://localhost:5173`).

> Se a porta 5173 estiver em uso: `npm run dev -- --port 5180`.

Build e lint:

```bash
npm run build
npm run lint
```

---

## Estrutura

```
vite.config.js        # proxy /data -> hidrodinamica.ciex.org.br
src/
  App.jsx             # mapa Mapbox, pin, timeline, legenda, logos e tooltip do gráfico
  StationChart.jsx    # gráfico recharts (Previsão de Nível) renderizado dentro do tooltip
  App.css             # glassmorphism e estilos da UI
  index.css           # reset e base
```

## Stack

- React 19 + Vite
- Mapbox GL JS
- Recharts
