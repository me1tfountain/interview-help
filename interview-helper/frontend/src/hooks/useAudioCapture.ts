import { useState, useRef, useCallback, useEffect } from 'react'

export type AudioSourceType = 'mic' | 'system'

export interface AudioDevice {
  deviceId: string
  label: string
  kind: string
}

interface UseAudioCaptureOptions {
  sampleRate?: number
  frameSize?: number
  processorPath?: string
  onFrameRecorded?: (data: { frameBuffer: ArrayBuffer; isLastFrame: boolean }) => void
  onError?: (error: Error) => void
}

interface UseAudioCaptureReturn {
  startCapture: (sourceType: AudioSourceType, deviceId?: string) => Promise<void>
  stopCapture: () => void
  isCapturing: boolean
  audioDevices: AudioDevice[]
  refreshDevices: () => Promise<void>
  currentSourceType: AudioSourceType | null
}

// Check if AudioWorklet is supported
const supportsAudioWorklet = (): boolean => {
  return typeof AudioWorkletNode !== 'undefined'
}

export function useAudioCapture(options: UseAudioCaptureOptions = {}): UseAudioCaptureReturn {
  const {
    sampleRate = 16000,
    frameSize = 1280,
    processorPath = '/xfyunRtasr',
    onFrameRecorded,
    onError,
  } = options

  const [isCapturing, setIsCapturing] = useState(false)
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([])
  const [currentSourceType, setCurrentSourceType] = useState<AudioSourceType | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const frameBufferRef = useRef<Float32Array[]>([])

  // Enumerate audio input devices
  const refreshDevices = useCallback(async () => {
    try {
      // Request permission first to get device labels
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        tempStream.getTracks().forEach(t => t.stop())
      } catch {
        // Permission denied — will get devices without labels
      }

      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs: AudioDevice[] = devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
          kind: d.kind,
        }))

      setAudioDevices(audioInputs)
    } catch (err) {
      console.error('Failed to enumerate devices:', err)
    }
  }, [])

  // Enumerate on mount
  useEffect(() => {
    refreshDevices()
    navigator.mediaDevices?.addEventListener('devicechange', refreshDevices)
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', refreshDevices)
    }
  }, [refreshDevices])

  // Get audio stream based on source type
  const getAudioStream = useCallback(async (
    sourceType: AudioSourceType,
    deviceId?: string
  ): Promise<MediaStream> => {
    if (sourceType === 'system') {
      // System audio capture via getDisplayMedia
      // This pops up a browser dialog for screen/window/tab selection
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          audio: true,
          video: true, // Required in most browsers to get audio
        })
        // Stop video tracks — we only need audio
        displayStream.getVideoTracks().forEach(track => track.stop())

        const audioTracks = displayStream.getAudioTracks()
        if (audioTracks.length === 0) {
          throw new Error(
            '未能获取系统音频。请确保在共享屏幕时勾选了"分享标签页音频"或"分享系统音频"。\n\n' +
            'Chrome浏览器：选择"Chrome标签页"并确保"分享标签页音频"已勾选。\n' +
            'Edge浏览器：选择"标签页"并确保"分享音频"已勾选。'
          )
        }
        return displayStream
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new Error('用户取消了屏幕共享')
        }
        throw err
      }
    }

    // Microphone capture
    const constraints: MediaStreamConstraints = {
      audio: deviceId
        ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true }
        : { echoCancellation: true, noiseSuppression: true },
      video: false,
    }
    return navigator.mediaDevices.getUserMedia(constraints)
  }, [])

  // Start capture
  const startCapture = useCallback(async (sourceType: AudioSourceType, deviceId?: string) => {
    try {
      // Get audio stream
      const stream = await getAudioStream(sourceType, deviceId)
      mediaStreamRef.current = stream
      setCurrentSourceType(sourceType)

      // Create AudioContext
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate,
      })
      audioContextRef.current = audioContext

      // Create source from stream
      const source = audioContext.createMediaStreamSource(stream)
      sourceNodeRef.current = source

      // Reset frame buffer
      frameBufferRef.current = []

      if (supportsAudioWorklet()) {
        // === AudioWorklet path (modern) ===
        await audioContext.audioWorklet.addModule(`${processorPath}/processor.worklet.js`)

        const workletNode = new AudioWorkletNode(audioContext, 'processor-worklet')
        workletNodeRef.current = workletNode

        workletNode.port.onmessage = (e) => {
          const data = e.data
          if (onFrameRecorded) {
            onFrameRecorded(data)
          }
        }

        workletNode.port.postMessage({
          type: 'init',
          data: {
            frameSize,
            toSampleRate: sampleRate,
            fromSampleRate: audioContext.sampleRate,
            arrayBufferType: 'short16',
          },
        })

        source.connect(workletNode)
        // No need to connect to destination — we don't want to play back
      } else {
        // === ScriptProcessor fallback (legacy) ===
        const worker = new Worker(`${processorPath}/processor.worker.js`)
        workerRef.current = worker

        worker.onmessage = (e) => {
          const data = e.data
          if (onFrameRecorded) {
            onFrameRecorded(data)
          }
        }

        worker.postMessage({
          type: 'init',
          data: {
            frameSize,
            toSampleRate: sampleRate,
            fromSampleRate: audioContext.sampleRate,
            arrayBufferType: 'short16',
          },
        })

        const scriptProcessor = audioContext.createScriptProcessor(0, 1, 1)
        scriptProcessorRef.current = scriptProcessor

        scriptProcessor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0)
          worker.postMessage({ type: 'message', data: inputData })
        }

        source.connect(scriptProcessor)
        scriptProcessor.connect(audioContext.destination)
      }

      await audioContext.resume()
      setIsCapturing(true)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      console.error('Audio capture failed:', error)
      onError?.(error)
      // Cleanup on failure
      stopCapture()
      throw error
    }
  }, [sampleRate, frameSize, processorPath, onFrameRecorded, onError, getAudioStream])

  // Stop capture
  const stopCapture = useCallback(() => {
    // Disconnect and clean up worklet
    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.port.postMessage({ type: 'stop' })
        workletNodeRef.current.disconnect()
      } catch { /* ignore */ }
      workletNodeRef.current = null
    }

    // Clean up script processor
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect()
      scriptProcessorRef.current = null
    }

    // Clean up worker
    if (workerRef.current) {
      try {
        workerRef.current.postMessage({ type: 'stop' })
        workerRef.current.terminate()
      } catch { /* ignore */ }
      workerRef.current = null
    }

    // Clean up source
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect()
      sourceNodeRef.current = null
    }

    // Stop all media tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }

    setIsCapturing(false)
    setCurrentSourceType(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCapture()
    }
  }, [stopCapture])

  return {
    startCapture,
    stopCapture,
    isCapturing,
    audioDevices,
    refreshDevices,
    currentSourceType,
  }
}
