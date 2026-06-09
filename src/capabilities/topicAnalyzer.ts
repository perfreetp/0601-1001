import { AIProvider, TopicAnalysisRequest, TopicAnalysisResult } from '../types';

const SYSTEM_PROMPT = `你是一位资深的内容策略分析师，擅长分析写作主题的受众、切入角度和关键词。
请严格按照 JSON 格式返回分析结果，格式如下：
{
  "audiences": [{ "name": string, "description": string, "characteristics": string[], "painPoints": string[] }],
  "angles": [{ "title": string, "description": string, "uniqueness": string, "suitability": string }],
  "keywords": { "primary": string[], "secondary": string[], "longTail": string[] },
  "summary": string
}
要求：audiences 返回 2-4 个，angles 返回 2-5 个，primary 关键词 5-8 个，secondary 8-12 个，longTail 5-8 个。`;

export class TopicAnalyzer {
  constructor(private provider: AIProvider) {}

  async analyze(req: TopicAnalysisRequest): Promise<TopicAnalysisResult> {
    const userPrompt = `请分析以下写作主题：

主题：${req.topic}
${req.context ? `补充背景：${req.context}` : ''}

请给出该主题的目标受众画像、切入角度建议，以及相关关键词。`;

    const response = await this.provider.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.7, responseFormat: 'json' }
    );

    return this.parseResponse(response);
  }

  private parseResponse(text: string): TopicAnalysisResult {
    try {
      return JSON.parse(text) as TopicAnalysisResult;
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as TopicAnalysisResult;
      }
      throw new Error('无法解析主题分析结果');
    }
  }
}
