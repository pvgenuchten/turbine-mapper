import maplibregl from "maplibre-gl"
import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import * as MTP from "@dvt3d/maplibre-three-plugin"

// True size of this model ≈ 100m
const maplibreBackground = import.meta.env.VITE_MAPLIBRE_BACKGROUND
const turbineModel = import.meta.env.VITE_TURBINE_MODEL
const modelHeight = import.meta.env.VITE_TURBINE_MODEL_HEIGHT
const defaultHeight = import.meta.env.VITE_DEFAULT_HEIGHT
const defaultLon = import.meta.env.VITE_DEFAULT_LON
const defaultLat = import.meta.env.VITE_DEFAULT_LAT


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


function addTurbine(lon, lat, height) {
  if (!turbineTemplate) return alert("Model still loading…")

  const turbine = turbineTemplate.clone(true)

  const scale = height / modelHeight
  turbine.scale.setScalar(scale)

  const rtc = MTP.Creator.createRTCGroup([lon, lat])
  rtc.add(turbine)

  mapScene.addObject(rtc)
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


