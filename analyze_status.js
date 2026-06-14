const fs = require('fs');

const projects = [
  { id: '00000139', name: '麓鸣府' },
  { id: '00000129', name: '星都会' },
  { id: '00001312', name: '城投泽信和鸣天著' },
  { id: '00001267', name: '中玮名门' }
];

function getLatestTwo(dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  if (files.length < 2) return null;
  return {
    prev: { file: files[files.length - 2], data: JSON.parse(fs.readFileSync(`${dir}/${files[files.length - 2]}`)) },
    curr: { file: files[files.length - 1], data: JSON.parse(fs.readFileSync(`${dir}/${files[files.length - 1]}`)) }
  };
}

function getChanges(d1, d2) {
  const prevSoldIds = new Set(d1.houses.filter(h => h.status === '已售').map(h => h.HouseID));
  const currSoldIds = new Set(d2.houses.filter(h => h.status === '已售').map(h => h.HouseID));
  const prevSigningIds = new Set(d1.houses.filter(h => h.status === '签约中').map(h => h.HouseID));
  const currSigningIds = new Set(d2.houses.filter(h => h.status === '签约中').map(h => h.HouseID));

  const newlySold = [...currSoldIds].filter(id => !prevSoldIds.has(id));
  const newlySigning = [...currSigningIds].filter(id => !prevSigningIds.has(id));
  const completedSigning = [...prevSigningIds].filter(id => !currSigningIds.has(id) && currSoldIds.has(id));

  return { newlySold, newlySigning, completedSigning };
}

function formatDate(file) {
  const d = file.match(/(\d{8})/)[1];
  return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
}

console.log('========== 五个小区销售情况分析 ==========\n');

projects.forEach(project => {
  const dir = `${__dirname}/output/${project.name}_${project.id}`;
  if (!fs.existsSync(dir)) {
    console.log(`【${project.name}】数据不存在\n`);
    return;
  }

  const result = getLatestTwo(dir);
  if (!result) {
    console.log(`【${project.name}】数据不足\n`);
    return;
  }

  const { prev, curr } = result;
  const date1 = formatDate(prev.file);
  const date2 = formatDate(curr.file);
  const changes = getChanges(prev.data, curr.data);

  console.log(`【${project.name}】`);
  console.log(`  日期: ${date1} -> ${date2}`);
  console.log(`  已售: ${prev.data.totalStats.已售} -> ${curr.data.totalStats.已售} (${curr.data.totalStats.已售 - prev.data.totalStats.已售 >= 0 ? '+' : ''}${curr.data.totalStats.已售 - prev.data.totalStats.已售})`);
  console.log(`  签约中: ${prev.data.totalStats.签约中} -> ${curr.data.totalStats.签约中} (${curr.data.totalStats.签约中 - prev.data.totalStats.签约中 >= 0 ? '+' : ''}${curr.data.totalStats.签约中 - prev.data.totalStats.签约中})`);
  console.log(`  可售: ${prev.data.totalStats.可售} -> ${curr.data.totalStats.可售}`);
  console.log(`  售出率: ${(curr.data.totalStats.已售 / curr.data.totalStats.total * 100).toFixed(1)}%`);

  if (changes.newlySold.length > 0) {
    console.log(`  新成交: ${changes.newlySold.length}套`);
  }
  if (changes.newlySigning.length > 0) {
    console.log(`  新签约: ${changes.newlySigning.length}套`);
  }
  console.log('');
});
