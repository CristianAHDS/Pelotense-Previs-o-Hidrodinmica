import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import StationChart from './StationChart.jsx'
import './App.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

const PIN_COORDS = [-52.226296, -31.764725]
const PIN_ZOOM = 10

const STATIONS = [
  {
    id: 1,
    nome: 'FURG - CCMAR',
    key: 'FURG_CCMAR',
    longitude: -52.10208,
    latitude: -32.02738,
    cota: 80,
    showCotaLine: true,
  },
  {
    id: 2,
    nome: 'São Lourenço do Sul',
    key: 'S_Lourenco',
    longitude: -51.96128,
    latitude: -31.36905,
    cota: 148,
    showCotaLine: true,
  },
  {
    id: 3,
    nome: 'Arambaré',
    key: 'Arambare',
    longitude: -51.49224,
    latitude: -30.90649,
    cota: 225,
    showCotaLine: false,
  },
  {
    id: 4,
    nome: 'São José do Norte',
    key: 'S_Jose_Norte',
    longitude: -52.04398,
    latitude: -32.0131,
    cota: 80,
    showCotaLine: true,
  },
  {
    id: 5,
    nome: 'Itapuã',
    key: 'Itapua',
    longitude: -51.05926,
    latitude: -30.38512,
    cota: 280,
    showCotaLine: false,
  },
  {
    id: 6,
    nome: 'Laranjal',
    key: 'Laranjal',
    longitude: -52.226296,
    latitude: -31.764725,
    cota: null,
    showCotaLine: false,
  },
]

const MAX_TIMESTEP = 95
const INTERVAL_MS = 2500

const COLOR_STOPS = [
  -0.5, '#440154',
  -0.25, '#443983',
  0, '#31688E',
  0.25, '#21908C',
  0.5, '#20A387',
  0.75, '#35B779',
  1, '#4EA53B',
  1.25, '#B4DE2C',
  1.5, '#FDE725',
  1.75, '#F8961E',
  2, '#DC2F02',
]

const LEGEND_STOPS = [-0.5, 0, 0.5, 1, 1.5, 2]

const timestepUrl = (step) =>
  `/data/nivel_timestep_${String(step).padStart(3, '0')}.geojson`

const formatDate = (geojson) => {
  const date = geojson?.date ?? geojson?.features?.[0]?.properties?.date
  const hour = geojson?.hour ?? geojson?.features?.[0]?.properties?.hour
  if (!date) return ''
  const [year, month, day] = date.split('-')
  const time = hour ? ` ${hour.substring(0, 5)}` : ''
  return `${day}/${month}/${year}${time}`
}

function App() {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const [timestep, setTimestep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [dateLabel, setDateLabel] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-51.5, -31.25],
      zoom: 6,
      accessToken: MAPBOX_TOKEN,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-left')

    const stationRoots = []

    map.on('load', () => {
      map.addSource('water-level', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        tolerance: 0,
        buffer: 64,
      })
      map.addLayer({
        id: 'water-level-layer',
        type: 'fill',
        source: 'water-level',
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'nivel'],
            ...COLOR_STOPS,
          ],
          'fill-opacity': 0.9,
          'fill-antialias': false,
        },
      })

      STATIONS.forEach((station) => {
        const markerEl = document.createElement('div')
        markerEl.className = 'pin-marker'

        const labelEl = document.createElement('div')
        labelEl.className = 'pin-label'
        labelEl.textContent = station.nome

        const dotEl = document.createElement('div')
        dotEl.className = 'pin-dot'

        markerEl.appendChild(labelEl)
        markerEl.appendChild(dotEl)

        const popupEl = document.createElement('div')
        popupEl.className = 'chart-popup'

        const popup = new mapboxgl.Popup({
          maxWidth: '920px',
          closeButton: true,
          offset: 20,
        })
          .setLngLat([station.longitude, station.latitude])
          .setDOMContent(popupEl)

        let chartRoot = null
        popup.on('open', () => {
          if (!chartRoot) {
            chartRoot = createRoot(popupEl)
            stationRoots.push(chartRoot)
          }
          chartRoot.render(<StationChart station={station} />)
        })

        new mapboxgl.Marker({ element: markerEl, anchor: 'bottom' })
          .setLngLat([station.longitude, station.latitude])
          .setPopup(popup)
          .addTo(map)
      })

      map.flyTo({ center: PIN_COORDS, zoom: PIN_ZOOM, essential: true })
    })

    mapRef.current = map

    return () => {
      stationRoots.forEach((root) => root.unmount())
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetch(timestepUrl(timestep), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Timestep ${timestep} indisponível`)
        return res.json()
      })
      .then((data) => {
        setDateLabel(formatDate(data))
        const source = mapRef.current?.getSource('water-level')
        if (source) source.setData(data)
        setError('')
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message)
      })
    return () => controller.abort()
  }, [timestep])

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setTimestep((t) => (t >= MAX_TIMESTEP ? 0 : t + 1))
    }, INTERVAL_MS)
    return () => clearInterval(id)
  }, [playing])

  return (
    <div className="map-screen">
      <div ref={containerRef} className="map-container" />

      <div className="top-right">
        <div className="logos logos-cix">
          <img
            src="https://hidrodinamica.ciex.org.br/logo1.png"
            alt="Logo institucional"
          />
          <img
            src="https://hidrodinamica.ciex.org.br/logo2.png"
            alt="Logo institucional"
          />
          <img
            src="https://hidrodinamica.ciex.org.br/logo3.png"
            alt="Logo institucional"
            className="no-filter"
          />
          <img
            src="https://hidrodinamica.ciex.org.br/logo4.png"
            alt="Logo institucional"
          />
          <img
            src="https://hidrodinamica.ciex.org.br/logo5.png"
            alt="Logo institucional"
          />
        </div>
        <div className="logos logos-imgs">
          <img
            src="https://i.imgur.com/7b4mC1L.png"
            alt="Logo institucional"
          />
          <img
            src="https://i.imgur.com/mfoPeJL.png"
            alt="Logo institucional"
          />
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="legend">
        <div className="legend-title">Nível (m)</div>
        <div
          className="legend-gradient"
          style={{
            background: `linear-gradient(to top, ${COLOR_STOPS.filter(
              (_, i) => i % 2 === 1,
            ).join(', ')})`,
          }}
        />
        <div className="legend-labels">
          {LEGEND_STOPS.map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>
      </div>

      <div className="controls">
        <button
          type="button"
          className="play-button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pausar' : 'Reproduzir'}
        >
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <input
          type="range"
          className="slider"
          min={0}
          max={MAX_TIMESTEP}
          step={1}
          value={timestep}
          onChange={(e) => setTimestep(Number(e.target.value))}
        />
        <span className="date-label">{dateLabel || 'Carregando…'}</span>
      </div>
    </div>
  )
}

export default App
