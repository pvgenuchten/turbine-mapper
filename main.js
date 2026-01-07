import maplibregl from "maplibre-gl"
import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import * as MTP from "@dvt3d/maplibre-three-plugin"

import { kml } from "@tmcw/togeojson"
import JSZip from "jszip"



// True size of this model ≈ 100m
const maplibreBackground = import.meta.env.VITE_MAPLIBRE_BACKGROUND
const turbineModel = import.meta.env.VITE_TURBINE_MODEL
const MODEL_HEIGHT = import.meta.env.VITE_TURBINE_MODEL_HEIGHT
const defaultHeight = import.meta.env.VITE_DEFAULT_HEIGHT
const defaultLon = import.meta.env.VITE_DEFAULT_LON
const defaultLat = import.meta.env.VITE_DEFAULT_LAT
const turbines = [] // { id, lon, lat, height, rtc }

const map = new maplibregl.Map({
  container: "map",
  style: maplibreBackground,
  center: [defaultLon, defaultLat],
  zoom: 8,
  pitch: 65,
  bearing: 30,
  canvasContextAttributes: { antialias: true },
  maxPitch: 85
})

// Init MTP scene
const mapScene = new MTP.MapScene(map)

// Lights
mapScene.addLight(new THREE.AmbientLight(0xffffff, 1))
const sun = new THREE.DirectionalLight(0xffffff, 0.8)
sun.position.set(100, 200, 300)
mapScene.addLight(sun)

// Load GLB once and reuse
const loader = new GLTFLoader()
let turbineTemplate = null

loader.load(
  turbineModel,
  gltf => {
    turbineTemplate = gltf.scene,
    document.getElementById("height").value = defaultHeight,
    document.getElementById("lon").value = defaultLon,
    document.getElementById("lat").value = defaultLat
  }
)

function updateList() {
  const div = document.getElementById("list")
  div.innerHTML = ""

  turbines.forEach(t => {
    const row = document.createElement("div")
    row.style.display = "flex"
    row.style.alignItems = "center"
    row.style.justifyContent = "space-between"
    row.style.marginBottom = "4px"

    const label = document.createElement("span")
    label.textContent = `${t.lon.toFixed(4)}, ${t.lat.toFixed(4)} (${t.height}m)`
    label.style.flex = "1"

    // 🔍 Zoom button
    const zoomBtn = document.createElement("button")
    zoomBtn.textContent = "🔍"
    zoomBtn.title = "Zoom to turbine"
    zoomBtn.style.marginRight = "4px"
    zoomBtn.classList.add('mini')

    zoomBtn.onclick = () => {
      zoomToTurbine(t)
    }

    // ❌ Delete button
    const delBtn = document.createElement("button")
    delBtn.textContent = "❌"
    delBtn.classList.add('mini')

    delBtn.onclick = () => {
      mapScene.removeObject(t.rtc)
      turbines.splice(turbines.indexOf(t), 1)
      updateList()
      map.triggerRepaint()
    }

    row.appendChild(label)
    row.appendChild(zoomBtn)
    row.appendChild(delBtn)

    div.appendChild(row)
  })
}



let idCounter = 1

function addTurbine(lon, lat, height) {
  const turbine = turbineTemplate.clone(true)
  turbine.scale.setScalar(height / MODEL_HEIGHT)

  const rtc = MTP.Creator.createRTCGroup([lon, lat])
  rtc.add(turbine)
  mapScene.addObject(rtc)

  turbines.push({
    id: idCounter++,
    lon,
    lat,
    height,
    rtc
  })

  updateList()
  map.triggerRepaint()
}


let pickMode = false

document.getElementById("pick").onclick = () => {
  pickMode = true
  document.getElementById("pick").classList.add('active')
}

map.on("click", e => {
  if (!pickMode) return
  pickMode = false

  const { lng, lat } = e.lngLat
  document.getElementById("lon").value = lng
  document.getElementById("lat").value = lat
  document.getElementById("pick").classList.remove('active')
})

function zoomToTurbine(t) {
  map.easeTo({
    center: [t.lon, t.lat],
    zoom: 17,
    pitch: 65,
    bearing: 30,
    duration: 1200
  })
}

// UI
document.getElementById("add").onclick = () => {
  const lon = parseFloat(document.getElementById("lon").value)
  const lat = parseFloat(document.getElementById("lat").value)
  const height = parseFloat(document.getElementById("height").value)

  addTurbine(lon, lat, height)
  map.triggerRepaint()
  map.easeTo({
    center: [lon, lat],
    zoom: 15,        // adjust zoom as needed
    pitch: 65,       // adjust pitch for 3D view
    bearing: 30,     // optional rotation
    duration: 1500,  // milliseconds for smooth animation
  })
}



document.getElementById("export").onclick = async () => {
  const kml = `
  <kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
  ${turbines.map(t => `
    <Placemark>
      <name>${t.height}m turbine</name>
      <Point>
        <coordinates>${t.lon},${t.lat},0</coordinates>
      </Point>
    </Placemark>
  `).join("")}
  </Document>
  </kml>`

  const zip = new JSZip()
  zip.file("doc.kml", kml)

  const blob = await zip.generateAsync({ type: "blob" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = "turbines.kmz"
  a.click()
}

document.getElementById("import").onchange = async e => {
  const file = e.target.files[0]
  const zip = await JSZip.loadAsync(file)
  const text = await zip.file("doc.kml").async("string")

  const xml = new DOMParser().parseFromString(text, "text/xml")
  const geo = kml(xml)

  geo.features.forEach(f => {
    const [lon, lat] = f.geometry.coordinates
    addTurbine(lon, lat, 240)
  })
}