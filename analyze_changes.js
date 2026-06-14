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

function getHouseMap(data, key = 'houseID') {
  const map = {};
  if (data.buildings) {
    data.buildings.forEach(b => {
      const buildName = b.buildName || b.BuildingName || '未知';
      Object.values(b.allByUnit || {}).forEach(unitHouses => {
        unitHouses.forEach(h => {
          const k = `${buildName}_${h.houseID}`;
          map[k] = { ...h, buildName };
        });
      });
    });
  }
  return map;
}

function analyzeChanges(prevMap, latestMap) {
  const changes = { sold: [], signing: [], available: [], other: [] };

  for (const key of Object.keys(latestMap)) {
    const latest = latestMap[key];
    const prev = prevMap[key];

    if (!prev) continue;
    if (prev.status === latest.status) continue;

    const info = {
      build: latest.buildName,
      house: latest.houseName || latest.RoomName || key.split('_')[1],
      area: latest.buildArea || '',
      from: prev.status,
      to: latest.status
    };

    if (latest.status === '已售' && prev.status !== '已售') {
      changes.sold.push(info);
    } else if (latest.status === '签约中' && prev.status === '可售') {
      changes.signing.push(info);
    } else if (latest.status === '可售' && prev.status !== '可售') {
      changes.available.push(info);
    } else {
      changes.other.push(info);
    }
  }
  return changes;
}

console.log('');
console.log('========================================');
console.log('  成交动态 - 具体房源变化');
console.log('========================================');
console.log('');

projects.forEach(proj => {
  const projectDir = path.join(__dirname, 'output', proj.folder);
  if (!fs.existsSync(projectDir)) return;

  const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.json')).sort();
  if (files.length < 2) return;

  const latestFile = files[files.length - 1];
  const prevFile = files[files.length - 2];

  const latest = JSON.parse(fs.readFileSync(path.join(projectDir, latestFile), 'utf8'));
  const prev = JSON.parse(fs.readFileSync(path.join(projectDir, prevFile), 'utf8'));

  const latestDate = latestFile.match(/(\d{8})/)[1];
  const prevDate = prevFile.match(/(\d{8})/)[1];

  const prevMap = getHouseMap(prev);
  const latestMap = getHouseMap(latest);
  const changes = analyzeChanges(prevMap, latestMap);

  if (changes.sold.length === 0 && changes.signing.length === 0 && changes.available.length === 0 && changes.other.length === 0) {
    return;
  }

  console.log(`【${proj.name}】(${prevDate} → ${latestDate})`);
  console.log('');

  if (changes.sold.length > 0) {
    console.log(`  🔴 新增已售 (${changes.sold.length}套):`);
    changes.sold.forEach(h => {
      console.log(`    ${h.build} ${h.house} 建面${h.area}㎡ | ${h.from} → ${h.to}`);
    });
    console.log('');
  }

  if (changes.signing.length > 0) {
    console.log(`  🟡 新增签约中 (${changes.signing.length}套):`);
    changes.signing.forEach(h => {
      console.log(`    ${h.build} ${h.house} 建面${h.area}㎡ | ${h.from} → ${h.to}`);
    });
    console.log('');
  }

  if (changes.available.length > 0) {
    console.log(`  🟢 变为可售 (${changes.available.length}套):`);
    changes.available.forEach(h => {
      console.log(`    ${h.build} ${h.house} 建面${h.area}㎡ | ${h.from} → ${h.to}`);
    });
    console.log('');
  }

  if (changes.other.length > 0) {
    console.log(`  ⚪ 其他变化 (${changes.other.length}套):`);
    changes.other.forEach(h => {
      console.log(`    ${h.build} ${h.house} | ${h.from} → ${h.to}`);
    });
    console.log('');
  }

  console.log('----------------------------------------');
  console.log('');
});
