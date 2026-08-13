import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  Area,
  Label,
} from 'recharts'

const toTimestamp = (s) => {
  if (!s) return null
  let t = s.includes(' ') ? s.replace(' ', 'T') : s
  t = t.replace(/Z$/, '').split('.')[0]
  const d = new Date(t)
  return isNaN(d.getTime()) ? null : d.getTime()
}

const renderTick = ({ x, y, payload }) => {
  const ts = payload?.value
  if (ts == null) return null
  const d = new Date(ts)
  if (isNaN(d.getTime())) return null
  const date = d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
  const time = d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <g transform={`translate(${x},${y + 7})`}>
      <text textAnchor="middle" fill="#cbd5e1" fontSize={14}>
        <tspan x="0" dy="10">
          {date}
        </tspan>
        <tspan x="0" dy="14" fontSize={12} fill="#cbd5e1">
          {time}
        </tspan>
      </text>
    </g>
  )
}

const ChartTooltip = ({ active, payload, label, mae, cota }) => {
  if (!active || !payload || payload.length === 0) return null
  const d = new Date(label)
  const dateStr = isNaN(d.getTime())
    ? label
    : d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
  const series = payload.filter(
    (p) =>
      !['previsaoMin', 'previsaoMax', 'faixaErro', 'cotaInundacao'].includes(
        p.dataKey,
      ),
  )
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 4,
        padding: '8px 12px',
        fontSize: 13,
      }}
    >
      <p style={{ margin: 0, fontWeight: 600 }}>Data: {dateStr}</p>
      {series.map((p) => (
        <p key={p.dataKey} style={{ margin: 0, color: p.color }}>
          {p.name}:{' '}
          {p.value != null && p.value !== undefined
            ? `${p.value} cm`
            : 'Ausente'}
        </p>
      ))}
      {cota != null && (
        <p style={{ margin: 0, color: '#4ade80', fontWeight: 400 }}>
          Cota de Inundação: {cota} cm
        </p>
      )}
      {mae != null && (
        <p style={{ margin: 0, color: '#999' }}>± {mae} cm de margem de erro</p>
      )}
    </div>
  )
}

function StationChart({ station }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [mae, setMae] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)

    Promise.all([
      fetch(`/data/observado_sensor_${station.key}.json`)
        .then((r) => r.json())
        .catch(() => []),
      fetch(`/data/time_serie_${station.key}.json`)
        .then((r) => r.json())
        .catch(() => []),
      fetch('/data/correcao_niveis.json')
        .then((r) => r.json())
        .catch(() => ({})),
    ])
      .then(([observado, timeSerie, correcao]) => {
        if (!active) return
        const maeRaw = correcao?.[station.key]?.mae_corrigido_cm
        const maeValue = maeRaw == null ? null : Number(maeRaw.toFixed(2))
        setMae(maeValue)

        const merged = {}
        observado.forEach((o) => {
          const ts = toTimestamp(o.data)
          if (ts) merged[ts] = { timestamp: ts, observado: o.valor, previsao: null }
        })
        timeSerie.forEach((o) => {
          const ts = toTimestamp(o.data)
          if (!ts) return
          const valor =
            o.valor != null && o.valor !== undefined
              ? Number((o.valor * 100).toFixed(1))
              : null
          if (merged[ts]) merged[ts].previsao = valor
          else merged[ts] = { timestamp: ts, observado: null, previsao: valor }
        })

        const rows = Object.values(merged)
          .sort((a, b) => a.timestamp - b.timestamp)
          .map((e) => {
            const hasPrev = e.previsao != null && e.previsao !== undefined
            const min =
              hasPrev && maeValue != null
                ? Number((e.previsao - maeValue).toFixed(1))
                : null
            const max =
              hasPrev && maeValue != null
                ? Number((e.previsao + maeValue).toFixed(1))
                : null
            return {
              ...e,
              faixaErro: min != null && max != null ? [min, max] : null,
              cotaInundacao: station.cota,
            }
          })

        setData(rows)
        setLoading(false)
      })
      .catch((err) => {
        if (active) {
          console.error(err)
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [station.key, station.cota])

  const yDomain = () => {
    const vals = data
      .flatMap((e) => {
        const arr = [e.observado, e.previsao]
        if (station.showCotaLine && station.cota != null) arr.push(station.cota)
        return arr
      })
      .filter((v) => v != null)
    if (vals.length === 0) return [0, 100]
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const pad = (max - min) * 0.15
    return [Math.floor((min - pad) / 5) * 5, Math.ceil((max + pad) / 5) * 5]
  }

  const legendPayload = [
    { value: 'Observado', type: 'circle', color: '#ff7300' },
    { value: 'Previsão', type: 'circle', color: '#60a5fa' },
    { value: 'Erro médio', type: 'rect', color: '#f8fafc' },
  ]
  if (station.cota != null) {
    legendPayload.push({
      value: `Cota de Inundação: ${station.cota} cm`,
      type: 'none',
      color: '#4ade80',
    })
  }

  return (
    <div className="chart-panel">
      <div className="modal-header">
        <span className="modal-station">{station.nome}</span>
        <span className="modal-subtitle">Previsão de Nível</span>
      </div>
      <div className="modal-body">
        {loading ? (
          <div className="modal-loading">Sincronizando séries temporais...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 10, right: 30, left: 5, bottom: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255, 255, 255, 0.15)"
              />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={['dataMin', 'dataMax']}
                interval={0}
                tickCount={12}
                tick={renderTick}
              />
              <YAxis
                tickCount={8}
                allowDecimals={false}
                allowDataOverflow
                domain={yDomain}
                tick={{ fill: '#cbd5e1', fontSize: 14 }}
              >
                <Label
                  value="Nível (cm)"
                  angle={-90}
                  position="insideLeft"
                  style={{
                    textAnchor: 'middle',
                    fill: '#cbd5e1',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                />
              </YAxis>
              <Tooltip content={<ChartTooltip mae={mae} cota={station.cota} />} />
              <Legend
                layout="horizontal"
                align="center"
                verticalAlign="top"
                iconType="circle"
                iconSize={10}
                formatter={(value) => (
                  <span style={{ color: '#f8fafc' }}>{value}</span>
                )}
                wrapperStyle={{
                  paddingBottom: 15,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#f8fafc',
                }}
                payload={legendPayload}
              />
              <Line
                type="monotone"
                dataKey="observado"
                name="Observado"
                stroke="#ff7300"
                strokeWidth={2.5}
                dot={false}
                connectNulls
              />
              <Line
                type="linear"
                dataKey="previsao"
                name="Previsão"
                stroke="#60a5fa"
                strokeWidth={2.5}
                dot={false}
                connectNulls
              />
              <Area
                type="monotone"
                dataKey="faixaErro"
                name="Erro médio"
                stroke="none"
                fill="#f8fafc"
                fillOpacity={0.3}
                legendType="rect"
                connectNulls
                isAnimationActive={false}
              />
              {station.showCotaLine && (
                <Line
                  type="linear"
                  dataKey="cotaInundacao"
                  name="Cota de Inundação"
                  stroke="#4ade80"
                  strokeWidth={2}
                  dot={false}
                  activeDot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

export default StationChart
