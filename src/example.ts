import { WritingAISDK, SDKError, ERROR_CODES } from './index';

function printSection(title: string) {
  console.log('\n' + '='.repeat(72));
  console.log('  ' + title);
  console.log('='.repeat(72));
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
  console.log('\n🤖 WritingAISDK - 产品接入能力完善验证');
  console.log('包含：批量工作流 / 会话分支 / 质量控制参数 / 校验漏口修复');

  const sdk = new WritingAISDK({ provider: 'mock' });
  let pass = 0;
  let failCount = 0;

  // ============ A. 校验漏口修复 ============
  printSection('A. 校验漏口修复');

  printSubsection('A1. 段落扩写：空白要点（数组里含空字符串）直接报错');
  try {
    await sdk.expand.expand({ bulletPoints: ['要点1', '', '  '] });
    fail('空白要点未抛出错误');
    failCount++;
  } catch (e) {
    const err = e as SDKError;
    if (err.code === ERROR_CODES.EMPTY_BULLET_POINTS) {
      ok(`空白要点正确抛出 EMPTY_BULLET_POINTS: "${err.message}" ✓`);
      pass++;
    } else {
      fail(`错误 code 不匹配：${err.code}，期望 EMPTY_BULLET_POINTS`);
      failCount++;
    }
  }

  printSubsection('A2. 标题生成：传入空 styles 数组明确报错，不退回默认');
  try {
    await sdk.title.generate({ topic: '主题', styles: [] });
    fail('空 styles 数组未抛出错误');
    failCount++;
  } catch (e) {
    const err = e as SDKError;
    if (err.code === ERROR_CODES.INVALID_STYLES) {
      ok(`空 styles 数组正确抛出 INVALID_STYLES: "${err.message}" ✓`);
      pass++;
    } else {
      fail(`错误 code 不匹配：${err.code}，期望 INVALID_STYLES`);
      failCount++;
    }
  }

  // ============ B. 标题质量控制 ============
  printSection('B. 标题质量控制');

  printSubsection('B1. mustIncludeKeywords：每个标题必须包含关键词，SDK 自动修正');
  const titleRes = await sdk.title.generate({
    topic: '远程办公',
    count: 3,
    styles: ['formal', 'howto', 'list'],
    keywords: ['效率', '协作'],
    mustIncludeKeywords: true,
  });
  const allHaveKeyword = titleRes.titles.every(
    t => t.title.includes('效率') || t.title.includes('协作')
  );
  if (allHaveKeyword) {
    ok(`所有 3 个标题都包含关键词「效率/协作」 ✓`);
    pass++;
  } else {
    const missing = titleRes.titles.filter(t => !t.title.includes('效率') && !t.title.includes('协作'));
    fail(`有 ${missing.length} 个标题缺少关键词`);
    failCount++;
  }
  titleRes.titles.forEach(t => console.log(`     [${t.style}] ${t.title} | highlights: ${t.highlights.join('、')}`));

  printSubsection('B2. avoidExaggeration：自动移除「彻底、完美、100%」等夸张词');
  // 先用 mock 的 fallback，fallback 里已不含夸张词，验证不抛错即可
  try {
    const safeRes = await sdk.title.generate({
      topic: '知识管理',
      count: 2,
      avoidExaggeration: true,
    });
    const hasExaggeration = safeRes.titles.some(t =>
      ['彻底', '完美', '100%', '绝对', '最强'].some(w => t.title.includes(w))
    );
    if (!hasExaggeration) {
      ok(`2 个标题都不含夸张词汇 ✓`);
      pass++;
    } else {
      fail('有标题含夸张词汇');
      failCount++;
    }
  } catch (e) {
    fail(`avoidExaggeration 报错：${(e as Error).message}`);
    failCount++;
  }

  // ============ C. 段落扩写质量控制 ============
  printSection('C. 段落扩写质量控制');

  printSubsection('C1. minWords=150：不足时自动补字，所有版本达标');
  const expMin = await sdk.expand.expand({
    bulletPoints: ['习惯养成需要时间', '耐心比速度重要'],
    versions: 2,
    minWords: 150,
  });
  const minPass = expMin.expandedVersions.every(v => {
    const words = (v.content.match(/[\u4e00-\u9fa5]/g) || []).length + (v.content.match(/[a-zA-Z]+/g) || []).length;
    return words >= 150;
  });
  if (minPass) {
    ok(`2 个版本都达到 150 字要求 ✓`);
    pass++;
  } else {
    fail('有版本未达到字数下限');
    failCount++;
  }
  expMin.expandedVersions.forEach(v => {
    const w = (v.content.match(/[\u4e00-\u9fa5]/g) || []).length + (v.content.match(/[a-zA-Z]+/g) || []).length;
    console.log(`     v${v.version}（${v.style}）：约 ${w} 字，highlights: ${v.highlights.join('、')}`);
  });

  printSubsection('C2. minWords > maxWords 直接报错');
  try {
    await sdk.expand.expand({ bulletPoints: ['x'], minWords: 500, maxWords: 100 });
    fail('字数范围倒置未报错');
    failCount++;
  } catch (e) {
    const err = e as SDKError;
    if (err.code === ERROR_CODES.INVALID_WORD_RANGE) {
      ok(`字数倒置正确抛出 INVALID_WORD_RANGE: "${err.message}" ✓`);
      pass++;
    } else {
      fail(`错误 code 不匹配：${err.code}`);
      failCount++;
    }
  }

  // ============ D. 批量工作流 ============
  printSection('D. 批量工作流：部分失败不影响整体');

  printSubsection('D1. 4 个任务混排（含空主题、非法章节数），成功 2 个 + 失败 2 个，互不影响');
  const batchResult = await sdk.batch.run([
    { id: 'task-ok-1', type: 'topic', request: { topic: '远程办公效率' } },
    { id: 'task-fail-empty', type: 'topic', request: { topic: '' } },
    { id: 'task-ok-2', type: 'title', request: { topic: '知识管理', count: 2, styles: ['formal', 'howto'] } },
    { id: 'task-fail-chapter', type: 'outline', request: { topic: 'x', chapterCount: 999 } },
  ]);

  console.log(`     汇总：${batchResult.successCount} 成功 / ${batchResult.failedCount} 失败 / 共 ${batchResult.total}`);
  console.log(batchResult.summary.split('\n').map(l => '     ' + l).join('\n'));

  if (batchResult.total === 4 && batchResult.successCount === 2 && batchResult.failedCount === 2) {
    ok(`批量结果统计正确（2 成功 + 2 失败） ✓`);
    pass++;
  } else {
    fail(`批量结果统计错误：期望 2/2/4，实际 ${batchResult.successCount}/${batchResult.failedCount}/${batchResult.total}`);
    failCount++;
  }

  const ok1 = batchResult.results.find(r => r.id === 'task-ok-1');
  const ok2 = batchResult.results.find(r => r.id === 'task-ok-2');
  const failEmpty = batchResult.results.find(r => r.id === 'task-fail-empty');
  const failChapter = batchResult.results.find(r => r.id === 'task-fail-chapter');

  if (ok1?.status === 'success' && ok1.result && (ok1.result as { audiences?: unknown[] }).audiences) {
    ok(`task-ok-1（主题分析）：success ✓`);
    pass++;
  } else { fail('task-ok-1 失败'); failCount++; }

  if (ok2?.status === 'success' && ok2.result && (ok2.result as { titles?: unknown[] }).titles) {
    ok(`task-ok-2（标题生成）：success ✓`);
    pass++;
  } else { fail('task-ok-2 失败'); failCount++; }

  if (failEmpty?.status === 'failed' && failEmpty.errorCode === ERROR_CODES.EMPTY_TOPIC) {
    ok(`task-fail-empty：failed，错误码 EMPTY_TOPIC，用户友好提示："${failEmpty.userFriendlyError}" ✓`);
    pass++;
  } else {
    fail(`task-fail-empty 错误：${JSON.stringify({ status: failEmpty?.status, code: failEmpty?.errorCode })}`);
    failCount++;
  }

  if (failChapter?.status === 'failed' && failChapter.errorCode === ERROR_CODES.INVALID_CHAPTER_COUNT) {
    ok(`task-fail-chapter：failed，错误码 INVALID_CHAPTER_COUNT，用户友好提示："${failChapter.userFriendlyError}" ✓`);
    pass++;
  } else {
    fail(`task-fail-chapter 错误：${JSON.stringify({ status: failChapter?.status, code: failChapter?.errorCode })}`);
    failCount++;
  }

  // ============ E. 会话分支：从指定版本继续改，支持分支对比 ============
  printSection('E. 会话分支：从指定版本继续改稿 + 分支对比');

  const initialDraft = 'v1 初始内容：时间管理的核心是管理注意力。\n很多人误以为时间管理是做更多事。';
  const start = sdk.conversation.startConversation(initialDraft);
  const cid = start.conversationId;
  console.log(`     初始会话：${cid}，main 分支 v1`);

  printSubsection('E1. main 分支正常继续改稿（v1 → v2）');
  const v2 = await sdk.conversation.continueConversation({
    conversationId: cid,
    instruction: '帮我优化逻辑，让表述更清晰',
  });
  if (v2.currentVersion === 2 && v2.versions.find(v => v.version === 2)?.branchId === 'main') {
    ok(`main 分支 v2 创建成功 ✓`);
    pass++;
  } else {
    fail('main 分支 v2 创建异常');
    failCount++;
  }

  printSubsection('E2. 从 v1 另开分支「marketing」（baseVersion=1，branchId=marketing）');
  const vMarketing = await sdk.conversation.continueConversation({
    conversationId: cid,
    baseVersion: 1,
    branchId: 'marketing',
    instruction: '改成更具营销感的文案风格',
  });
  const marketingVersion = vMarketing.versions.find(v => v.branchId === 'marketing');
  if (marketingVersion && marketingVersion.parentVersion === 1 && marketingVersion.branchId === 'marketing') {
    ok(`marketing 分支创建成功，父版本 v1，当前 v${vMarketing.currentVersion} ✓`);
    pass++;
  } else {
    fail('marketing 分支创建异常');
    failCount++;
  }

  printSubsection('E3. listBranches 列出所有分支');
  const branches = sdk.conversation.listBranches(cid);
  console.log(`     分支列表：${branches.map(b => `${b.branchId}(${b.versionCount}个版本，最新v${b.latestVersion})`).join('、')}`);
  if (branches.length === 2 && branches.some(b => b.branchId === 'main') && branches.some(b => b.branchId === 'marketing')) {
    ok(`分支列表正确（main + marketing） ✓`);
    pass++;
  } else {
    fail('分支列表异常');
    failCount++;
  }

  printSubsection('E4. compareBranches 对比两个分支差异');
  const bc = sdk.conversation.compareBranches(cid);
  console.log(bc.userFriendlySummary.split('\n').map(l => '     ' + l).join('\n'));
  if (bc.commonBase === 1 && bc.branches.length === 2) {
    ok(`分支对比成功，共同基准 v${bc.commonBase} ✓`);
    pass++;
  } else {
    fail('分支对比异常');
    failCount++;
  }

  printSubsection('E5. 跨分支版本对比（v1 main vs v3 marketing）');
  const crossDiff = sdk.conversation.compareVersions(cid, 1, marketingVersion!.version);
  console.log(`     ${crossDiff.summary}`);
  ok(`跨分支版本对比调用成功，检测到 ${crossDiff.changes.length} 处变更 ✓`);
  pass++;

  // 清理
  sdk.conversation.deleteConversation(cid);

  // ============ F. 标题关键词控制收紧 ============
  printSection('F. 标题关键词控制收紧：空关键词报错 + 覆盖率统计');

  printSubsection('F1. mustIncludeKeywords=true 但 keywords 为空数组 → 必须抛 KEYWORD_MISSING');
  try {
    await sdk.title.generate({ topic: '远程办公', mustIncludeKeywords: true, keywords: [] });
    fail('mustIncludeKeywords=true+keywords=[] 未抛出错误');
    failCount++;
  } catch (e) {
    const err = e as SDKError;
    if (err.code === ERROR_CODES.KEYWORD_MISSING) {
      ok(`空关键词正确抛出 KEYWORD_MISSING: "${err.message}" ✓`);
      pass++;
    } else {
      fail(`错误 code 不匹配：${err.code}，期望 KEYWORD_MISSING`);
      failCount++;
    }
  }

  printSubsection('F2. mustIncludeKeywords=true 但 keywords 根本没传 → 也必须抛错');
  try {
    await sdk.title.generate({ topic: '远程办公', mustIncludeKeywords: true });
    fail('mustIncludeKeywords=true+keywords=undefined 未抛出错误');
    failCount++;
  } catch (e) {
    const err = e as SDKError;
    if (err.code === ERROR_CODES.KEYWORD_MISSING) {
      ok(`未传 keywords 正确抛出 KEYWORD_MISSING: "${err.message}" ✓`);
      pass++;
    } else {
      fail(`错误 code 不匹配：${err.code}，期望 KEYWORD_MISSING`);
      failCount++;
    }
  }

  printSubsection('F3. 多关键词：每标题命中至少 1 个 + 整批覆盖率统计 + 未覆盖关键词提示');
  const kwTitles = await sdk.title.generate({
    topic: '人工智能写作',
    count: 3,
    styles: ['catchy', 'formal', 'list'],
    keywords: ['效率', '创意', '原创'],
    mustIncludeKeywords: true,
  });
  const perTitleAllHit = kwTitles.keywordCoverage?.perTitleCoverage.every(x => x.matchedKeywords.length >= 1);
  const covered = kwTitles.keywordCoverage?.coveredKeywords || [];
  const missing = kwTitles.keywordCoverage?.missingKeywords || [];
  console.log(`     关键词覆盖率：${covered.length}/${kwTitles.keywordCoverage?.totalKeywords}，命中：${covered.join('、') || '无'}，未覆盖：${missing.join('、') || '无'}`);
  kwTitles.titles.forEach(t => console.log(`     [${t.style}] ${t.title}  命中关键词：${t.matchedKeywords.join('、') || '（无）'}`));
  if (perTitleAllHit && kwTitles.keywordCoverage) {
    ok(`每个标题至少命中 1 个关键词；覆盖率 ${kwTitles.keywordCoverage.coverageRate}；命中 ${covered.length} 个关键词 ✓`);
    pass++;
  } else {
    fail(`有标题未命中任何关键词或覆盖率未返回`);
    failCount++;
  }

  // ============ G. 会话多版本路线对比 ============
  printSection('G. 会话多版本路线对比：基准 + 主线 + 营销 + 学术');

  const initialDraft2 = 'v1 初稿：时间管理的核心是管理注意力。\n很多人误以为时间管理是做更多事，其实更重要的是把注意力放在真正重要的事上。';
  const start2 = sdk.conversation.startConversation(initialDraft2);
  const cid2 = start2.conversationId;
  console.log(`     初始会话：${cid2}，v1 基准稿`);

  printSubsection('G1. 先开主线 v2，再从 v1 开 marketing 分支和 academic 分支');
  const gMain = await sdk.conversation.continueConversation({
    conversationId: cid2,
    instruction: '主线通用润色，让表达更清晰自然',
  });
  const gMarketing = await sdk.conversation.continueConversation({
    conversationId: cid2,
    baseVersion: 1,
    branchId: 'marketing',
    instruction: '改成营销风格文案，突出卖点和行动号召',
  });
  const gAcademic = await sdk.conversation.continueConversation({
    conversationId: cid2,
    baseVersion: 1,
    branchId: 'academic',
    instruction: '改成学术论文风格，补充引用和研究数据',
  });
  console.log(`     主线最新 v${gMain.currentVersion}，marketing 最新 v${gMarketing.currentVersion}，academic 最新 v${gAcademic.currentVersion}`);

  printSubsection('G2. 三条路线 mock 内容必须可区分（不能全是同一句话）');
  const mainContent = gMain.versions.find(v => v.branchId === 'main' && v.version === 2)?.content || '';
  const marketingContent = gMarketing.versions.find(v => v.branchId === 'marketing')?.content || '';
  const academicContent = gAcademic.versions.find(v => v.branchId === 'academic')?.content || '';
  const allDifferent = mainContent !== marketingContent && marketingContent !== academicContent && mainContent !== academicContent;
  const hasMarketingTag = /营销风格润色|卖点|行动号召/.test(marketingContent);
  const hasAcademicTag = /学术风格润色|参考文献|Chen et al|r = 0/.test(academicContent);
  const hasMainTag = /主线通用润色|三步法|劳逸结合/.test(mainContent);
  console.log(`     主线含通用标签：${hasMainTag} | 营销含营销标签：${hasMarketingTag} | 学术含学术标签：${hasAcademicTag}`);
  if (allDifferent && hasMarketingTag && hasAcademicTag && hasMainTag) {
    ok('三条路线 mock 内容差异明显，且各有对应风格标签 ✓');
    pass++;
  } else {
    fail('三条路线内容区分度不够或缺少风格标签');
    failCount++;
  }

  printSubsection('G3. compareRoutes() 聚合对比：基准 + 主线 + 所有分支');
  const routeComp = sdk.conversation.compareRoutes(cid2, 1);
  console.log(routeComp.userFriendlySummary.split('\n').map(l => '     ' + l).join('\n'));
  const hasBase = routeComp.baseVersion === 1 && routeComp.baseContent.length > 0;
  const routeBranchIds = routeComp.routes.map(r => r.branchId).sort();
  const expectedBranches = ['academic', 'main', 'marketing'];
  const routesCovered = routeBranchIds.join() === expectedBranches.join();
  const hasCrossDiffs = routeComp.crossRouteDiffs.length >= 2;
  console.log(`     路线数量：${routeComp.routes.length}，分支：${routeBranchIds.join('、')}，横向 diff 数：${routeComp.crossRouteDiffs.length}`);
  routeComp.routes.forEach(r => console.log(`       · ${r.branchId} v${r.version}：${r.wordCount} 字，改动 ${r.keyChanges.length} 处，摘要 ${r.summary}`));
  if (hasBase && routesCovered && hasCrossDiffs) {
    ok('compareRoutes 返回基准稿 + 3 条路线 + 路线间横向差异 ✓');
    pass++;
  } else {
    fail(`compareRoutes 返回不完整：hasBase=${hasBase}, routesCovered=${routesCovered}, hasCrossDiffs=${hasCrossDiffs}`);
    failCount++;
  }

  sdk.conversation.deleteConversation(cid2);

  // ============ H. 按主题聚合的批量工作流 ============
  printSection('H. 按主题聚合的批量 pipeline：同主题三步串联，失败跳过依赖步骤');

  printSubsection('H1. 3 个主题（1 个空主题故意失败），验证部分跳过不影响其他主题');
  const themedResult = await sdk.batch.runThemed([
    { topic: '远程办公效率', chapterCount: 3, titleCount: 3, titleStyles: ['formal', 'howto', 'list'] },
    { topic: '', chapterCount: 2, titleCount: 2 },
    { topic: '人工智能写作', chapterCount: 4, titleCount: 3, titleStyles: ['catchy', 'formal', 'question'] },
  ]);

  console.log(themedResult.userFriendlyReport.split('\n').map(l => '     ' + l).join('\n'));
  console.log(`     汇总：共 ${themedResult.total}，成功 ${themedResult.successCount}，部分成功 ${themedResult.partialCount}，失败 ${themedResult.failedCount}`);

  const goodTopic = themedResult.topics.find(t => t.topic === '远程办公效率');
  const emptyTopic = themedResult.topics.find(t => t.topic === '');
  const aiTopic = themedResult.topics.find(t => t.topic === '人工智能写作');

  if (themedResult.total === 3 && themedResult.successCount === 2 && themedResult.partialCount === 0 && themedResult.failedCount === 1) {
    ok('批量 pipeline 统计正确（2 成功 / 1 失败） ✓');
    pass++;
  } else {
    fail(`批量 pipeline 统计异常：期望 2/0/1/3，实际 ${themedResult.successCount}/${themedResult.partialCount}/${themedResult.failedCount}/${themedResult.total}`);
    failCount++;
  }

  if (goodTopic?.status === 'success' && goodTopic.topicAnalysis && goodTopic.outline && goodTopic.titles) {
    ok(`主题「远程办公效率」三步全部成功：topic+outline+title 都有结果 ✓`);
    pass++;
  } else {
    fail(`主题「远程办公效率」状态异常：${goodTopic?.status}`);
    failCount++;
  }

  if (emptyTopic?.status === 'failed') {
    const topicStep = emptyTopic.results.topic;
    const outlineStep = emptyTopic.results.outline;
    const titleStep = emptyTopic.results.title;
    console.log(`     空主题：topic.status=${topicStep.status}(${topicStep.errorCode || ''})，outline.status=${outlineStep.status}(${outlineStep.skippedReason || ''})，title.status=${titleStep.status}(${titleStep.skippedReason || ''})`);
    const outlineSkipped = outlineStep.status === 'skipped' && /跳过/.test(outlineStep.skippedReason || '');
    const titleSkipped = titleStep.status === 'skipped' && /跳过/.test(titleStep.skippedReason || '');
    if (topicStep.status === 'failed' && outlineSkipped && titleSkipped) {
      ok(`空主题 topic 失败后，outline 和 title 都被正确跳过（附带跳过原因） ✓`);
      pass++;
    } else {
      fail(`空主题依赖跳过不完整：topic=${topicStep.status}, outline=${outlineStep.status}, title=${titleStep.status}`);
      failCount++;
    }
  } else {
    fail('空主题应该全部失败，但实际不是');
    failCount++;
  }

  if (aiTopic?.status === 'success' && aiTopic.titles?.keywordCoverage) {
    ok(`主题「人工智能写作」三步成功，标题返回了 keywordCoverage ✓`);
    pass++;
  } else {
    fail(`主题「人工智能写作」状态异常或缺少 keywordCoverage：${aiTopic?.status}`);
    failCount++;
  }

  // ============ 汇总 ============
  printSection(`测试汇总：${pass} 通过 / ${failCount} 失败 / 共 ${pass + failCount} 项`);
  if (failCount === 0) {
    console.log('\n🎉 所有新增能力和修复点验证通过！');
  } else {
    console.log(`\n⚠️  有 ${failCount} 项未通过`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ 运行出错:', err);
  process.exit(1);
});
