import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const searchCardSource = readFileSync(
  new URL('./SearchCard.vue', import.meta.url),
  'utf8',
);
const selectorSyntaxInputSource = readFileSync(
  new URL(
    '../../entities/selector/ui/SelectorSyntaxInput.vue',
    import.meta.url,
  ),
  'utf8',
);
const selectorTextSource = readFileSync(
  new URL('../../entities/selector/ui/SelectorText.vue', import.meta.url),
  'utf8',
);
const selectorLibraryPageSource = readFileSync(
  new URL('../selector-library/SelectorLibraryView.vue', import.meta.url),
  'utf8',
);
const selectorLibraryDialogSource = readFileSync(
  new URL('../selector-library/ui/SelectorLibraryDialog.vue', import.meta.url),
  'utf8',
);
const deviceActionDialogsSource = readFileSync(
  new URL('../device-control/DeviceActionDialogs.vue', import.meta.url),
  'utf8',
);
const searchResultListSource = readFileSync(
  new URL('./SearchResultList.vue', import.meta.url),
  'utf8',
);
const ruleComposerDialogSource = readFileSync(
  new URL('./RuleComposerDialog.vue', import.meta.url),
  'utf8',
);
const attrCardSource = readFileSync(
  new URL('./AttrCard.vue', import.meta.url),
  'utf8',
);

test(`搜索框的真实 textarea 与自动高度镜像继承相同字体`, () => {
  const inputTag = selectorSyntaxInputSource.match(/<NInput\b[\s\S]*?\/>/)?.[0];
  assert.ok(inputTag, `未找到搜索输入框`);
  assert.match(
    inputTag,
    /\bclass="gkd_code"/,
    `等宽字体必须设置在 NInput 根节点，供 textarea 和测量镜像共同继承`,
  );
  assert.doesNotMatch(
    inputTag,
    /inputProps[\s\S]*gkd_code/,
    `不能只给真实 textarea 设置等宽字体，否则软换行高度会少算`,
  );
});

test(`选择器语法错误高亮不会接管输入事件`, () => {
  assert.match(searchCardSource, /<SelectorSyntaxInput\b/);
  assert.match(selectorLibraryPageSource, /<SelectorSyntaxInput\b/);
  assert.match(selectorSyntaxInputSource, /inspectSelectorSyntax/);
  assert.match(selectorSyntaxInputSource, /pointer-events-none/);
  assert.match(selectorSyntaxInputSource, /aria-hidden="true"/);
  assert.match(selectorSyntaxInputSource, /addEventListener\('scroll'/);
});

test(`选择器库列表通过完整的 flex 高度链形成内部滚动`, () => {
  assert.match(
    selectorLibraryPageSource,
    /class="library-results min-h-0 min-w-0 flex-1 overflow-hidden"/,
  );
  assert.match(
    selectorLibraryPageSource,
    /contentClass="flex min-h-0 flex-col"/,
  );
  assert.match(
    selectorLibraryPageSource,
    /<NScrollbar class="library-list min-h-0 flex-1">/,
  );
  assert.doesNotMatch(selectorLibraryPageSource, /height:\s*calc\(/);
});

test(`选择器库列表使用语法高亮并为非法数据保留文本回退`, () => {
  assert.match(
    selectorLibraryPageSource,
    /import SelectorText from '@\/entities\/selector\/ui\/SelectorText\.vue'/,
  );
  assert.match(
    selectorLibraryPageSource,
    /<SelectorText :source="preset\.selector" \/>/,
  );
  assert.doesNotMatch(selectorLibraryPageSource, /highlightedSelectors/);
});

test(`选择器库弹窗列表使用语法高亮并为非法数据保留文本回退`, () => {
  assert.match(
    selectorLibraryDialogSource,
    /import SelectorText from '@\/entities\/selector\/ui\/SelectorText\.vue'/,
  );
  assert.match(
    selectorLibraryDialogSource,
    /<SelectorText :source="preset\.selector" \/>/,
  );
  assert.match(
    selectorLibraryDialogSource,
    /<SelectorText :source="initialSelector \|\| ''" \/>/,
  );
  assert.doesNotMatch(selectorLibraryDialogSource, /highlightedSelectors/);
});

test(`选择器库弹窗列表可以确认后删除单条选择器`, () => {
  assert.match(
    selectorLibraryDialogSource,
    /const removePreset = async \(preset: SelectorPreset\) =>/,
  );
  assert.match(
    selectorLibraryDialogSource,
    /selectorLibraryActions\.remove\(preset\.id\)/,
  );
  assert.match(
    selectorLibraryDialogSource,
    /<NPopconfirm @positiveClick="removePreset\(preset\)">/,
  );
  assert.match(
    selectorLibraryDialogSource,
    /:loading="removingPresetId == preset\.id"/,
  );
});

test(`使用选择器不等待使用次数写入，也不会污染后续弹窗会话`, () => {
  const usePresetStart =
    selectorLibraryDialogSource.indexOf('const usePreset =');
  const emitIndex = selectorLibraryDialogSource.indexOf(
    "emit('use', preset.selector)",
    usePresetStart,
  );
  const closeIndex = selectorLibraryDialogSource.indexOf(
    'closeDialog()',
    usePresetStart,
  );
  const markUsedIndex = selectorLibraryDialogSource.indexOf(
    'selectorLibraryActions.markUsed(preset.id)',
    usePresetStart,
  );
  assert.ok(usePresetStart >= 0);
  assert.ok(emitIndex > usePresetStart);
  assert.ok(closeIndex > emitIndex);
  assert.ok(markUsedIndex > closeIndex);
  assert.doesNotMatch(selectorLibraryDialogSource, /usingPresetId/);
});

test(`所有只读选择器文本统一通过可自行解析的高亮组件展示`, () => {
  assert.match(selectorTextSource, /inspectSelectorSyntax\(props\.source\)/);
  assert.match(
    selectorTextSource,
    /<span v-else class="SelectorText" whitespace-pre-wrap>/,
  );
  assert.match(attrCardSource, /<SelectorText :source="selectText" \/>/);
  assert.doesNotMatch(
    [
      selectorLibraryPageSource,
      selectorLibraryDialogSource,
      attrCardSource,
    ].join('\n'),
    /\{\{\s*(?:preset\.selector|initialSelector|selectText)\s*\}\}/,
  );
});

test(`选择器库编辑器始终显示应用和界面并自动推导范围`, () => {
  assert.match(selectorLibraryPageSource, /<NFormItem label="适用应用">/);
  assert.match(selectorLibraryPageSource, /placeholder="留空表示全局"/);
  assert.match(selectorLibraryPageSource, /<NFormItem label="适用界面">/);
  assert.match(
    selectorLibraryPageSource,
    /placeholder="留空表示该应用内全部界面"/,
  );
  assert.match(selectorLibraryPageSource, /inferSelectorPresetScope\(/);
  assert.doesNotMatch(selectorLibraryPageSource, /:options="scopeOptions"/);
});

test(`选择器库弹窗保持挂载以触发入场动画并在关闭时重置草稿`, () => {
  assert.doesNotMatch(searchCardSource, /selectorLibraryKey/);
  assert.doesNotMatch(deviceActionDialogsSource, /selectorLibraryKey/);
  assert.match(selectorLibraryDialogSource, /const resetDialogState = \(\) =>/);
  assert.match(
    selectorLibraryDialogSource,
    /const setDialogVisible = \(show: boolean\) =>/,
  );
  assert.match(selectorLibraryDialogSource, /@update:show="setDialogVisible"/);
  assert.match(selectorLibraryDialogSource, /@afterLeave="resetDialogState"/);
});

test(`规则编排器保持挂载以触发入场动画并在关闭时重置表单`, () => {
  const dialogTag = searchCardSource.match(
    /<RuleComposerDialog\b[\s\S]*?\/>/,
  )?.[0];
  assert.ok(dialogTag, `未找到规则编排器入口`);
  assert.match(dialogTag, /:show="ruleComposerShow"/);
  assert.doesNotMatch(dialogTag, /\bv-if=/);
  assert.doesNotMatch(dialogTag, /:key=/);
  assert.doesNotMatch(searchCardSource, /ruleComposerKey/);
  assert.match(ruleComposerDialogSource, /const resetDialogState = \(\) =>/);
  assert.match(ruleComposerDialogSource, /@afterLeave="resetDialogState"/);
});

test(`规则编排器生成结果使用固定高度的内部滚动文本区`, () => {
  const outputInput = ruleComposerDialogSource.match(
    /<NInput\s+\s*:value="output"[\s\S]*?\/>/,
  )?.[0];
  assert.ok(outputInput, `未找到规则编排器生成结果文本区`);
  assert.match(outputInput, /type="textarea"/);
  assert.match(outputInput, /:resizable="false"/);
  assert.match(outputInput, /class="h-340px gkd_code"/);
  assert.doesNotMatch(outputInput, /autosize/);
});

test(`收藏按钮根据当前快照范围切换空心和非黑色实心星标`, () => {
  assert.match(searchResultListSource, /collectSelectorPresetIdentities\(/);
  assert.match(searchResultListSource, /savedResultKeys/);
  assert.match(searchResultListSource, /'favorite-outline'/);
  assert.match(searchResultListSource, /'favorite'/);
  assert.match(searchResultListSource, /text-\[#f0a020\]/);
});
