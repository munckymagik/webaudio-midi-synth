const createAudioApi = (ctx) => {
  const createOsc = (wave, freq, gainValue) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = wave
    osc.frequency.value = freq
    gain.gain.value = gainValue
    osc.connect(gain)
    osc.start(0)

    return {
      osc,
      gain
    }
  }

  return {
    createOsc,
    ctx
  }
}

const promiseDomContentLoaded = (state) =>
  new Promise((resolve, _reject) => addEventListener('DOMContentLoaded', resolve(state)))

const initAudioApi = (state) => {
  state.api = createAudioApi(new AudioContext());
  return state 
}

const initMidi = (state) => {
  return navigator.requestMIDIAccess().then(
    (midiAccess) => {
      state.midiAccess = midiAccess;
      return state
    }
  )
}

const decodeMidiMessage = ({ data }) => {
  return {
    cmd: data[0] >> 4,
    channel: data[0] & 0x0f,
    type: data[0] & 0xf0,
    note: data[1],
    velocity: data[2],
    isDown() {
      return this.type === 144
    },
    isRelease() {
      return this.type === 128
    }
  }
}

const rangeMapper = (inMin, inMax, outMin, outMax) => {
  const inRange = inMax - inMin
  const outRange = outMax - outMin
  return (inValue) => {
    return (outRange * (inValue / inRange)) + outMin
  }
}

const velocityToGain = rangeMapper(0, 127, 0, 1)

const main = ({ api, midiAccess }) => {
  console.log('Ready')

  const carrier = api.createOsc('sine', 440, 0)
  const lfo = api.createOsc('sine', 880, 300)

  lfo.gain.connect(carrier.osc.frequency)
  carrier.gain.connect(api.ctx.destination)

  midiAccess.inputs.forEach((input) => {
    input.onmidimessage = (event) => {
      const midiMessage = decodeMidiMessage(event)
      console.log('midiMessage', midiMessage)

      carrier.gain.gain.value =
        (midiMessage.isDown()) ? velocityToGain(midiMessage.velocity) : 0
    }
  })
}

const appState = {}
promiseDomContentLoaded(appState)
  .then(initAudioApi)
  .then(initMidi)
  .then(main)
