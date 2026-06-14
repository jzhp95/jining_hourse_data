const fs = require('fs');
const path = require('path');

const projects = [
  { id: '00000139', name: '麓鸣府' },
  { id: '00000129', name: '星都会' },
  { id: '00001312', name: '城投泽信和鸣天著' },
  { id: '00001267', name: '中玮名门' }
];

console.log('========== 四个小区销售对比 ==========\n');

projects.forEach(project => {
  const dir = path.join(__dirname, 'output', `${project.name}_${project.id}`);
  
  if (!fs.existsSync(dir)) {
    console.log(`【${project.name}】数据不存在`);
    return;
  }
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  files.sort();
  
  if (files.length < 2) {
    console.log(`【${project.name}】数据不足，无法对比`);
    return;
  }
  
  const latest = files[files.length - 1];
  const previous = files[files.length - 2];
  
  const d1 = JSON.parse(fs.readFileSync(path.join(dir, previous)));
  const d2 = JSON.parse(fs.readFileSync(path.join(dir, latest)));
  
  const date1 = previous.match(/(\d{8})/)[1];
  const date2 = latest.match(/(\d{8})/)[1];
  const formatDate = (d) => `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
  
  console.log(`【${project.name}】`);
  console.log(`  ${formatDate(date1)} -> ${formatDate(date2)}`);
  
  const stats1 = d1.totalStats;
  const stats2 = d2.totalStats;
  
  const soldDiff = stats2.已售 - stats1.已售;
  const signingDiff = stats2.签约中 - stats1.签约中;
  const forSaleDiff = stats2.可售 - stats1.可售;
  
  let hasChange = false;
  
  if (soldDiff !== 0 || signingDiff !== 0 || forSaleDiff !== 0) {
    hasChange = true;
    
    if (soldDiff !== 0) {
      console.log(`  已售: ${stats1.已售} -> ${stats2.已售} (${soldDiff > 0 ? '+' : ''}${soldDiff})`);
    }
    if (signingDiff !== 0) {
      console.log(`  签约中: ${stats1.签约中} -> ${stats2.签约中} (${signingDiff > 0 ? '+' : ''}${signingDiff})`);
    }
    if (forSaleDiff !== 0) {
      console.log(`  可售: ${stats1.可售} -> ${stats2.可售} (${forSaleDiff > 0 ? '+' : ''}${forSaleDiff})`);
    }
    
    const prevHouseIds = new Set(d1.houses.map(h => h.HouseID));
    const currHouseIds = new Set(d2.houses.map(h => h.HouseID));
    
    const newSigning = [];
    d2.houses.forEach(house => {
      if (house.status === '签约中' && !prevHouseIds.has(house.HouseID)) {
        newSigning.push(house);
      }
    });
    
    d1.houses.forEach(house => {
      if (house.status === '签约中') {
        const currHouse = d2.houses.find(h => h.HouseID === house.HouseID);
        if (currHouse && currHouse.status !== '签约中') {
          if (currHouse.status === '已售') {
          }
        }
      }
    });
    
    const prevSigningIds = new Set(d1.houses.filter(h => h.status === '签约中').map(h => h.HouseID));
    const currSigningIds = new Set(d2.houses.filter(h => h.status === '签约中').map(h => h.HouseID));
    
    const newlySigning = [...currSigningIds].filter(id => !prevSigningIds.has(id));
    const completedSigning = [...prevSigningIds].filter(id => !currSigningIds.has(id));
    
    if (newlySigning.length > 0) {
      console.log(`\n  新增签约中:`);
      newlySigning.forEach(id => {
        const house = d2.houses.find(h => h.HouseID === id);
        if (house) {
          console.log(`    - ${house.buildName} ${house.HouseName} ${house.StringLayer}层 ${house.BuildArea}m²`);
        }
      });
    }
    
    if (completedSigning.length > 0) {
      console.log(`\n  完成签约(已售):`);
      completedSigning.forEach(id => {
        const house = d1.houses.find(h => h.HouseID === id);
        if (house) {
          console.log(`    - ${house.buildName} ${house.HouseName} ${house.StringLayer}层 ${house.BuildArea}m²`);
        }
      });
    }
  }
  
  if (!hasChange) {
    console.log(`  无变化`);
  }
  console.log('');
});
