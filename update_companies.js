const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const API_URL = 'https://www.zwfw.jnszf.cn/PortalSite/SpfQuery/GetAllCompanyNameList';

function updateProjectsData() {
  console.log('正在从API获取最新数据...');

  const response = execSync(`curl -k -s "${API_URL}"`, { encoding: 'utf8' });
  const companies = JSON.parse(response);

  console.log(`获取到 ${companies.length} 个公司数据`);

  const filePath = path.join(__dirname, 'projects_data.json');
  const existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const newData = {
    scrapeTime: new Date().toISOString(),
    companiesCount: companies.length,
    projectsCount: existingData.projectsCount || 0,
    companies: companies.map(c => ({
      CompanyID: c.CompanyID,
      CompanyName: c.CompanyName
    })),
    projects: existingData.projects || []
  };

  fs.writeFileSync(filePath, JSON.stringify(newData, null, 2), 'utf8');
  console.log(`已更新 projects_data.json`);
  console.log(`- 公司数量: ${newData.companiesCount}`);
  console.log(`- 项目数量: ${newData.projectsCount}`);
}

updateProjectsData();
