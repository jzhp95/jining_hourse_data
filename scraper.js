const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://www.zwfw.jnszf.cn';
const BUILD_LIST_API = `${BASE_URL}/PortalSite/SpfQuery/GETSPFBuildList`;
const HOUSE_DETAIL_API = `${BASE_URL}/PortalSite/SpfQuery/GetHouseListByBuildIDs`;
const OUTPUT_FILE = path.join(__dirname, 'loupan_data.json');

const DELAY_MS = 200;

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        agent: httpsAgent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Referer': 'https://www.zwfw.jnszf.cn/PublicServices/lpcx'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`请求失败 (第 ${i + 1} 次尝试): ${error.message}`);
      if (i < retries - 1) {
        console.log(`等待 ${DELAY_MS * (i + 1)}ms 后重试...`);
        await sleep(DELAY_MS * (i + 1));
      } else {
        throw error;
      }
    }
  }
}

async function getTotalPages() {
  console.log('获取总页数...');
  const data = await fetchWithRetry(`${BUILD_LIST_API}?searchConent=&page=1`);
  console.log(`总记录数: ${data.total}, 总页数: ${data.pageCount}`);
  return { total: data.total, pageCount: data.pageCount };
}

async function fetchBuildList(page) {
  const url = `${BUILD_LIST_API}?searchConent=&page=${page}`;
  return await fetchWithRetry(url);
}

async function fetchHouseDetails(buildID) {
  const url = `${HOUSE_DETAIL_API}?BuildID=${buildID}`;
  return await fetchWithRetry(url);
}

function translateTranState(state) {
  const stateMap = {
    '0000': '签约中',
    '0001': '签字确认中',
    '0002': '合同已确认',
    '0003': '已打印',
    '0004': '网签备案',
    '0005': '归档'
  };
  return stateMap[state] || '可售';
}

function getHouseStatus(house) {
  if (house.TranState && house.TranState !== '') {
    return translateTranState(house.TranState);
  }
  
  if (house.IsMortgage) return '抵押';
  if (house.IsSealUp) return '查封';
  if (house.IsLock) return '限制销售';
  if (house.OverdueLock) return '超期锁定';
  
  const nonSellableNatures = ['0001', '0002', '0003', '0004', '0007', '0008', '0009', '0010', '0099'];
  if (nonSellableNatures.includes(house.HouseNature)) return '不可售';
  if (!house.SellingLicenseID || !house.AllowSelling) return '不可售';
  
  return '可售';
}

async function scrapeAllData(startPage = 1, maxPages = null, fetchDetails = true) {
  console.log('========== 开始抓取楼盘数据 ==========\n');
  
  const { total, pageCount } = await getTotalPages();
  
  const endPage = maxPages ? Math.min(startPage + maxPages - 1, pageCount) : pageCount;
  console.log(`将抓取第 ${startPage} 到 ${endPage} 页的数据\n`);
  
  const allBuildings = [];
  const allHouses = [];
  
  for (let page = startPage; page <= endPage; page++) {
    console.log(`\n========== 正在抓取第 ${page}/${endPage} 页 ==========`);
    
    try {
      const data = await fetchBuildList(page);
      const buildings = data.rows || [];
      
      console.log(`本页获取到 ${buildings.length} 条楼盘记录`);
      
      for (const building of buildings) {
        const buildingInfo = {
          buildID: building.BuildID,
          buildName: building.BuildName,
          projectID: building.ProjectID,
          projectName: building.ProjectName,
          districtCode: building.DistrictCode,
          districtName: building.DistrictName,
          companyID: building.CompanyID,
          companyName: building.CompanyName,
          sellingCode: building.SellingCode
        };
        
        allBuildings.push(buildingInfo);
        
        if (fetchDetails) {
          console.log(`  获取楼盘详情: ${building.ProjectName} - ${building.BuildName}`);
          
          await sleep(DELAY_MS);
          
          try {
            const houses = await fetchHouseDetails(building.BuildID);
            
            const processedHouses = houses.map(house => ({
              houseID: house.HouseID,
              buildID: house.BuildID,
              houseCode: house.HouseCode,
              houseName: house.HouseName,
              unitNumber: house.UnitNumber,
              floor: house.StringLayer,
              buildArea: house.BuildArea,
              inArea: house.InArea,
              housePurpose: house.HousePurposeText,
              houseStructure: house.HouseStructureText,
              houseType: house.HouseTypeText,
              houseNature: house.HouseNatureText,
              status: getHouseStatus(house),
              isMortgage: house.IsMortgage,
              isSealUp: house.IsSealUp,
              isLock: house.IsLock,
              tranState: house.TranStateText || '',
              allowSelling: house.AllowSelling
            }));
            
            allHouses.push(...processedHouses);
            console.log(`    获取到 ${processedHouses.length} 套房屋信息`);
            
          } catch (error) {
            console.error(`    获取楼盘详情失败: ${error.message}`);
          }
        }
      }
      
      await sleep(DELAY_MS);
      
    } catch (error) {
      console.error(`抓取第 ${page} 页失败: ${error.message}`);
    }
    
    const progress = ((page - startPage + 1) / (endPage - startPage + 1) * 100).toFixed(1);
    console.log(`\n进度: ${progress}%`);
  }
  
  console.log('\n========== 抓取完成 ==========');
  console.log(`总共抓取 ${allBuildings.length} 个楼盘`);
  console.log(`总共抓取 ${allHouses.length} 套房屋`);
  
  const result = {
    scrapeTime: new Date().toISOString(),
    total: total,
    buildingsCount: allBuildings.length,
    housesCount: allHouses.length,
    buildings: allBuildings,
    houses: allHouses
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\n数据已保存到: ${OUTPUT_FILE}`);
  
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  
  let startPage = 1;
  let maxPages = null;
  let fetchDetails = true;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start' && args[i + 1]) {
      startPage = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--pages' && args[i + 1]) {
      maxPages = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--no-details') {
      fetchDetails = false;
    }
  }
  
  console.log('参数配置:');
  console.log(`  起始页: ${startPage}`);
  console.log(`  最大页数: ${maxPages || '全部'}`);
  console.log(`  获取详情: ${fetchDetails}`);
  console.log('');
  
  try {
    await scrapeAllData(startPage, maxPages, fetchDetails);
  } catch (error) {
    console.error('抓取失败:', error);
    process.exit(1);
  }
}

main();
