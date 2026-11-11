
const API_BASE = window.APP_CONFIG.API_BASE_URL.replace(/\/$/, "");

const loginButton = document.querySelector("#login");
const notice = document.querySelector("#notice");

const accountForm = document.querySelector("#account-form");
const gameNameInput = document.querySelector("#game-name");
const tagLineInput = document.querySelector("#tag-line");
const regionInput = document.querySelector("#region");
const accountList = document.querySelector("#account-list");

const ownerIdKey = "valorant_notifier_owner_id";

function getOwnerId() {
  let ownerId = localStorage.getItem(ownerIdKey);

  if (!ownerId) {
    ownerId = crypto.randomUUID();
    localStorage.setItem(ownerIdKey, ownerId);
  }

  return ownerId;
}

const ownerId = getOwnerId();

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Owner-ID": ownerId,
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `API 오류 (${response.status})`);
  }

  return data;
}

function showNotice(message, isError = false) {
  notice.textContent = message;
  notice.style.color = isError ? "#ff4655" : "#c3a56f";
}

function renderAccounts(accounts) {
  accountList.replaceChildren();

  if (accounts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "account-empty";
    empty.textContent = "등록된 계정이 없습니다.";
    accountList.appendChild(empty);
    return;
  }

  for (const account of accounts) {
    const item = document.createElement("article");
    item.className = "account-item";

    const info = document.createElement("div");
    info.className = "account-info";

    const name = document.createElement("strong");
    name.textContent = `${account.game_name}#${account.tag_line}`;

    const detail = document.createElement("span");
    detail.textContent = `${account.region.toUpperCase()} · 테스트 계정`;

    info.append(name, detail);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "삭제";

    deleteButton.addEventListener("click", async () => {
      if (!confirm(`${account.game_name}#${account.tag_line} 계정을 삭제할까요?`)) {
        return;
      }

      try {
        await api(`/api/accounts/${account.id}`, {
          method: "DELETE"
        });

        showNotice("계정을 삭제했습니다.");
        await loadAccounts();
      } catch (error) {
        showNotice(error.message, true);
      }
    });

    item.append(info, deleteButton);
    accountList.appendChild(item);
  }
}

async function loadAccounts() {
  try {
    const data = await api("/api/accounts");
    renderAccounts(data.accounts || []);
  } catch (error) {
    showNotice(`계정 목록을 불러오지 못했습니다: ${error.message}`, true);
  }
}

accountForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const gameName = gameNameInput.value.trim();
  const tagLine = tagLineInput.value.trim();

  if (!gameName || !tagLine) {
    showNotice("Riot ID를 입력해 주세요.", true);
    return;
  }

  const submitButton = accountForm.querySelector("button[type='submit']");
  submitButton.disabled = true;

  try {
    await api("/api/accounts", {
      method: "POST",
      body: JSON.stringify({
        game_name: gameName,
        tag_line: tagLine,
        region: regionInput.value
      })
    });

    gameNameInput.value = "";
    tagLineInput.value = "";

    showNotice("테스트 계정을 등록했습니다.");
    await loadAccounts();
  } catch (error) {
    showNotice(`등록 실패: ${error.message}`, true);
  } finally {
    submitButton.disabled = false;
  }
});

loginButton.disabled = true;
loginButton.textContent = "Riot 공식 로그인 (승인 대기 중)";

loadAccounts();
