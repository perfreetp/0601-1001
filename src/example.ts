import { WritingAISDK } from './index';

function printSection(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log('  ' + title);
  console.log('='.repeat(60));
}

function printSubsection(title: string) {
  console.log('\n--- ' + title + ' ---');
}

async function main() {
  console.log('\n🤖 AI 写作平台 SDK 使用示例');
  console.log('使用 Mock Provider 运行（无需 API Key）');

  const sdk = new WritingAISDK({ provider: 'mock' });

  // ============ 1. 主题分析 ============
  printSection('1. 主题分析');
  const topicResult = await sdk.topic.analyze({
    topic: '如何高效工作',
    context: '面向职场人士的深度长文',
  });
  printSubsection('目标受众');
  topicResult.audiences.forEach(a => {
    console.log(`  👤 ${a.name}: ${a.description}`);
    console.log(`     特征: ${a.characteristics.join('、')}`);
    console.log(`     痛点: ${a.painPoints.join('、')}`);
  });
  printSubsection('切入角度');
  topicResult.angles.forEach(a => {
    console.log(`  📐 ${a.title}`);
    console.log(`     ${a.description}`);
    console.log(`     独特性: ${a.uniqueness}`);
  });
  printSubsection('关键词');
  console.log(`  🔑 核心: ${topicResult.keywords.primary.join('、')}`);
  console.log(`  📎 次级: ${topicResult.keywords.secondary.join('、')}`);
  console.log(`  🎯 长尾: ${topicResult.keywords.longTail.join('、')}`);
  console.log(`\n  📝 总结: ${topicResult.summary}`);

  // ============ 2. 大纲生成 ============
  printSection('2. 大纲生成');
  const outlineResult = await sdk.outline.generate({
    topic: '如何高效工作',
    chapterCount: 5,
    tone: 'persuasive',
    length: 'medium',
    audience: '职场新人',
  });
  console.log(`  📖 标题: ${outlineResult.title}`);
  console.log(`  📝 引言: ${outlineResult.introduction}`);
  printSubsection('章节');
  outlineResult.chapters.forEach(ch => {
    console.log(`  ${ch.index}. ${ch.title}（${ch.estimatedLength}）`);
    console.log(`     目的: ${ch.purpose}`);
    console.log(`     要点: ${ch.keyPoints.join('；')}`);
  });
  console.log(`\n  🏁 结语: ${outlineResult.conclusion}`);
  console.log(`  📊 预估字数: ${outlineResult.totalEstimatedWords} 字`);
  console.log(`  💡 结构说明: ${outlineResult.structureNote}`);

  // ============ 3. 段落扩写 ============
  printSection('3. 段落扩写');
  const expandResult = await sdk.expand.expand({
    bulletPoints: [
      '习惯养成需要 66 天而非 21 天',
      '大脑神经通路重塑需要时间',
      '应该放下焦虑，关注每天的小进步',
    ],
    versions: 3,
    tone: 'objective',
  });
  expandResult.expandedVersions.forEach(v => {
    printSubsection(`版本 ${v.version}：${v.style}`);
    console.log(`  ${v.content}`);
    console.log(`  ✨ 亮点: ${v.highlights.join('、')}`);
  });
  printSubsection('选择建议');
  expandResult.recommendations.forEach(r => console.log(`  💡 ${r}`));

  // ============ 4. 润色能力 ============
  printSection('4. 润色能力');
  const polishResult = await sdk.polish.polish({
    text: '高效工作的核心不在于做更多的事，而在于做正确的事。许多人误以为忙碌就是 productive，实际上大部分忙碌只是在逃避真正重要的任务。',
    options: {
      fixTypos: true,
      removeRepetition: true,
      fixLogicJumps: true,
    },
  });
  console.log(`  ✏️ 润色后文本:\n  ${polishResult.polishedText}`);
  printSubsection('修改说明（用户友好）');
  polishResult.userFriendlyChanges.forEach(c => console.log(`  ${c}`));
  printSubsection('详细问题');
  console.log(`  📊 共 ${polishResult.summary.totalImprovements} 处改进`);
  console.log(`     错别字: ${polishResult.summary.typoCount}`);
  console.log(`     重复冗余: ${polishResult.summary.repetitionCount}`);
  console.log(`     逻辑修复: ${polishResult.summary.logicFixes}`);
  polishResult.issues.forEach(issue => {
    console.log(`  [${issue.type}] ${issue.severity}: "${issue.original}" → "${issue.suggestion}"`);
    console.log(`     原因: ${issue.reason}`);
  });

  // ============ 5. 标题能力 ============
  printSection('5. 标题生成');
  const titleResult = await sdk.title.generate({
    topic: '高效工作方法论',
    styles: ['catchy', 'howto', 'question', 'list', 'story'],
    count: 5,
    tone: 'persuasive',
  });
  titleResult.titles.forEach(t => {
    console.log(`  📌 ${t.title}`);
    console.log(`     风格: ${t.style} | 评分: ${t.suitabilityScore}/100`);
    console.log(`     亮点: ${t.highlights.join('、')}`);
    console.log(`     解读: ${t.explanation}`);
  });
  printSubsection('推荐');
  console.log(`  🏆 ${titleResult.recommendation}`);
  console.log(`  📚 ${titleResult.bestPractice}`);

  // ============ 6. 引用检查 ============
  printSection('6. 引用检查');
  const citationResult = await sdk.citation.check({
    text: '研究表明，番茄工作法能提高 30% 的工作效率。大多数成功人士都有早起的习惯。这个方法能彻底改变你的人生。所有人都应该尝试这个技巧。',
    strictness: 'moderate',
  });
  console.log(citationResult.userFriendlyReport);
  printSubsection('缺少来源');
  citationResult.missingSources.forEach(m => {
    console.log(`  ❓ [${m.impact}] ${m.claim}`);
    console.log(`     建议: ${m.suggestion}`);
  });
  printSubsection('夸大表述');
  citationResult.exaggerations.forEach(e => {
    console.log(`  ⚠️ "${e.original}" → "${e.alternative}"`);
    console.log(`     原因: ${e.reason}`);
  });

  // ============ 7. 会话能力 ============
  printSection('7. 会话能力');
  const initialDraft = '这是我的第一篇文章草稿，关于时间管理。我觉得时间管理很重要，但不知道怎么写。';
  const startResult = sdk.conversation.startConversation(initialDraft);
  console.log(`  🆔 会话ID: ${startResult.conversationId}`);
  console.log(`  📝 响应: ${startResult.response}`);
  startResult.userFriendlyChanges.forEach(c => console.log(`  ${c}`));
  console.log(`  📄 当前版本: v${startResult.currentVersion}`);

  printSubsection('继续改稿');
  const revisedContent = '这是我的第一篇文章草稿，关于时间管理。我觉得时间管理很重要，但不知道怎么写。时间管理就是管理自己的注意力。';
  const continueResult = await sdk.conversation.continueConversation({
    conversationId: startResult.conversationId,
    instruction: '帮我优化第三段的逻辑，让它更通顺',
    currentContent: revisedContent,
  });
  console.log(`  🤖 响应: ${continueResult.response}`);
  continueResult.userFriendlyChanges.forEach(c => console.log(`  ${c}`));
  console.log(`  📄 当前版本: v${continueResult.currentVersion}`);

  printSubsection('版本历史');
  const versions = sdk.conversation.getVersions(startResult.conversationId);
  versions.forEach(v => {
    console.log(`  v${v.version} (${new Date(v.timestamp).toLocaleTimeString()}): ${v.description}`);
    v.changes.forEach(c => console.log(`    - ${c}`));
  });

  printSubsection('版本对比 (v1 vs v2)');
  const diff = sdk.conversation.compareVersions(startResult.conversationId, 1, 2);
  console.log(`  ${diff.summary}`);
  diff.changes.forEach(c => {
    console.log(`  [${c.type}] ${c.explanation}`);
  });

  // 清理
  sdk.conversation.deleteConversation(startResult.conversationId);

  printSection('✅ 所有 7 组能力演示完成');
  console.log('\n提示: 将 config.provider 改为 "openai" 并配置 apiKey 即可接入真实模型');
}

main().catch(err => {
  console.error('❌ 运行出错:', err);
  process.exit(1);
});
