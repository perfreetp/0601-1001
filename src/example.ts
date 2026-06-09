import { WritingAISDK, SDKError, ERROR_CODES } from './index';

function printSection(title: string) {
  console.log('\n' + '='.repeat(70));
  console.log('  ' + title);
  console.log('='.repeat(70));
}

function printSubsection(title: string) {
  console.log('\n--- ' + title + ' ---');
}

function ok(msg: string) {
  console.log(`  ✅ ${msg}`);
}

function fail(msg: string) {
  console.log(`  ❌ ${msg}`);
}

async function main() {
  console.log('\n🤖 AI 写作平台 SDK - 完善功能验证');
  console.log('使用 Mock Provider 运行（无需 API Key）');

  const sdk = new WritingAISDK({ provider: 'mock' });
  let pass = 0;
  let failCount = 0;

  // ============ 1. 大纲生成：严格对齐 chapterCount ============
  printSection('1. 大纲生成：chapterCount 参数严格对齐');

  for (const n of [2, 3, 7]) {
    const res = await sdk.outline.generate({ topic: '远程办公效率', chapterCount: n });
    if (res.chapters.length === n) {
      ok(`请求 ${n} 章，返回 ${res.chapters.length} 章 ✓`);
      pass++;
    } else {
      fail(`请求 ${n} 章，但返回 ${res.chapters.length} 章`);
      failCount++;
    }
    console.log(`     章节: ${res.chapters.map(c => `#${c.index}`).join(' ')}`);
  }

  // ============ 2. 段落扩写：versions 参数严格对齐 ============
  printSection('2. 段落扩写：versions 参数严格对齐');

  for (const n of [1, 2, 5]) {
    const res = await sdk.expand.expand({
      bulletPoints: ['习惯养成需要时间', '耐心很重要'],
      versions: n,
    });
    if (res.expandedVersions.length === n) {
      ok(`请求 ${n} 个版本，返回 ${res.expandedVersions.length} 个 ✓`);
      pass++;
    } else {
      fail(`请求 ${n} 个版本，但返回 ${res.expandedVersions.length} 个`);
      failCount++;
    }
    console.log(`     风格: ${res.expandedVersions.map(v => v.style).join('、')}`);
  }

  // ============ 3. 标题生成：count 和 styles 参数严格对齐 ============
  printSection('3. 标题生成：count 和 styles 参数严格对齐');

  const titleRes1 = await sdk.title.generate({ topic: '个人知识管理', styles: ['formal', 'howto'], count: 2 });
  const allStylesMatch = titleRes1.titles.every(t => ['formal', 'howto'].includes(t.style));
  if (titleRes1.titles.length === 2 && allStylesMatch) {
    ok(`请求 2 个 [formal/howto] 标题，返回 ${titleRes1.titles.length} 个且风格全部合规 ✓`);
    pass++;
  } else {
    fail(`返回 ${titleRes1.titles.length} 个标题，风格: ${titleRes1.titles.map(t => t.style).join('、')}`);
    failCount++;
  }
  titleRes1.titles.forEach(t => console.log(`     [${t.style}] ${t.title}`));

  const titleRes2 = await sdk.title.generate({ topic: '深度工作', count: 3 });
  if (titleRes2.titles.length === 3) {
    ok(`不指定 styles，仅指定 count=3，返回 ${titleRes2.titles.length} 个标题 ✓`);
    pass++;
  } else {
    fail(`期望 3 个标题，实际 ${titleRes2.titles.length} 个`);
    failCount++;
  }

  // ============ 4. 会话改稿：返回改写后的正文并保存为新版本 ============
  printSection('4. 会话改稿：返回 revisedContent，版本对比展示 AI 改写变化');

  const initialDraft = '时间管理就是管理自己的注意力。\n很多人误以为时间管理是做更多的事。\n但其实关键在于做正确的事。';
  const start = sdk.conversation.startConversation(initialDraft);
  ok(`会话已创建，v1 内容长度：${start.revisedContent.length} 字`);

  printSubsection('调用 continueConversation 改稿');
  const revised = await sdk.conversation.continueConversation({
    conversationId: start.conversationId,
    instruction: '帮我优化逻辑，增加案例',
    currentContent: initialDraft,
  });
  if (revised.revisedContent && revised.revisedContent.length > initialDraft.length) {
    ok(`v2 返回 revisedContent，长度 ${revised.revisedContent.length} 字（比原文多 ${revised.revisedContent.length - initialDraft.length} 字，AI 已补充内容）✓`);
    pass++;
  } else {
    fail('v2 未返回有效的 AI 改写内容');
    failCount++;
  }
  console.log(`     用户友好修改说明:`);
  revised.userFriendlyChanges.forEach(c => console.log(`       ${c}`));

  printSubsection('查看 v2 版本保存的 content（应该是 AI 改写后的内容，不是用户传入的原文）');
  const versions = sdk.conversation.getVersions(start.conversationId);
  const v2 = versions.find(v => v.version === 2);
  if (v2 && v2.content.length > initialDraft.length) {
    ok(`v2 版本已保存 AI 改写后的内容，长度 ${v2.content.length} 字 ✓`);
    pass++;
  } else {
    fail('v2 版本未正确保存 AI 改写内容');
    failCount++;
  }

  printSubsection('版本对比 v1 vs v2（应能看到 AI 的改稿差异）');
  const diff = sdk.conversation.compareVersions(start.conversationId, 1, 2);
  console.log(`     ${diff.summary}`);
  if (diff.changes.length > 0) {
    ok(`版本对比检测到 ${diff.changes.length} 处变更 ✓`);
    pass++;
  } else {
    fail('版本对比未检测到任何变更');
    failCount++;
  }
  diff.changes.slice(0, 3).forEach(c => console.log(`       [${c.type}] ${c.explanation}`));

  // ============ 5. 输入校验：明确的错误信息 ============
  printSection('5. 输入校验：明确报错（code + message）');

  printSubsection('空主题校验');
  try {
    await sdk.topic.analyze({ topic: '   ' });
    fail('空主题未抛出错误');
    failCount++;
  } catch (e) {
    const err = e as SDKError;
    if (err.code === ERROR_CODES.EMPTY_TOPIC) {
      ok(`空主题正确抛出 EMPTY_TOPIC: "${err.message}" ✓`);
      pass++;
    } else {
      fail(`错误 code 不匹配: ${err.code}`);
      failCount++;
    }
  }

  printSubsection('非法章节数校验');
  try {
    await sdk.outline.generate({ topic: 'x', chapterCount: 100 });
    fail('非法章节数未抛出错误');
    failCount++;
  } catch (e) {
    const err = e as SDKError;
    if (err.code === ERROR_CODES.INVALID_CHAPTER_COUNT) {
      ok(`100 章正确抛出 INVALID_CHAPTER_COUNT: "${err.message}" ✓`);
      pass++;
    } else {
      fail(`错误 code 不匹配: ${err.code}`);
      failCount++;
    }
  }

  printSubsection('空要点校验');
  try {
    await sdk.expand.expand({ bulletPoints: [] });
    fail('空要点未抛出错误');
    failCount++;
  } catch (e) {
    const err = e as SDKError;
    if (err.code === ERROR_CODES.EMPTY_BULLET_POINTS) {
      ok(`空要点正确抛出 EMPTY_BULLET_POINTS: "${err.message}" ✓`);
      pass++;
    } else {
      fail(`错误 code 不匹配: ${err.code}`);
      failCount++;
    }
  }

  printSubsection('空会话 ID 校验');
  try {
    await sdk.conversation.continueConversation({ conversationId: '', instruction: 'test' });
    fail('空会话 ID 未抛出错误');
    failCount++;
  } catch (e) {
    const err = e as SDKError;
    if (err.code === ERROR_CODES.EMPTY_CONVERSATION_ID) {
      ok(`空会话 ID 正确抛出 EMPTY_CONVERSATION_ID: "${err.message}" ✓`);
      pass++;
    } else {
      fail(`错误 code 不匹配: ${err.code}`);
      failCount++;
    }
  }

  printSubsection('不存在的会话校验');
  try {
    await sdk.conversation.continueConversation({ conversationId: 'conv_not_exist_123', instruction: 'test' });
    fail('不存在的会话未抛出错误');
    failCount++;
  } catch (e) {
    const err = e as SDKError;
    if (err.code === ERROR_CODES.CONVERSATION_NOT_FOUND) {
      ok(`不存在的会话正确抛出 CONVERSATION_NOT_FOUND: "${err.message}" ✓`);
      pass++;
    } else {
      fail(`错误 code 不匹配: ${err.code}`);
      failCount++;
    }
  }

  printSubsection('非法标题风格校验');
  try {
    await sdk.title.generate({ topic: 'x', styles: ['invalid_style' as any] });
    fail('非法标题风格未抛出错误');
    failCount++;
  } catch (e) {
    const err = e as SDKError;
    if (err.code === ERROR_CODES.INVALID_STYLES) {
      ok(`非法风格正确抛出 INVALID_STYLES: "${err.message}" ✓`);
      pass++;
    } else {
      fail(`错误 code 不匹配: ${err.code}`);
      failCount++;
    }
  }

  printSubsection('空润色文本校验');
  try {
    await sdk.polish.polish({ text: '' });
    fail('空润色文本未抛出错误');
    failCount++;
  } catch (e) {
    const err = e as SDKError;
    if (err.code === ERROR_CODES.EMPTY_TEXT) {
      ok(`空润色文本正确抛出 EMPTY_TEXT ✓`);
      pass++;
    } else {
      fail(`错误 code 不匹配: ${err.code}`);
      failCount++;
    }
  }

  // 清理
  sdk.conversation.deleteConversation(start.conversationId);

  // ============ 汇总 ============
  printSection(`测试汇总：${pass} 通过 / ${failCount} 失败 / 共 ${pass + failCount} 项`);
  if (failCount === 0) {
    console.log('\n🎉 所有验证点全部通过！');
  } else {
    console.log(`\n⚠️  有 ${failCount} 项未通过`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ 运行出错:', err);
  process.exit(1);
});
