import maplibregl from "maplibre-gl"
import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import * as MTP from "@dvt3d/maplibre-three-plugin"

import { kml } from "@tmcw/togeojson"

// True size of this model ≈ 100m
const maplibreBackground = import.meta.env.VITE_MAPLIBRE_BACKGROUND
const turbineModel = import.meta.env.VITE_TURBINE_MODEL
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

let JSZipLib = null

async function getJSZip() {
  if (!JSZipLib) {
    const mod = await import("jszip")
    JSZipLib = mod.default
  }
  return JSZipLib
}


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
let turbineModelHeight = 1

loader.load(
  turbineModel,
  gltf => {
    turbineTemplate = gltf.scene
    document.getElementById("height").value = defaultHeight
    document.getElementById("lon").value = defaultLon
    document.getElementById("lat").value = defaultLat
    // Compute bounding box
    const box = new THREE.Box3().setFromObject(turbineTemplate)
    const size = new THREE.Vector3()
    box.getSize(size)
    turbineModelHeight = size.y   // true model height in meters
    console.log(turbineModelHeight)
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
  const scale = height / turbineModelHeight
  turbine.scale.setScalar(scale)
  turbine.position.y = height / 2

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
  await exportKMZ()
}

async function exportKMZ() {
  const JSZip = await getJSZip()
  const zip = new JSZip()

  // Load the DAE (must be in your public/assets folder)
  const dae = await fetch("./assets/wind_turbine.dae").then(r => r.arrayBuffer())
  zip.file("models/wind_turbine.dae", dae)

  const kml = `
  <kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
      ${turbines.map(t => {
        const scale = t.height / turbineModelHeight
        const baseOffset = t.height / 2
        return `
        <Placemark>
          <name>${t.height}m Turbine</name>
          <Model>
            <altitudeMode>relativeToGround</altitudeMode>
            <Location>
              <longitude>${t.lon}</longitude>
              <latitude>${t.lat}</latitude>
              <altitude>${baseOffset}</altitude>
            </Location>
            <Scale>
              <x>${scale}</x>
              <y>${scale}</y>
              <z>${scale}</z>
            </Scale>
            <Link>
              <href>models/wind_turbine.dae</href>
            </Link>
          </Model>
        </Placemark>
        `
      }).join("")}
    </Document>
  </kml>`

  zip.file("doc.kml", kml)

  const blob = await zip.generateAsync({ type: "blob" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = "turbines.kmz"
  a.click()
}


document.getElementById("import").onchange = async e => {
  const file = e.target.files[0]
  const JSZip = await getJSZip()
  const zip = await JSZip.loadAsync(file)
  // Find KML
  const kmlFile = Object.keys(zip.files).find(n => n.endsWith(".kml"))
  const kmlText = await zip.files[kmlFile].async("text")
  parseKMLModels(kmlText)
}

function parseKMLModels(kmlText) {
  const xml = new DOMParser().parseFromString(kmlText, "text/xml")

  const models = [...xml.querySelectorAll("Model")]
  var lastLoc = []
  models.forEach(model => {
    const lon = parseFloat(model.querySelector("longitude").textContent)
    const lat = parseFloat(model.querySelector("latitude").textContent)
    const alt = parseFloat(model.querySelector("altitude").textContent)

    const sx = parseFloat(model.querySelector("Scale > x").textContent)
    const sy = parseFloat(model.querySelector("Scale > y").textContent)
    const sz = parseFloat(model.querySelector("Scale > z").textContent)
    lastLoc = [lon, lat]
    // We encoded scale using height
    const height = sy * turbineModelHeight
    addTurbine(lon, lat, height)
  })
  map.easeTo({
    center: lastLoc,
    zoom: 15,        // adjust zoom as needed
    pitch: 65,       // adjust pitch for 3D view
    bearing: 30,     // optional rotation
    duration: 1500,  // milliseconds for smooth animation
  })
}
