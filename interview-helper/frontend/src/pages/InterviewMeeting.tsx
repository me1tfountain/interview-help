import React, { useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInterviewStore } from '@/store/interviewStore'
import { createRtasrWebSocket, parseRtasrResult, setAudioActiveState, cleanupQuestionDetection } from '@/api/xfyunRtasr'
import { isAudioActive } from '@/utils/voiceIdentifier'
import { handleQuestionDetected } from '@/api/deepseek'
import { useAudioCapture, type AudioSourceType } from '@/hooks/useAudioCapture'
import ReactMarkdown from 'react-markdown'
import { Radio, message as antdMessage } from 'antd'

const InterviewMeeting: React.FC = () => {
  const navigate = useNavigate()
  const addTransResult = useInterviewStore(s => s.addTransResult)
  const addMessage = useInterviewStore(s => s.addMessage)
  const messages = useInterviewStore(s => s.messages)
  const answers = useInterviewStore(s => s.answers)
  const createNewSession = useInterviewStore(s => s.createNewSession)

  const [recording, setRecording] = useState(false)
  const [audioActive, setAudioActive] = useState(false)
  const [audioSource, setAudioSource] = useState<AudioSourceType>('mic')
  const [inputValue, setInputValue] = useState('')
  const [reconnectInfo, setReconnectInfo] = useState<string | null>(null)

  const wsRef = useRef<ReturnType<typeof createRtasrWebSocket> | null>(null)
  const chatAreaRef = useRef<HTMLDivElement>(null)
  const voiceContentRef = useRef<HTMLDivElement>(null)

  // Audio capture hook
  const {
    startCapture,
    stopCapture,
    audioDevices,
    currentSourceType,
  } = useAudioCapture({
    sampleRate: 16000,
    frameSize: 1280,
    onFrameRecorded: ({ frameBuffer, isLastFrame }) => {
      const ws = wsRef.current
      if (!ws) return

      // Voice activity detection
      const active = isAudioActive(frameBuffer, 0.02)
      setAudioActive(active)
      setAudioActiveState(active)

      // Send audio to XFYUN
      if (ws.readyState === ws.OPEN) {
        ws.send(new Int8Array(frameBuffer))
        if (isLastFrame) {
          ws.send('{"end": true}')
        }
      }
    },
    onError: (err) => {
      antdMessage.error(`音频采集失败: ${err.message}`)
      console.error('Audio capture error:', err)
      setRecording(false)
    },
  })

  // Handle XFYUN transcription results
  const handleRtasrResult = useCallback((data: any) => {
    console.log('【data】', data)
    if (data.action === 'result') {
      if (data.code === '0') {
        const parsedData = typeof data.data === 'string' ? JSON.parse(data.data) : data.data
        addTransResult({
          action: data.action,
          code: data.code,
          data: parsedData,
          desc: data.desc,
          sid: data.sid,
        })
        const msgs = parseRtasrResult(parsedData, () => handleQuestionDetected())
        msgs.forEach(msg => {
          addMessage(msg)
          console.log('【MeetingMessage】', msg)
        })
      } else {
        console.error('【转写错误】', data.desc)
      }
    }
  }, [addTransResult, addMessage])

  // Start interview
  const handleStart = async () => {
    // Create backend session
    try {
      await createNewSession()
    } catch (err) {
      console.warn('Failed to create session on backend, continuing locally:', err)
    }

    setRecording(true)
    setReconnectInfo(null)

    // Create WebSocket (now with auto-reconnect)
    const ws = createRtasrWebSocket({
      onResult: handleRtasrResult,
      onError: () => {
        antdMessage.warning('语音转写连接异常')
      },
      onClose: () => {
        // onClose is called before reconnect attempt
      },
      onOpen: async () => {
        setReconnectInfo(null)
        // Start audio capture when WebSocket is ready
        if (!currentSourceType) {
          try {
            await startCapture(audioSource)
          } catch (err: any) {
            antdMessage.error(err.message || '音频采集启动失败')
            setRecording(false)
          }
        }
      },
      onReconnect: (attempt, max) => {
        setReconnectInfo(`语音服务重连中 (${attempt}/${max})...`)
      },
    })
    wsRef.current = ws
  }

  // Stop interview
  const handleStop = () => {
    setRecording(false)
    stopCapture()
    wsRef.current?.close()
    wsRef.current = null
    setReconnectInfo(null)
    cleanupQuestionDetection()
  }

  // Send manual text input
  const handleSendText = () => {
    const text = inputValue.trim()
    if (!text) return

    // Add as a message
    addMessage({
      content: text,
      role: 'asker', // treat manual input as interviewer question
      status: 'sent',
    })
    setInputValue('')

    // Trigger AI answer
    handleQuestionDetected()
  }

  // Handle Enter key
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendText()
    }
  }

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      cleanupQuestionDetection()
      stopCapture()
      wsRef.current?.close()
    }
  }, [stopCapture])

  // Auto-scroll
  React.useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight
    }
  }, [answers])

  React.useEffect(() => {
    if (voiceContentRef.current) {
      voiceContentRef.current.scrollTop = voiceContentRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Main content area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
        minHeight: 0
      }}>
        {/* Q/A panel — left */}
        <div
          ref={chatAreaRef}
          style={{
            flex: 1,
            padding: 24,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            minHeight: 0
          }}
        >
          {answers.length > 0 ? answers.map((ans, idx) => (
            <div key={ans.id || idx} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 24,
              minHeight: 'fit-content'
            }}>
              {/* Question — left */}
              <div style={{
                flex: 1,
                background: '#f5f5f5',
                borderRadius: 8,
                padding: 12,
                textAlign: 'left',
                maxWidth: '30%',
                minWidth: '200px'
              }}>
                <b>Q:</b> {ans.question}
              </div>
              {/* Answer — right */}
              <div style={{
                flex: 2,
                background: '#e6f7ff',
                borderRadius: 8,
                padding: 12,
                textAlign: 'left'
              }}>
                <b>A:</b> <ReactMarkdown>{ans.message}</ReactMarkdown>
              </div>
            </div>
          )) : (
            <div style={{
              fontSize: 32,
              color: '#eee',
              textAlign: 'center',
              margin: 'auto'
            }}>
              暂无问答
            </div>
          )}
        </div>

        {/* Transcription sidebar — right */}
        <div
          style={{
            width: 250,
            borderLeft: '1px solid #eee',
            padding: 16,
            overflowY: 'auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, color: '#666', flexShrink: 0 }}>实时转录</h3>
          <div ref={voiceContentRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {messages.map((msg, idx) => (
              <div key={msg.id || idx} style={{
                marginBottom: 8,
                background: msg.role === 'user' ? '#f0f8ff' : '#f5f5f5',
                borderRadius: 8,
                padding: 8,
                fontSize: 12,
                lineHeight: 1.4
              }}>
                <b style={{ color: msg.role === 'user' ? '#1677ff' : '#666' }}>
                  {msg.role === 'user' ? '用户' : '助手'}：
                </b>
                {msg.content}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom toolbar — fixed */}
      <div style={{
        borderTop: '1px solid #eee',
        padding: '12px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: '#fff',
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)',
        flexShrink: 0
      }}>
        {/* Audio source selector row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
          <span style={{ color: '#666' }}>音频源：</span>
          <Radio.Group
            value={audioSource}
            onChange={e => setAudioSource(e.target.value)}
            disabled={recording}
            size="small"
          >
            <Radio.Button value="mic">🎤 麦克风</Radio.Button>
            <Radio.Button value="system">🖥️ 系统音频</Radio.Button>
          </Radio.Group>
          {audioSource === 'system' && !recording && (
            <span style={{ color: '#faad14', fontSize: 12 }}>
              ⚠️ 将弹出共享对话框，请选择带有音频的标签页/窗口
            </span>
          )}
          {audioSource === 'mic' && audioDevices.length > 1 && !recording && (
            <select
              style={{ fontSize: 12, padding: '2px 8px' }}
              onChange={e => {
                // Store selected device for use in startCapture
                const deviceId = e.target.value
                if (deviceId) {
                  // We handle device selection via the startCapture call
                  // Store it for when recording starts
                  localStorage.setItem('preferredMicDevice', deviceId)
                }
              }}
              defaultValue={localStorage.getItem('preferredMicDevice') || ''}
            >
              <option value="">默认麦克风</option>
              {audioDevices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
              ))}
            </select>
          )}
          {reconnectInfo && (
            <span style={{ color: '#faad14', fontSize: 12, marginLeft: 'auto' }}>
              {reconnectInfo}
            </span>
          )}
        </div>

        {/* Text input + action row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, display: 'flex', gap: 8 }}>
            <input
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: 4,
                fontSize: 14,
              }}
              placeholder="输入你的问题（按 Enter 发送）"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
            />
            <button
              style={{
                padding: '8px 16px',
                border: '1px solid #d9d9d9',
                borderRadius: 4,
                background: '#1677ff',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
              }}
              onClick={handleSendText}
            >
              发送
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Recording status indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: recording ? (audioActive ? '#52c41a' : '#ff4d4f') : '#d9d9d9',
              }} />
              <span style={{ fontSize: 12, color: '#666' }}>
                {recording ? (audioActive ? '收录中' : '静音中') : '未录音'}
              </span>
            </div>

            <button
              style={{
                background: recording ? '#ff4d4f' : '#1677ff',
                color: '#fff',
                padding: '10px 20px',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
              }}
              onClick={recording ? handleStop : handleStart}
            >
              {recording ? '停止面试' : '开始面试'}
            </button>

            <button
              style={{
                padding: '10px 16px',
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                background: '#fff',
                cursor: 'pointer',
                fontSize: 14,
              }}
              onClick={() => navigate('/interview/new')}
            >
              返回设置
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InterviewMeeting
