const fs = require('fs');
const d1 = JSON.parse(fs.readFileSync('/Users/jzhp/Documents/trae_projects/buy_house/output/麓鸣府_00000139/麓鸣府_20260409.json'));
const d2 = JSON.parse(fs.readFileSync('/Users/jzhp/Documents/trae_projects/buy_house/output/麓鸣府_00000139/麓鸣府_20260410.json'));

const prevSigning = new Set(d1.houses.filter(h => h.status === '签约中').map(h => h.HouseID));
const currSigning = d2.houses.filter(h => h.status === '签约中');

const newlySigning = currSigning.filter(h => !prevSigning.has(h.HouseID));

console.log('麓鸣府 4月9日 -> 4月10日 新增签约中的房源:');
if (newlySigning.length === 0) {
  console.log('没有新增的签约中');
} else {
  newlySigning.forEach(h => {
    console.log(h.buildName + ' ' + h.HouseName + ' ' + h.StringLayer + '层 ' + h.BuildArea + 'm²');
  });
}

console.log('');
console.log('当前签约中的房源:');
currSigning.forEach(h => {
  const isNew = newlySigning.find(x => x.HouseID === h.HouseID);
  console.log((isNew ? '[新增] ' : '') + h.buildName + ' ' + h.HouseName + ' ' + h.StringLayer + '层');
});
