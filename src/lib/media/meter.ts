const FLOOR_DB = -60

const FFT_SIZE = 1024

export const levelOf = (samples: Float32Array) => {
  if (samples.length === 0) {
    return 0
  }

  let sum = 0

  for (const sample of samples) {
    sum += sample * sample
  }

  const decibels = 20 * Math.log10(Math.sqrt(sum / samples.length))

  return Math.min(Math.max((decibels - FLOOR_DB) / -FLOOR_DB, 0), 1)
}

export const openMeter = (
  stream: MediaStream,
  onLevel: (level: number) => void,
) => {
  const context = new AudioContext()
  const analyser = context.createAnalyser()
  const samples = new Float32Array(FFT_SIZE)
  let frame = 0

  analyser.fftSize = FFT_SIZE
  context.createMediaStreamSource(stream).connect(analyser)

  const tick = () => {
    analyser.getFloatTimeDomainData(samples)
    onLevel(levelOf(samples))
    frame = requestAnimationFrame(tick)
  }

  tick()

  return () => {
    cancelAnimationFrame(frame)
    void context.close()
  }
}
