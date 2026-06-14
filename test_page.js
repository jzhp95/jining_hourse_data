const https = require('https');

const BASE_URL = 'https://www.zwfw.jnszf.cn';
const BUILD_LIST_API = `${BASE_URL}/PortalSite/SpfQuery/GETSPFBuildList`;

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function test() {
  let allRows = [];
  let page = 1;

  while (true) {
    const data = await httpsGet(`${BUILD_LIST_API}?searchConent=00001312&page=${page}&pageSize=20`);
    if (!data.rows || data.rows.length === 0) break;

    if (page === 1) console.log('总楼栋:', data.total);
    allRows.push(...data.rows);
    console.log(`第${page}页: ${data.rows.length}条, 累计${allRows.length}条`);

    if (allRows.length >= data.total) break;
    page++;
  }
  console.log('最终获取:', allRows.length, '个楼栋');
  console.log('楼栋:', allRows.map(r => r.BuildName).join(', '));
}

test().catch(console.error);