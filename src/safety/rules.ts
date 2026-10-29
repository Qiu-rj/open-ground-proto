export interface RuleResult {
  label: 'critical' | 'high' | 'low' | 'pending' | 'dependency' | 'third_party' | 'comfort' | 'none';
  action: string;
}

function matchTriggers(text: string): string[] {
  const tags: string[] = [];
  
  // 意图词 (包含不想活这种肯定句)
  if (/想死|自杀|不想活|去死|寻死|不活|吞药|割腕|安眠药|跳楼|烧炭|上吊/.test(text)) {
    tags.push('explicit_intent');
  }
  
  // 方式词
  if (/吞药|安眠药|割腕|跳楼|烧炭|上吊/.test(text)) tags.push('method_mention');
  
  // 依赖信号
  if (/只有你|我只有你|只有你能理解|不需要其他人|比朋友更懂/.test(text)) tags.push('dependency_boundary');
  
  // 负担/被动
  if (/负担|没我更好|累赘|拖累|不醒来|睡着|消失了|活着没意思/.test(text)) tags.push('indirect_passive');

  return tags;
}

function isThirdParty(text: string): boolean {
  const thirdPartyIndicators = ['我朋友', '我同学', '我室友', '他最近', '她最近', '家人'];
  const isThird = thirdPartyIndicators.some(word => text.includes(word));
  // 关键防御：包含“我也”、“我也想”说明用户在投射自己，绝不能按第三方放走
  const isSelfInvolved = /我也觉得|我也想|我也陪|我也很/.test(text);
  return isThird && !isSelfInvolved;
}

// 极其严格的“安全否定”识别
function isSafeNegation(text: string): boolean {
  return /不想死|不想自杀|没想法了|不会死的|只是想想|没这个想法/.test(text);
}

// 极其严格的“过去时”识别（不能带现时威胁词）
function isPastOnly(text: string): boolean {
  const hasPast = /以前|之前|曾经|去年|小时候|刚才只是/.test(text);
  const hasNow = /现在|今晚|今天|马上|这就|正在/.test(text);
  return hasPast && !hasNow;
}

function hasImmediateThreat(text: string): boolean {
  return /现在|今晚|今天|马上|这就|攒好了|买好了|正在/.test(text);
}

export function evaluateRules(text: string, sessionTags: Set<string>): RuleResult {
  const matchedTags = matchTriggers(text);
  
  // 判断是否是“自我投射”（伪装被拆穿）
  const isSelfInvolved = /我也觉得|我也想|我也很/.test(text);

  // ==========================================
  // [第一层：安全缓冲（否定与宽慰）]
  // ==========================================
  // 1. 如果是否定/放弃念头（如“我不想死了”）
  if (matchedTags.length > 0 && isSafeNegation(text)) {
    // 但如果是“割腕、吞药”等具体行为且安全否定，说明是在回顾历史（用例8）
    if (matchedTags.includes('method_mention')) {
      return { label: 'comfort', action: 'comfort_past' };
    }
    // 如果只是单纯说“不想死”，直接放行给LLM（用例2）
    return { label: 'low', action: 'low_risk_with_resource' };
  }

  // 2. 如果纯粹是回顾过去，且明确没有现在想法
  if (matchedTags.length > 0 && isPastOnly(text)) {
    return { label: 'comfort', action: 'comfort_past' }; 
  }

  // ==========================================
  // [第二层：绝对斩杀（现时高危）]
  // ==========================================
  // 只要有方式，或者有意图且有紧迫感/自我卷入，直接判最高危（覆盖用例4、9）
  if (matchedTags.includes('method_mention') || 
     (matchedTags.includes('explicit_intent') && (hasImmediateThreat(text) || isSelfInvolved))) {
    return { label: 'critical', action: 'immediate_intervention' };
  }

  // ==========================================
  // [第三层：依赖边界、第三方、多信号]
  // ==========================================
  if (matchedTags.includes('dependency_boundary')) {
    if (matchedTags.includes('explicit_intent')) return { label: 'critical', action: 'crisis_with_boundary' };
    return { label: 'dependency', action: 'boundary_script' };
  }

  if (matchedTags.includes('explicit_intent') && isThirdParty(text)) {
    return { label: 'third_party', action: 'support_resource' };
  }

  matchedTags.forEach(tag => sessionTags.add(tag));
  if (sessionTags.size >= 2 || matchedTags.includes('indirect_passive')) {
    return { label: 'pending', action: 'assess_4_dimensions' };
  }
  
  if (matchedTags.includes('explicit_intent')) {
    return { label: 'high', action: 'static_response' };
  }

  // [兜底：正常放行]
  return { label: 'none', action: 'continue_chat' };
}