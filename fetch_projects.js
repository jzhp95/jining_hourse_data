const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://www.zwfw.jnszf.cn';
const COMPANY_LIST_API = `${BASE_URL}/PortalSite/SpfQuery/GetAllCompanyNameList`;
const PROJECT_LIST_API = `${BASE_URL}/PortalSite/SpfQuery/GetCompanyAllProjectNameList`;
const OUTPUT_FILE = path.join(__dirname, 'projects_data.json');

const DELAY_MS = 100;

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
      console.error(`请求失败 (第 ${i + 1} 次尝试): ${error.message}`);
      if (i < retries - 1) {
        await sleep(DELAY_MS * (i + 1));
      } else {
        throw error;
      }
    }
  }
}

async function fetchCompanyList() {
  console.log('获取所有公司列表...');
  const data = await fetchWithRetry(COMPANY_LIST_API);
  console.log(`获取到 ${data.length} 家公司`);
  return data;
}

async function fetchProjectList(companyID) {
  const url = `${PROJECT_LIST_API}?CompanyID=${companyID}`;
  return await fetchWithRetry(url);
}

async function main() {
  console.log('========== 开始抓取小区项目数据 ==========\n');
  
  try {
    const companies = await fetchCompanyList();
    
    const allProjects = [];
    const companyProjectMap = {};
    
    console.log('\n开始获取每个公司下的项目列表...\n');
    
    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      console.log(`[${i + 1}/${companies.length}] 获取: ${company.CompanyName} (ID: ${company.CompanyID})`);
      
      await sleep(DELAY_MS);
      
      try {
        const projects = await fetchProjectList(company.CompanyID);
        
        if (projects && projects.length > 0) {
          companyProjectMap[company.CompanyID] = {
            companyName: company.CompanyName,
            companyID: company.CompanyID,
            projects: projects
          };
          
          allProjects.push(...projects.map(p => ({
            ...p,
            companyID: company.CompanyID,
            companyName: company.CompanyName
          })));
          
          console.log(`  -> 获取到 ${projects.length} 个项目`);
        } else {
          console.log(`  -> 无项目数据`);
        }
      } catch (error) {
        console.error(`  -> 获取失败: ${error.message}`);
      }
    }
    
    console.log('\n========== 抓取完成 ==========');
    console.log(`总共 ${companies.length} 家公司`);
    console.log(`总共 ${allProjects.length} 个项目`);
    
    const result = {
      scrapeTime: new Date().toISOString(),
      companiesCount: companies.length,
      projectsCount: allProjects.length,
      companies: companies,
      projects: allProjects,
      companyProjectMap: companyProjectMap
    };
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`\n数据已保存到: ${OUTPUT_FILE}`);
    
    return result;
    
  } catch (error) {
    console.error('抓取失败:', error);
    process.exit(1);
  }
}

main();
