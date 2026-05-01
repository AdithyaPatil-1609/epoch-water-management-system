const fs = require("fs")

const NUM_ZONES = 25
const DAYS = 30
const READINGS_PER_DAY = 4

const HOURS = [0, 6, 12, 18]

function rand(min, max) {
  return Math.random() * (max - min) + min
}

function normalNoise(mean = 0, std = 5) {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function basePattern(hour) {
  if (hour === 6) return 1.2
  if (hour === 12) return 1.0
  if (hour === 18) return 1.4
  if (hour === 0) return 0.6
  return 1.0
}

function generateZone(zoneId, startDate) {
  const base = rand(80, 150)
  const data = []

  for (let d = 0; d < DAYS; d++) {
    for (let h of HOURS) {
      const ts = new Date(startDate.getTime() + d * 86400000 + h * 3600000)

      let consumption = base * basePattern(h) + normalNoise()
      consumption = Math.max(consumption, 5)

      data.push({
        zone: `Zone_${zoneId}`,
        timestamp: ts.toISOString(),
        consumption
      })
    }
  }

  return data
}

function injectAnomalies(data) {
  const n = data.length

  let idx = Math.floor(rand(0, n - 20))
  for (let i = idx; i < idx + 15; i++) {
    data[i].consumption *= (1 + (i - idx) * 0.1)
    data[i].anomaly = "leak"
  }

  idx = Math.floor(rand(0, n))
  data[idx].consumption *= 3
  data[idx].anomaly = "theft"

  idx = Math.floor(rand(0, n - 5))
  for (let i = idx; i < idx + 3; i++) {
    data[i].consumption = 0
    data[i].anomaly = "sensor_fault"
  }

  idx = Math.floor(rand(0, n))
  if (data[idx]) {
    data[idx].consumption *= 0.2 // Corrected typo here from consption to consumption
    data[idx].anomaly = "drop"
  }

  idx = Math.floor(rand(0, n - 3))
  for (let i = idx; i < idx + 2; i++) {
    data[i].consumption *= 2.5
    data[i].anomaly = "event_spike"
  }

  return data
}

function generateNetwork() {
  const edges = []

  for (let i = 1; i < NUM_ZONES; i++) {
    const parent = Math.floor(rand(0, i))
    edges.push({
      from: parent,
      to: i,
      capacity: rand(50, 150)
    })
  }

  return edges
}

function simulatePressure(zones, edges) {
  const pressure = {}

  for (let i = 0; i < NUM_ZONES; i++) {
    pressure[i] = rand(2.5, 5)
  }

  edges.forEach(edge => {
    const loss = rand(0.1, 0.5)
    pressure[edge.to] = Math.max(1.0, pressure[edge.from] - loss)
  })

  return pressure
}

function attachPressure(data, pressureMap) {
  return data.map(d => {
    const zoneId = parseInt(d.zone.split("_")[1])
    return {
      ...d,
      pressure: pressureMap[zoneId]
    }
  })
}

function main() {
  const startDate = new Date("2026-01-01")
  let allData = []

  for (let z = 0; z < NUM_ZONES; z++) {
    let zoneData = generateZone(z, startDate)

    if (z < 5) {
      zoneData = injectAnomalies(zoneData)
    }

    allData.push(...zoneData)
  }

  const network = generateNetwork()
  const pressureMap = simulatePressure(NUM_ZONES, network)
  allData = attachPressure(allData, pressureMap)

  fs.writeFileSync("water_data.json", JSON.stringify(allData, null, 2))
  fs.writeFileSync("network.json", JSON.stringify(network, null, 2))

  console.log("Generated:", allData.length, "records")
}

main()
