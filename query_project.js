const fs = require('fs');
const path = require('path');
const https = require('https');
const { mdToPdf } = require('md-to-pdf');

const BASE_URL = 'https://www.zwfw.jnszf.cn';
const BUILD_LIST_API = `${BASE_URL}/PortalSite/SpfQuery/GETSPFBuildList`;
const HOUSE_DETAIL_API = `${BASE_URL}/PortalSite/SpfQuery/GetHouseListByBuildIDs`;

const DELAY_MS = 100;
const OUTPUT_DIR = path.join(__dirname, 'output');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://www.zwfw.jnszf.cn/PublicServices/lpcx'
      },
      rejectUnauthorized: false,
      timeout: 30000
    };
    
    const req = https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}, raw: ${data.substring(0, 200)}`));
        }
      });
    });
    
    req.on('error', (err) => {
      reject(new Error(`HTTP error: ${err.code || err.message} (${err.syscall || ''})`));
    });

    req.on('timeout', () => {
      req.destroy(new Error(`TIMEOUT: 请求超时 (${url.substring(0, 80)})`));
    });
  });
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await httpsGet(url);
    } catch (error) {
      if (i < retries - 1) {
        await sleep(DELAY_MS * (i + 1));
      } else {
        throw error;
      }
    }
  }
}

function getHouseStatus(house) {
  if (house.TranState === '0004' || house.TranState === '0005') {
    return '已售';
  }
  if (house.TranState === '0000' || house.TranState === '0001' || house.TranState === '0002' || house.TranState === '0003') {
    return '签约中';
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

function analyzeHouses(houses) {
  let hasBottomCommerce = false;
  
  // 识别并过滤掉商业房源
  const filteredHouses = houses.filter(house => {
    // 检查房屋用途是否包含“商业”
    const purpose = house.HousePurposeText || '';
    if (purpose.includes('商业')) {
      hasBottomCommerce = true;
      return false;
    }
    return true;
  });

  const stats = {
    total: filteredHouses.length,
    已售: 0,
    可售: 0,
    签约中: 0,
    抵押: 0,
    查封: 0,
    限制销售: 0,
    超期锁定: 0,
    不可售: 0
  };
  
  const forSaleByUnit = {};
  const allByUnit = {};
  
  filteredHouses.forEach(house => {
    const status = getHouseStatus(house);
    stats[status]++;
    
    const unitKey = house.UnitNumber || '00';
    if (!allByUnit[unitKey]) {
      allByUnit[unitKey] = [];
    }
    allByUnit[unitKey].push({
      houseID: house.HouseID,
      houseName: house.HouseName,
      floor: house.StringLayer,
      currentLayer: house.CurrentLayer,
      buildArea: house.BuildArea,
      inArea: house.InArea,
      apportionArea: house.ApportionArea,
      housePurpose: house.HousePurposeText,
      houseStructure: house.HouseStructureText,
      houseType: house.HouseTypeText,
      houseNature: house.HouseNatureText,
      status: status
    });
    
    if (status === '可售') {
      if (!forSaleByUnit[unitKey]) {
        forSaleByUnit[unitKey] = [];
      }
      forSaleByUnit[unitKey].push({
        houseID: house.HouseID,
        houseName: house.HouseName,
        floor: house.StringLayer,
        currentLayer: house.CurrentLayer,
        buildArea: house.BuildArea,
        inArea: house.InArea,
        apportionArea: house.ApportionArea,
        housePurpose: house.HousePurposeText,
        houseStructure: house.HouseStructureText,
        houseType: house.HouseTypeText,
        houseNature: house.HouseNatureText
      });
    }
  });
  
  Object.keys(allByUnit).forEach(unit => {
    allByUnit[unit].sort((a, b) => {
      const floorA = parseInt(a.floor) || 0;
      const floorB = parseInt(b.floor) || 0;
      return floorA - floorB;
    });
  });
  
  Object.keys(forSaleByUnit).forEach(unit => {
    forSaleByUnit[unit].sort((a, b) => {
      const floorA = parseInt(a.floor) || 0;
      const floorB = parseInt(b.floor) || 0;
      return floorA - floorB;
    });
  });
  
  return { stats, forSaleByUnit, allByUnit, hasBottomCommerce };
}

function generateMarkdown(projectID, projectName, companyName, districtName, buildings, totalStats, allForSale) {
  const now = new Date();
  const dateStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  
  let md = `# ${projectName} 楼盘销售情况报告\n\n`;
  md += `> 查询时间: ${dateStr}\n\n`;
  
  md += `## 基本信息\n\n`;
  md += `| 项目 | 内容 |\n`;
  md += `|------|------|\n`;
  md += `| 小区代码 | ${projectID} |\n`;
  md += `| 小区名称 | ${projectName} |\n`;
  md += `| 开发企业 | ${companyName} |\n`;
  md += `| 所在区域 | ${districtName} |\n`;
  md += `| 楼栋数量 | ${buildings.length} 栋 |\n\n> **注**：本报表已自动排除了房屋用途为“商业”的条目。如果楼栋包含商业用途房源，将会在楼栋名称后标注 \`(含底商)\`。\n\n`;
  
  md += `## 销售概况\n\n`;
  md += `| 状态 | 数量 | 占比 |\n`;
  md += `|------|------|------|\n`;
  const soldRate = (totalStats.已售 / totalStats.total * 100).toFixed(1);
  const forSaleRate = (totalStats.可售 / totalStats.total * 100).toFixed(1);
  const signingRate = (totalStats.签约中 / totalStats.total * 100).toFixed(1);
  md += `| 总套数 | ${totalStats.total} | 100% |\n`;
  md += `| 已售 | ${totalStats.已售} | ${soldRate}% |\n`;
  md += `| 可售 | ${totalStats.可售} | ${forSaleRate}% |\n`;
  md += `| 签约中 | ${totalStats.签约中} | ${signingRate}% |\n`;
  if (totalStats.抵押 > 0) md += `| 抵押 | ${totalStats.抵押} | ${(totalStats.抵押 / totalStats.total * 100).toFixed(1)}% |\n`;
  if (totalStats.查封 > 0) md += `| 查封 | ${totalStats.查封} | ${(totalStats.查封 / totalStats.total * 100).toFixed(1)}% |\n`;
  if (totalStats.限制销售 > 0) md += `| 限制销售 | ${totalStats.限制销售} | ${(totalStats.限制销售 / totalStats.total * 100).toFixed(1)}% |\n`;
  if (totalStats.超期锁定 > 0) md += `| 超期锁定 | ${totalStats.超期锁定} | ${(totalStats.超期锁定 / totalStats.total * 100).toFixed(1)}% |\n`;
  if (totalStats.不可售 > 0) md += `| 不可售 | ${totalStats.不可售} | ${(totalStats.不可售 / totalStats.total * 100).toFixed(1)}% |\n`;
  md += `\n`;
  
  md += `## 各楼栋销售情况\n\n`;
  md += `| 楼栋 | 层数 | 总套数 | 已售 | 可售 | 签约中 | 售出率 | 预售证号 |\n`;
  md += `|------|------|--------|------|------|--------|--------|----------|\n`;
  buildings.forEach(b => {
    const rate = b.stats.total > 0 ? (b.stats.已售 / b.stats.total * 100).toFixed(1) : '0.0';
    const floorDisplay = b.allFloor > 0 ? `${b.allFloor}层` : '-';
    const nameDisplay = b.buildName + (b.hasBottomCommerce ? ' (含底商)' : '');
    md += `| ${nameDisplay} | ${floorDisplay} | ${b.stats.total} | ${b.stats.已售} | ${b.stats.可售} | ${b.stats.签约中} | ${rate}% | ${b.sellingCode} |\n`;
  });
  md += `| **合计** | - | **${totalStats.total}** | **${totalStats.已售}** | **${totalStats.可售}** | **${totalStats.签约中}** | **${soldRate}%** | - |\n`;
  md += `\n`;
  
  md += `---\n\n`;
  md += `## 各楼栋房源明细\n\n`;
  md += `> 状态说明: <span style="color:green">**可售**</span> | 已售 | 签约中 | 抵押 | 查封 | 限制销售\n\n`;
  
  buildings.forEach(b => {
    md += `### ${b.buildName}\n\n`;
    md += `预售证号: ${b.sellingCode} | 总套数: ${b.stats.total} | 已售: ${b.stats.已售} | 可售: ${b.stats.可售}\n\n`;
    
    if (b.allByUnit && Object.keys(b.allByUnit).length > 0) {
      const sortedUnits = Object.keys(b.allByUnit).sort((a, c) => {
        if (a === '00') return 1;
        if (c === '00') return -1;
        return parseInt(a) - parseInt(c);
      });
      
      sortedUnits.forEach(unit => {
        const unitName = unit === '00' ? '其他' : `${unit}单元`;
        md += `#### ${unitName}\n\n`;
        md += `| 房号 | 楼层 | 建筑面积(m²) | 套内面积(m²) | 公摊面积(m²) | 使用率 | 房屋用途 | 状态 |\n`;
        md += `|------|------|-------------|-------------|-------------|--------|----------|------|\n`;
        
        b.allByUnit[unit].forEach(h => {
          let statusDisplay = h.status;
          if (h.status === '可售') {
            statusDisplay = '<span style="color:green">**可售**</span>';
          }
          const buildArea = parseFloat(h.buildArea) || 0;
          const inArea = parseFloat(h.inArea) || 0;
          const apportionArea = h.apportionArea || (buildArea > 0 ? (buildArea - inArea).toFixed(2) : '-');
          const usageRate = buildArea > 0 ? (inArea / buildArea * 100).toFixed(1) + '%' : '-';
          md += `| ${h.houseName} | ${h.floor}层 | ${h.buildArea} | ${h.inArea} | ${apportionArea} | ${usageRate} | ${h.housePurpose} | ${statusDisplay} |\n`;
        });
        md += `\n`;
      });
    }
    
    md += `---\n\n`;
  });
  
  if (allForSale.length > 0) {
    md += `## 全部可售房源汇总\n\n`;
    md += `> 共 ${allForSale.length} 套可售房源\n\n`;
    md += `| 楼栋 | 单元 | 房号 | 楼层 | 建筑面积(m²) | 套内面积(m²) | 公摊面积(m²) | 使用率 | 房屋用途 |\n`;
    md += `|------|------|------|------|-------------|-------------|-------------|--------|----------|\n`;
    
    allForSale.forEach(h => {
      const unitName = h.unit === '00' ? '其他' : `${h.unit}单元`;
      const buildArea = parseFloat(h.buildArea) || 0;
      const inArea = parseFloat(h.inArea) || 0;
      const apportionArea = h.apportionArea || (buildArea > 0 ? (buildArea - inArea).toFixed(2) : '-');
      const usageRate = buildArea > 0 ? (inArea / buildArea * 100).toFixed(1) + '%' : '-';
      md += `| ${h.buildName} | ${unitName} | ${h.houseName} | ${h.floor}层 | ${h.buildArea} | ${h.inArea} | ${apportionArea} | ${usageRate} | ${h.housePurpose} |\n`;
    });
    md += `\n`;
  }
  
  md += `---\n\n`;
  md += `*报告生成时间: ${dateStr}*\n`;
  
  return md;
}

async function getProjectInfo(projectID) {
  const PAGE_SIZE = 20;
  let page = 1;
  let allBuildRows = [];
  const seenBuildIDs = new Set();

  while (true) {
    const buildData = await fetchWithRetry(`${BUILD_LIST_API}?searchConent=${projectID}&page=${page}&pageSize=${PAGE_SIZE}`);
    if (!buildData.rows || buildData.rows.length === 0) break;

    let newCount = 0;
    for (const row of buildData.rows) {
      const buildID = row.BuildID;
      if (!seenBuildIDs.has(buildID)) {
        seenBuildIDs.add(buildID);
        allBuildRows.push(row);
        newCount++;
      }
    }

    if (newCount === 0) break;

    page++;
    await sleep(DELAY_MS);
  }

  // 【核心修复】精准过滤：只保留 ProjectID 完全匹配的项目
  const filteredBuildRows = allBuildRows.filter(row => row.ProjectID === projectID);

  if (filteredBuildRows.length === 0) {
    console.log(`\n未找到 ProjectID 为 "${projectID}" 的精准匹配小区（模糊搜索结果中不包含该 ID）\n`);
    return null;
  }

  const projectName = allBuildRows[0].ProjectName;
  const companyName = allBuildRows[0].CompanyName;
  const districtName = allBuildRows[0].DistrictName;

  console.log('\n========================================');
  console.log(`小区名称: ${projectName}`);
  console.log(`开发企业: ${companyName}`);
  console.log(`所在区域: ${districtName}`);
  console.log(`楼栋数量: ${filteredBuildRows.length} 栋`);
  console.log('========================================\n');

  // 标记 buildingCount，供后续使用
  const totalBuildings = filteredBuildRows.length;

  const buildings = [];
  const allHouses = [];
  let totalStats = { total: 0, 已售: 0, 可售: 0, 签约中: 0, 抵押: 0, 查封: 0, 限制销售: 0, 超期锁定: 0, 不可售: 0 };
  let allForSale = [];

  for (const build of allBuildRows) {
    await sleep(DELAY_MS);
    
    try {
      const houses = await fetchWithRetry(`${HOUSE_DETAIL_API}?BuildID=${build.BuildID}`);
      const { stats, forSaleByUnit, allByUnit, hasBottomCommerce } = analyzeHouses(houses);
      
      const maxFloor = houses.length > 0 ? Math.max(...houses.map(h => h.AllFloor || 0)) : 0;
      const totalInArea = houses.length > 0 
        ? houses.reduce((sum, h) => sum + (parseFloat(h.InArea) || 0), 0).toFixed(2)
        : 0;
      
      console.log(`【${build.BuildName}】${hasBottomCommerce ? ' (含底商)' : ''}`);
      console.log(`  预售证号: ${build.SellingCode}`);
      console.log(`  总套数: ${stats.total}  已售: ${stats.已售}  可售: ${stats.可售}  签约中: ${stats.签约中}`);
      
      if (stats.抵押 > 0) console.log(`  抵押: ${stats.抵押}`);
      if (stats.查封 > 0) console.log(`  查封: ${stats.查封}`);
      if (stats.限制销售 > 0) console.log(`  限制销售: ${stats.限制销售}`);
      
      const rate = stats.total > 0 ? (stats.已售 / stats.total * 100).toFixed(1) : 0;
      console.log(`  售出率: ${rate}%`);
      
      if (Object.keys(forSaleByUnit).length > 0) {
        console.log(`  --- 可售房源 ---`);
        
        const sortedUnits = Object.keys(forSaleByUnit).sort((a, b) => {
          if (a === '00') return 1;
          if (b === '00') return -1;
          return parseInt(a) - parseInt(b);
        });
        
        sortedUnits.forEach(unit => {
          const unitName = unit === '00' ? '商业/其他' : `${unit}单元`;
          console.log(`  [${unitName}]`);
          
          forSaleByUnit[unit].forEach(h => {
            console.log(`    ${h.houseName}  ${h.floor}层  建面${h.buildArea}m²  套内${h.inArea}m²  ${h.housePurpose}`);
          });
        });
      }
      console.log('');
      
      buildings.push({
        buildID: build.BuildID,
        buildName: build.BuildName,
        sellingCode: build.SellingCode,
        houseCount: houses.length,
        allFloor: maxFloor,
        totalInArea: totalInArea,
        stats: stats,
        forSaleByUnit: forSaleByUnit,
        allByUnit: allByUnit
      });
      
      allHouses.push(...houses.map(h => ({
        ...h,
        buildName: build.BuildName,
        status: getHouseStatus(h)
      })));
      
      Object.entries(forSaleByUnit).forEach(([unit, unitHouses]) => {
        unitHouses.forEach(h => {
          allForSale.push({
            buildName: build.BuildName,
            unit: unit,
            ...h
          });
        });
      });
      
      totalStats.total += stats.total;
      totalStats.已售 += stats.已售;
      totalStats.可售 += stats.可售;
      totalStats.签约中 += stats.签约中;
      totalStats.抵押 += stats.抵押;
      totalStats.查封 += stats.查封;
      totalStats.限制销售 += stats.限制销售;
      totalStats.超期锁定 += stats.超期锁定;
      totalStats.不可售 += stats.不可售;
      
    } catch (error) {
      console.log(`【${build.BuildName}】获取失败: ${error.message}\n`);
    }
  }
  
  console.log('========================================');
  console.log('小区汇总统计');
  console.log('========================================');
  console.log(`总套数: ${totalStats.total}`);
  console.log(`已售: ${totalStats.已售} (${(totalStats.已售 / totalStats.total * 100).toFixed(1)}%)`);
  console.log(`可售: ${totalStats.可售} (${(totalStats.可售 / totalStats.total * 100).toFixed(1)}%)`);
  console.log(`签约中: ${totalStats.签约中}`);
  if (totalStats.抵押 > 0) console.log(`抵押: ${totalStats.抵押}`);
  if (totalStats.查封 > 0) console.log(`查封: ${totalStats.查封}`);
  if (totalStats.限制销售 > 0) console.log(`限制销售: ${totalStats.限制销售}`);
  console.log('========================================\n');
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const today = new Date();
  const dateSuffix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const safeName = projectName.replace(/[\/\\?%*:|"<>]/g, '_');
  
  const projectDir = path.join(OUTPUT_DIR, `${safeName}_${projectID}`);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }
  
  const baseFileName = `${safeName}_${dateSuffix}`;
  const outputFile = path.join(projectDir, `${baseFileName}.md`);
  
  const mdContent = generateMarkdown(projectID, projectName, companyName, districtName, buildings, totalStats, allForSale);
  
  // 确保覆盖已存在的文件
  if (fs.existsSync(outputFile)) {
    fs.unlinkSync(outputFile);
  }
  fs.writeFileSync(outputFile, mdContent, 'utf-8');
  console.log(`[MD] 报告已保存（覆盖）: ${outputFile}\n`);
  
  console.log('正在生成PDF...');
  try {
    const pdf = await mdToPdf(
      { path: outputFile },
      {
        pdf_options: {
          format: 'A4',
          margin: {
            top: '20mm',
            right: '15mm',
            bottom: '20mm',
            left: '15mm'
          },
          printBackground: true,
          timeout: 60000
        },
        launch_options: {
          executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
        },
        stylesheet: [],
        body_class: 'markdown-body',
        css: `
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.6; }
          h1 { font-size: 24px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          h2 { font-size: 18px; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-top: 20px; }
          h3 { font-size: 16px; margin-top: 15px; }
          h4 { font-size: 14px; margin-top: 12px; }
          table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 11px; }
          th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          tr:nth-child(even) { background-color: #fafafa; }
          blockquote { border-left: 4px solid #ddd; padding-left: 15px; color: #666; margin: 10px 0; }
          hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
          span[style*="color:green"] { color: green !important; font-weight: bold; }
        `
      }
    );
    
    if (pdf) {
      const pdfFile = path.join(projectDir, `${baseFileName}.pdf`);
      // 确保覆盖已存在的文件
      if (fs.existsSync(pdfFile)) {
        fs.unlinkSync(pdfFile);
      }
      fs.writeFileSync(pdfFile, pdf.content);
      console.log(`[PDF] 报告已保存（覆盖）: ${pdfFile}\n`);
    }
  } catch (pdfError) {
    console.log(`PDF生成失败: ${pdfError.message}`);
  }
  
  const jsonFile = path.join(projectDir, `${baseFileName}.json`);
  const result = {
    scrapeTime: new Date().toISOString(),
    projectID: projectID,
    projectName: projectName,
    companyName: companyName,
    districtName: districtName,
    buildingCount: buildings.length,
    totalStats: totalStats,
    forSaleList: allForSale,
    buildings: buildings,
    houses: allHouses
  };

  // 确保覆盖已存在的文件
  if (fs.existsSync(jsonFile)) {
    fs.unlinkSync(jsonFile);
  }
  fs.writeFileSync(jsonFile, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`[JSON] 数据已保存（覆盖）: ${jsonFile}\n`);
  
  return result;
}

async function main() {
  const projectID = process.argv[2];
  
  if (!projectID) {
    console.log('\n用法: node query_project.js <小区代码>');
    console.log('示例: node query_project.js 00000129');
    console.log('\n提示: 小区代码可以从 projects_data.json 中的 ProjectID 字段获取\n');
    process.exit(1);
  }
  
  try {
    await getProjectInfo(projectID);
  } catch (error) {
    console.error('\n查询失败:', error.message);
    process.exit(1);
  }
}

main();
