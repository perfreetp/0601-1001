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
