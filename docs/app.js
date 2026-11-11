const loginButton = document.querySelector("#login");
const notice = document.querySelector("#notice");

async function checkApi() {
  const base = window.APP_CONFIG?.API_BASE_URL;
  if (!base) {
    notice.textContent = "백엔드 주소가 아직 설정되지 않았습니다. Cloudflare Worker 배포 후 config.js에 주소를 입력하세요.";
    return;
  }
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/health`);
    if (!response.ok) throw new Error("API unavailable");
    const data = await response.json();
    notice.textContent = `백엔드 연결 확인: ${data.status}`;
  } catch {
    notice.textContent = "백엔드에 연결할 수 없습니다. Worker 배포 상태를 확인하세요.";
  }
}

checkApi();
