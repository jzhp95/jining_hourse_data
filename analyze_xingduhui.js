const fs = require('fs');
const path = require('path');

const projectDir = path.join(__dirname, 'output', '星都会_00000129');
const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.json')).sort();
const latestFile = files[files.length - 1];
const prevFile = files[files.length - 2];

const latest = JSON.parse(fs.readFileSync(path.join(projectDir, latestFile), 'utf8'));
const prev = JSON.parse(fs.readFileSync(path.join(projectDir, prevFile), 'utf8'));

const latestDate = latestFile.match(/(\d{8})/)[1];
const prevDate = prevFile.match(/(\d{8})/)[1];

console.log('');
console.log('========================================');
console.log('  星都会 (00000129) 销售情况详细分析');
console.log('========================================');
console.log('');
console.log('对比日期: ' + prevDate + ' → ' + latestDate);
console.log('');

console.log('【总体情况】(' + latestDate + ')');
const s = latest.totalStats;
const soldRate = (s.已售 / s.total * 100).toFixed(1);
const signRate = (s.签约中 / s.total * 100).toFixed(1);
const availRate = (s.可售 / s.total * 100).toFixed(1);
console.log('  总套数: ' + s.total);
console.log('  已售: ' + s.已售 + ' (' + soldRate + '%)');
console.log('  签约中: ' + s.签约中 + ' (' + signRate + '%)');
console.log('  可售: ' + s.可售 + ' (' + availRate + '%)');
if (s.抵押) console.log('  抵押: ' + s.抵押);
if (s.查封) console.log('  查封: ' + s.查封);
if (s.限制销售) console.log('  限制销售: ' + s.限制销售);
if (s.超期锁定) console.log('  超期锁定: ' + s.超期锁定);
if (s.不可售) console.log('  不可售: ' + s.不可售);

const ps = prev.totalStats;
console.log('');
console.log('【变化情况】(' + prevDate + ' → ' + latestDate + ')');
const soldDiff = s.已售 - ps.已售;
const signDiff = s.签约中 - ps.签约中;
const availDiff = s.可售 - ps.可售;
console.log('  已售: ' + ps.已售 + ' → ' + s.已售 + ' (' + (soldDiff > 0 ? '+' : '') + soldDiff + ')');
console.log('  签约中: ' + ps.签约中 + ' → ' + s.签约中 + ' (' + (signDiff > 0 ? '+' : '') + signDiff + ')');
console.log('  可售: ' + ps.可售 + ' → ' + s.可售 + ' (' + (availDiff > 0 ? '+' : '') + availDiff + ')');

console.log('');
console.log('【各楼栋销售情况】(' + latestDate + ')');
latest.buildings.sort((a, b) => {
  const numA = parseInt((a.buildName || '0').replace(/[^0-9]/g, ''));
  const numB = parseInt((b.buildName || '0').replace(/[^0-9]/g, ''));
  return numA - numB;
}).forEach(b => {
  const bs = b.stats;
  const bSoldRate = (bs.已售 / bs.total * 100).toFixed(1);
  const bSignRate = (bs.签约中 / bs.total * 100).toFixed(1);
  const bAvailRate = (bs.可售 / bs.total * 100).toFixed(1);
  console.log('  ' + b.buildName + ': 总' + bs.total + '套 | 已售' + bs.已售 + '(' + bSoldRate + '%) | 签约中' + bs.签约中 + '(' + bSignRate + '%) | 可售' + bs.可售 + '(' + bAvailRate + '%)');
});

console.log('');
console.log('【可售房源明细】(' + latestDate + ')');
latest.buildings.forEach(b => {
  const avail = [];
  Object.entries(b.forSaleByUnit || {}).forEach(([unit, unitHouses]) => {
    unitHouses.forEach(h => {
      avail.push({
        build: b.buildName,
        name: h.houseName,
        floor: h.floor,
        area: h.buildArea,
        inArea: h.inArea,
        apportion: h.apportionArea,
        usage: ((h.inArea / h.buildArea) * 100).toFixed(1)
      });
    });
  });
  if (avail.length > 0) {
    console.log('');
    console.log('  ' + b.buildName + ' (可售' + avail.length + '套):');
    avail.sort((a, c) => {
      const nameA = a.name || '';
      const nameB = c.name || '';
      return nameA.localeCompare(nameB);
    }).forEach(h => {
      console.log('    ' + h.floor + '层 ' + h.name + ' | 建面' + h.area + '㎡ 套内' + h.inArea + '㎡ 公摊' + h.apportion + '㎡ 使用率' + h.usage + '%');
    });
  }
});

console.log('');
console.log('========================================');