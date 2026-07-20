import type { MeetingMessage, InterviewConfig } from '../store/interviewStore'

/**
 * 滑动窗口策略：获取最近的消息
 * @param messages 所有消息
 * @param timeWindow 时间窗口（毫秒，默认30秒）
 * @param countWindow 消息数量窗口（默认30条）
 * @returns 最近的消息数组
 */
export const getRecentMessages = (
  messages: MeetingMessage[],
  timeWindow = 30000,
  countWindow = 30
): MeetingMessage[] => {
  const now = Date.now()
  const timeFiltered = messages.filter(m => now - m.timestamp <= timeWindow)
  const countFiltered = messages.slice(-countWindow)

  // 取两个条件的交集，选择更小的集合
  return timeFiltered.length <= countFiltered.length ? timeFiltered : countFiltered
}

/**
 * 构建面试场景化的系统提示词
 * @param config 面试配置（岗位、语言等）
 * @returns 定制化的系统提示词
 */
export const buildInterviewSystemPrompt = (config?: InterviewConfig): string => {
  const job = config?.job || '技术'
  const lang = config?.lang || '中文'
  const region = config?.region || '简体中文'

  return `# 角色定义
你是一个专业的AI面试助手，正在帮助候选人参加一场**${job}**岗位的真实面试。

## 你的任务
- 根据面试官的问题，**以候选人的身份**给出专业、准确、简洁的回答
- 回答语言：${lang}
- 回答风格：${region}习惯，自然流畅，像真人在说话（不要太书面化）

## 关键行为准则
1. **直接回答问题**：不要做"问题检测"，直接给出答案。如果消息内容是一个面试问题，就回答它。
2. **第一人称回答**：用"我"的口吻，模拟候选人在现场作答。
3. **技术问题深入**：如果是技术问题，给出有深度的解释（核心概念 + 实际应用 + 可能的坑）。
4. **行为问题结构化**：如果是行为问题（"你遇到过什么困难"），用 STAR 法则（情境-任务-行动-结果）。
5. **不知道就诚实说**：如果问题涉及你不了解的具体内部信息，诚实表达并给出通用最佳实践。

## 语音识别容错规则（重要）
由于输入来自实时语音转写，可能包含以下错误，你需要智能纠正：
1. **同音词纠错**：如"避包"→"闭包"，"JS"→"JavaScript"，"react"→"React"
2. **碎片拼接**：语音转写可能把一个句子拆成多段，根据语义合并理解
3. **角色混淆忽略**：标记的角色（user/asker）可能不准确，重点关注内容语义
4. **标点容错**：问号可能被识别为句号，根据语义判断是否为疑问句

## 回答长度
- 简单定义类问题：2-4句话
- 深入技术问题：4-8句话（概念+原理+实践）
- 行为类问题：6-10句话（STAR结构）

## 格式要求
- 使用 Markdown 格式，关键术语加粗
- 代码示例使用 \`\`\` 代码块
- 如果有多个要点，使用有序列表`
}

/**
 * 为DeepSeek API准备消息，优化KV Cache命中率
 * @param messages 所有消息
 * @returns 准备好的AI消息和新消息ID列表
 */
export const prepareMessagesForAI = (messages: MeetingMessage[], config?: InterviewConfig) => {
  const recentMessages = getRecentMessages(messages)

  // 分离已问过的和新的消息
  const askedMessages = recentMessages.filter(m => m.isAsked)
  const newMessages = recentMessages.filter(m => !m.isAsked)

  // 如果没有新消息，直接返回
  if (newMessages.length === 0) {
    return { aiMessages: [], newMessageIds: [] }
  }

  // 构建面试场景化的 system prompt
  const systemPrompt = buildInterviewSystemPrompt(config)

  // 构建稳定的前缀（system prompt + 历史消息）
  const stablePrefix = [
    {
      role: 'system' as const,
      content: systemPrompt
    }
  ]
  
  // 已处理的历史消息作为稳定前缀（按时间戳排序保持稳定）
  const sortedAskedMessages = askedMessages
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(m => ({
      role: m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: `[历史] ${m.content}`
    }))
  
  // 新消息追加在后面（按时间戳排序）
  const sortedNewMessages = newMessages
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(m => ({
      role: m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: `[新消息] ${m.content}`
    }))
  
  // 为了最大化缓存命中，保持稳定的消息结构
  const aiMessages = [
    ...stablePrefix,
    ...sortedAskedMessages,
    ...sortedNewMessages
  ]
  
  return {
    aiMessages,
    newMessageIds: newMessages.map(m => m.id)
  }
}

// 全局状态：追踪静音持续时间
let lastAudioActiveTime = Date.now()
let silenceStartTime: number | null = null

/**
 * 更新音频活跃状态并追踪静音时间
 * @param audioActive 当前音频是否活跃
 */
export const updateAudioActiveState = (audioActive: boolean) => {
  const now = Date.now()
  
  if (audioActive) {
    // 有声音，重置静音追踪
    lastAudioActiveTime = now
    silenceStartTime = null
  } else {
    // 无声音，开始或继续追踪静音
    if (silenceStartTime === null) {
      silenceStartTime = now
    }
  }
}

/**
 * 检查是否应该触发AI问题检测
 * @param lastDataTime 最后收到数据的时间
 * @returns 是否应该触发
 */
export const shouldTriggerQuestionDetection = (lastDataTime: number): boolean => {
  // 注意：具体的触发条件已经在预检查和主动检查中实现
  // 如果调用到这里，说明已经满足了触发条件
  // 这里保留作为统一的检查入口，未来可以添加其他条件
  
  // TODO: 未来可以在这里添加其他触发条件，例如：
  // - 关键词检测
  // - 语义分析
  // - 用户自定义规则
  
  return true // 直接返回true，因为调用时已经过滤了条件
}

/**
 * 防抖处理类
 */
export class QuestionDetectionDebouncer {
  private timer: number | null = null
  private readonly delay: number
  
  constructor(delay = 500) {
    this.delay = delay
  }
  
  /**
   * 防抖执行函数
   * @param callback 要执行的回调函数
   */
  debounce(callback: () => void): void {
    if (this.timer) {
      clearTimeout(this.timer)
    }
    
    this.timer = window.setTimeout(() => {
      callback()
      this.timer = null
    }, this.delay)
  }
  
  /**
   * 取消待执行的防抖
   */
  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
  
  /**
   * 清理资源
   */
  destroy(): void {
    this.cancel()
  }
}