const fs = require('fs');
const path = require('path');

const projects = [
  { id: '00000139', name: '麓鸣府', folder: '麓鸣府_00000139' },
  { id: '00000129', name: '星都会', folder: '星都会_00000129' },
  { id: '00000136', name: '任城区Rrx_21006', folder: '任城区Rrx_21006钢材市场A地块商住项目（北区）_00000136' },
  { id: '00001312', name: '城投泽信和鸣天著', folder: '城投泽信和鸣天著_00001312' },
  { id: '00001267', name: '中玮名门', folder: '中玮名门_00001267' },
  { id: '00001303', name: '任城区Rrx_21006南区', folder: '任城区Rrx_21006钢材市场A地块商住项目（南区）_00001303' },
  { id: '00000145', name: '璟序', folder: '许庄片区JTB2025-002号宗地（璟序）项目_00000145' },
  { id: '00000132', name: '红瑞香树湾（二期）', folder: '红瑞香树湾（二期）_00000132' },
  { id: '00000150', name: '天空之镜', folder: '天空之镜_00000150' }
];

console.log('');
console.log('========================================');
console.log('  9个重点小区 销售情况汇总分析');
console.log('========================================');
console.log('');

projects.forEach(proj => {
  const projectDir = path.join(__dirname, 'output', proj.folder);
  if (!fs.existsSync(projectDir)) {
    console.log(`[${proj.name}] 数据目录不存在`);
    console.log('');
    return;
  }

  const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.json')).sort();
  if (files.length < 2) {
    console.log(`[${proj.name}] 数据不足，无法对比`);
    console.log('');
    return;
  }

  const latestFile = files[files.length - 1];
  const prevFile = files[files.length - 2];

  const latest = JSON.parse(fs.readFileSync(path.join(projectDir, latestFile), 'utf8'));
  const prev = JSON.parse(fs.readFileSync(path.join(projectDir, prevFile), 'utf8'));

  const latestDate = latestFile.match(/(\d{8})/)[1];
  const prevDate = prevFile.match(/(\d{8})/)[1];

  const s = latest.totalStats || latest.stats || {};
  const ps = prev.totalStats || prev.stats || {};

  const soldDiff = (s.已售 || 0) - (ps.已售 || 0);
  const signDiff = (s.签约中 || 0) - (ps.签约中 || 0);
  const availDiff = (s.可售 || 0) - (ps.可售 || 0);
  const total = s.total || 0;
  const soldRate = total > 0 ? ((s.已售 || 0) / total * 100).toFixed(1) : '0.0';

  console.log(`【${proj.name}】(${proj.id})`);
  console.log(`  总体: 总${total}套 | 已售${s.已售||0}(${soldRate}%) | 签约中${s.签约中||0} | 可售${s.可售||0}`);

  if (soldDiff !== 0 || signDiff !== 0) {
    console.log(`  变化: 已售${soldDiff > 0 ? '+' : ''}${soldDiff} | 签约中${signDiff > 0 ? '+' : ''}${signDiff} | 可售${availDiff > 0 ? '+' : ''}${availDiff}`);
  } else {
    console.log(`  变化: 无变化`);
  }
  console.log('');
});

console.log('========================================');
console.log('  各小区各楼栋详情');
console.log('========================================');
console.log('');

projects.forEach(proj => {
  const projectDir = path.join(__dirname, 'output', proj.folder);
  if (!fs.existsSync(projectDir)) return;

  const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.json')).sort();
  if (files.length === 0) return;

  const latestFile = files[files.length - 1];
  const latest = JSON.parse(fs.readFileSync(path.join(projectDir, latestFile), 'utf8'));
  const latestDate = latestFile.match(/(\d{8})/)[1];

  console.log(`【${proj.name}】(${latestDate})`);

  if (latest.buildings && latest.buildings.length > 0) {
    latest.buildings.forEach(b => {
      const bs = b.stats || {};
      const buildName = b.buildName || b.BuildingName || b.BuildingCode || '未知';
      const total = bs.total || 0;
      if (total > 0) {
        const soldRate = (bs.已售 || 0) / total * 100;
        console.log(`  ${buildName}: 已售${bs.已售||0}(${soldRate.toFixed(1)}%) | 签约中${bs.签约中||0} | 可售${bs.可售||0}`);
      }
    });
  } else if (latest.houses && latest.houses.length > 0) {
    const houses = latest.houses;
    const sold = houses.filter(h => h.status === '已售').length;
    const signing = houses.filter(h => h.status === '签约中').length;
    const available = houses.filter(h => h.status === '可售').length;
    console.log(`  已售${sold} | 签约中${signing} | 可售${available}`);
  }
  console.log('');
});
