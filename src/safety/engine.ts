import { evaluateRules } from './rules';
import { RESPONSES } from './responses';

function mapLabelToGrade(label: string): string {
  // 把 none, low, comfort 都放行，不拦截
  if (['critical', 'high', 'pending', 'dependency', 'third_party'].includes(label)) return label;
  return label; // 不再强制转 low，none 就是 none，comfort 就是 comfort
}

export function runSafetyLayer(text: string, sessionTags: Set<string>) {
  const ruleResult = evaluateRules(text, sessionTags);
  const grade = mapLabelToGrade(ruleResult.label);

  // 拦截名单中加入 third_party，移出 comfort
  const bypassLLM = ['critical', 'high', 'pending', 'dependency', 'third_party'].includes(grade);

  if (bypassLLM) {
    let reply = '';
    if (ruleResult.action === 'crisis_with_boundary') {
      reply = RESPONSES.critical + "\n\n" + RESPONSES.dependency;
    } else if (grade === 'critical') {
      reply = RESPONSES.critical;
    } else if (grade === 'high') {
      reply = RESPONSES.high;
    } else if (grade === 'dependency') {
      reply = RESPONSES.dependency;
    } else if (grade === 'third_party') {
      reply = RESPONSES.third_party; // 别忘了这个，之前你可能漏了
    } else if (grade === 'pending') {
      reply = "我听到你刚才说的了。我想多了解一点你现在的状态，可以问你几个问题吗？你刚才说的那些，有没有想过具体会怎么做？"; 
    }

    return { bypassLLM: true, grade, reply, action: ruleResult.action };
  }

  // comfort 状态：虽然不是高危，但我们要利用静态话术去宽慰，不交给 LLM
  if (grade === 'comfort') {
      return { bypassLLM: true, grade, reply: RESPONSES.comfort, action: ruleResult.action };
  }

  // none 和 low 状态：放行给 LLM
  return { bypassLLM: false, grade, reply: null, action: ruleResult.action };
}