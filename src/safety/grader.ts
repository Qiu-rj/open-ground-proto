// 把 rules.ts 的输出 label 映射到分级的四个状态
export function determineGrade(ruleLabel: string, matchedTags: string[]): string {
  switch (ruleLabel) {
    case 'critical':
      return 'critical';
    case 'dependency':
      return 'dependency';
    case 'pending':
      return 'pending';
    case 'negated':
    case 'third_party':
      return 'low';
    case 'high':
      return 'high';
    default:
      // 如果是单信号，根据具体标签微调
      if (matchedTags.includes('explicit_intent') || matchedTags.includes('farewell_signal')) {
        return 'high';
      }
      return 'low'; // passive_ideation 或 indirect_burden 单出时，走 low
  }
}