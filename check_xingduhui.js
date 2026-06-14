const fs = require('fs');
const d1 = JSON.parse(fs.readFileSync('/Users/jzhp/Documents/trae_projects/buy_house/output/星都会_00000129/星都会_20260409.json'));
const d2 = JSON.parse(fs.readFileSync('/Users/jzhp/Documents/trae_projects/buy_house/output/星都会_00000129/星都会_20260410.json'));

const prevIds = new Set(d1.houses.map(h => h.HouseID));
const currIds = new Set(d2.houses.map(h => h.HouseID));

const prevSoldIds = new Set(d1.houses.filter(h => h.status === '已售').map(h => h.HouseID));
const currSoldIds = new Set(d2.houses.filter(h => h.status === '已售').map(h => h.HouseID));
const prevSigningIds = new Set(d1.houses.filter(h => h.status === '签约中').map(h => h.HouseID));
const currSigningIds = new Set(d2.houses.filter(h => h.status === '签约中').map(h => h.HouseID));

const newlySold = [...currSoldIds].filter(id => !prevSoldIds.has(id));
const newlySigning = [...currSigningIds].filter(id => !prevSigningIds.has(id));
const completedSigning = [...prevSigningIds].filter(id => !currSigningIds.has(id) && currSoldIds.has(id));

console.log('星都会 4月9日 -> 4月10日 变化:');
console.log('');
console.log('【完成签约(已售)】共' + newlySold.length + '套:');
newlySold.forEach(id => {
  const h = d2.houses.find(x => x.HouseID === id);
  if (h) {
    console.log('  ' + h.buildName + ' ' + h.HouseName + ' ' + h.StringLayer + '层 ' + h.BuildArea + 'm²');
  }
});

console.log('');
console.log('【新增签约中】共' + newlySigning.length + '套:');
newlySigning.forEach(id => {
  const h = d2.houses.find(x => x.HouseID === id);
  if (h) {
    console.log('  ' + h.buildName + ' ' + h.HouseName + ' ' + h.StringLayer + '层 ' + h.BuildArea + 'm²');
  }
});

console.log('');
console.log('【签约完成】共' + completedSigning.length + '套:');
completedSigning.forEach(id => {
  const h = d1.houses.find(x => x.HouseID === id);
  if (h) {
    console.log('  ' + h.buildName + ' ' + h.HouseName + ' ' + h.StringLayer + '层');
  }
});
