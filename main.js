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

// See https://newt.phys.unsw.edu.au/jw/notes.html
const midiA4 = 69
const freqA4 = 440
const midiNoteToFrequency = (midiNote) => freqA4 * Math.pow(2, ((midiNote - midiA4) / 12))

const main = ({ api, midiAccess }) => {
  console.log('Ready')

  const carrier = api.createOsc('sine', 440, 0)
  const lfo = api.createOsc('sine', 440, 1000)
  const lfoMod = api.createOsc('sine', 5, 1)

  lfoMod.gain.connect(lfo.osc.frequency)
  lfo.gain.connect(carrier.osc.frequency)
  carrier.gain.connect(api.ctx.destination)

  let numKeysDown = 0

  midiAccess.inputs.forEach((input) => {
    input.onmidimessage = (event) => {
      const midiMessage = decodeMidiMessage(event)
      console.log('midiMessage', midiMessage)

      if (midiMessage.isDown()) {
        numKeysDown += 1
        carrier.gain.gain.value = velocityToGain(midiMessage.velocity)
        const freq = midiNoteToFrequency(midiMessage.note)
        console.log('freq', freq)

        carrier.osc.frequency.value = freq
        lfo.osc.frequency.value = (freq / 12) * 6
      } else if (midiMessage.isRelease()) {
        numKeysDown -= 1
        if (numKeysDown === 0) carrier.gain.gain.value = 0
      }
    }
  })
}

const appState = {}
promiseDomContentLoaded(appState)
  .then(initAudioApi)
  .then(initMidi)
  .then(main)
