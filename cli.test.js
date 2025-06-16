import { execSync } from 'child_process';
import assert from 'assert';
import fs from 'fs';

// 測試下載 2313
execSync('rm -f data/twse_daily.sqlite');
execSync('npm run download -- 2020 2313', { stdio: 'inherit' });
assert(fs.existsSync('data/twse_daily.sqlite'), 'sqlite 檔案未建立');

// 測試分析 2313
const output = execSync('npm run ma -- 2313 2020 --explain=short').toString();
assert(/年化報酬率:/.test(output), 'ma 指令未輸出年化報酬率');
assert(/夏普值:/.test(output), 'ma 指令未輸出夏普值');
assert(/最大回撤:/.test(output), 'ma 指令未輸出最大回撤');
console.log('所有 CLI 測試通過');
