const fs = require('fs');
const path = require('path');
const https = require('https');
const { mdToPdf } = require('md-to-pdf');

const BASE_URL = 'https://www.zwfw.jnszf.cn';
const BUILD_LIST_API = `${BASE_URL}/PortalSite/SpfQuery/GETSPFBuildList`;
const HOUSE_DETAIL_API = `${BASE_URL}/PortalSite/SpfQuery/GetHouseListByBuildIDs`;
const PROJECTS_FILE = path.join(__dirname, 'projects_data.json');
const OUTPUT_DIR = path.join(__dirname, 'output');

const DELAY_MS = 100;
const PROJECT_DELAY_MS = 3000;

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
      rejectUnauthorized: false
    };
    
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    }).on('error', reject);
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
  const stats = {
    total: houses.length,
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
  
  houses.forEach(house => {
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
  
  return { stats, forSaleByUnit, allByUnit };
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
  md += `| 楼栋数量 | ${buildings.length} 栋 |\n\n`;
  
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
    md += `| ${b.buildName} | ${floorDisplay} | ${b.stats.total} | ${b.stats.已售} | ${b.stats.可售} | ${b.stats.签约中} | ${rate}% | ${b.sellingCode} |\n`;
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
        const unitName = unit === '00' ? '商业/其他' : `${unit}单元`;
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
      const unitName = h.unit === '00' ? '商业' : `${h.unit}单元`;
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

async function processProject(projectID, projectName) {
  const buildData = await fetchWithRetry(`${BUILD_LIST_API}?searchConent=${projectID}&page=1`);
  
  if (!buildData.rows || buildData.rows.length === 0) {
    return { success: false, error: '无楼栋数据' };
  }
  
  const companyName = buildData.rows[0].CompanyName;
  const districtName = buildData.rows[0].DistrictName;
  
  const buildings = [];
  const allHouses = [];
  let totalStats = { total: 0, 已售: 0, 可售: 0, 签约中: 0, 抵押: 0, 查封: 0, 限制销售: 0, 超期锁定: 0, 不可售: 0 };
  let allForSale = [];
  
  for (const build of buildData.rows) {
    await sleep(DELAY_MS);
    
    try {
      const houses = await fetchWithRetry(`${HOUSE_DETAIL_API}?BuildID=${build.BuildID}`);
      const { stats, forSaleByUnit, allByUnit } = analyzeHouses(houses);
      
      const maxFloor = houses.length > 0 ? Math.max(...houses.map(h => h.AllFloor || 0)) : 0;
      
      buildings.push({
        buildID: build.BuildID,
        buildName: build.BuildName,
        sellingCode: build.SellingCode,
        houseCount: houses.length,
        allFloor: maxFloor,
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
      buildings.push({
        buildID: build.BuildID,
        buildName: build.BuildName,
        sellingCode: build.SellingCode,
        houseCount: 0,
        allFloor: 0,
        stats: { total: 0, 已售: 0, 可售: 0, 签约中: 0, 抵押: 0, 查封: 0, 限制销售: 0, 超期锁定: 0, 不可售: 0 },
        error: error.message
      });
    }
  }
  
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
  fs.writeFileSync(outputFile, mdContent, 'utf-8');
  
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
        port: 0,
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
      fs.writeFileSync(pdfFile, pdf.content);
    }
  } catch (pdfError) {
    console.log(`  PDF生成失败: ${pdfError.message}`);
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
  fs.writeFileSync(jsonFile, JSON.stringify(result, null, 2), 'utf-8');
  
  return { 
    success: true, 
    projectName, 
    companyName,
    districtName,
    buildingCount: buildings.length,
    totalStats 
  };
}

async function main() {
  const args = process.argv.slice(2);
  const startIndex = args[0] ? parseInt(args[0]) : 0;
  const maxCount = args[1] ? parseInt(args[1]) : null;
  
  console.log('========================================');
  console.log('批量抓取楼盘数据');
  console.log('========================================\n');
  
  if (!fs.existsSync(PROJECTS_FILE)) {
    console.error('错误: 未找到 projects_data.json 文件');
    console.log('请先运行 pnpm run fetch-projects 获取小区列表\n');
    process.exit(1);
  }
  
  const projectsData = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
  const projects = projectsData.projects || [];
  
  const uniqueProjects = [];
  const seenIDs = new Set();
  projects.forEach(p => {
    if (!seenIDs.has(p.ProjectID)) {
      seenIDs.add(p.ProjectID);
      uniqueProjects.push(p);
    }
  });
  
  const endIndex = maxCount ? Math.min(startIndex + maxCount, uniqueProjects.length) : uniqueProjects.length;
  const toProcess = uniqueProjects.slice(startIndex, endIndex);
  
  console.log(`总小区数: ${uniqueProjects.length}`);
  console.log(`本次处理: 第 ${startIndex + 1} 到 ${endIndex} 个，共 ${toProcess.length} 个\n`);
  
  const results = {
    success: [],
    failed: []
  };
  
  const startTime = Date.now();
  
  for (let i = 0; i < toProcess.length; i++) {
    const project = toProcess[i];
    const progress = `[${startIndex + i + 1}/${uniqueProjects.length}]`;
    
    console.log(`${progress} 开始处理: ${project.ProjectName} (ID: ${project.ProjectID})`);
    
    try {
      const result = await processProject(project.ProjectID, project.ProjectName);
      
      if (result.success) {
        console.log(`${progress} 完成: ${result.projectName} - ${result.buildingCount}栋楼, ${result.totalStats.total}套房源, 已售${result.totalStats.已售}, 可售${result.totalStats.可售}`);
        results.success.push({
          projectID: project.ProjectID,
          projectName: result.projectName,
          ...result.totalStats
        });
      } else {
        console.log(`${progress} 失败: ${result.error}`);
        results.failed.push({
          projectID: project.ProjectID,
          projectName: project.ProjectName,
          error: result.error
        });
      }
    } catch (error) {
      console.log(`${progress} 异常: ${error.message}`);
      results.failed.push({
        projectID: project.ProjectID,
        projectName: project.ProjectName,
        error: error.message
      });
    }
    
    if (i < toProcess.length - 1) {
      console.log(`  等待 ${PROJECT_DELAY_MS / 1000} 秒...\n`);
      await sleep(PROJECT_DELAY_MS);
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  console.log('\n========================================');
  console.log('抓取完成');
  console.log('========================================');
  console.log(`耗时: ${elapsed} 分钟`);
  console.log(`成功: ${results.success.length} 个`);
  console.log(`失败: ${results.failed.length} 个`);
  
  if (results.failed.length > 0) {
    console.log('\n失败列表:');
    results.failed.forEach(f => {
      console.log(`  - ${f.projectName} (${f.projectID}): ${f.error}`);
    });
  }
  
  const summaryFile = path.join(OUTPUT_DIR, `summary_${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(summaryFile, JSON.stringify({
    scrapeTime: new Date().toISOString(),
    elapsedMinutes: elapsed,
    total: uniqueProjects.length,
    processed: toProcess.length,
    success: results.success.length,
    failed: results.failed.length,
    results: results
  }, null, 2), 'utf-8');
  console.log(`\n汇总报告已保存到: ${summaryFile}\n`);
}

main();
