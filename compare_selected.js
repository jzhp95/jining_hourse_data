const fs = require('fs');
const path = require('path');

const projects = [
  { id: '00000139', name: '麓鸣府' },
  { id: '00000129', name: '星都会' },
  { id: '00001312', name: '城投泽信和鸣天著' },
  { id: '00001267', name: '中玮名门' }
];

console.log('========== 小区销售情况对比 ==========\n');

projects.forEach(project => {
  const dir = path.join(__dirname, 'output', `${project.name}_${project.id}`);
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  files.sort();
  
  if (files.length < 2) {
    console.log(`${project.name}: 数据不足，无法对比`);
    console.log('');
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
  
  const sold1 = d1.totalStats.已售;
  const sold2 = d2.totalStats.已售;
  const diff = sold2 - sold1;
  
  console.log(`  已售: ${sold1} -> ${sold2} ${diff > 0 ? `(+${diff})` : '(无变化)'}`);
  
  if (diff > 0) {
    const prevForSale = new Set(d1.forSaleList.map(h => h.houseID));
    const currForSale = new Set(d2.forSaleList.map(h => h.houseID));
    
    const newlySold = [...prevForSale].filter(id => !currForSale.has(id));
    
    console.log(`  新售出房源:`);
    newlySold.forEach(id => {
      const house = d1.forSaleList.find(h => h.houseID === id);
      if (house) {
        console.log(`    ${house.buildName} ${house.houseName} - ${house.floor}层 - 建面${house.buildArea}m²`);
      }
    });
  }
  console.log('');
});
