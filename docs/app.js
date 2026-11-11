
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

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderAccounts(accounts) {
  accountList.replaceChildren();

  if (accounts.length === 0) {
    accountList.appendChild(
      createElement("p", "account-empty", "등록된 계정이 없습니다.")
    );
    return;
  }

  for (const account of accounts) {
    const item = createElement("article", "account-item");

    const content = createElement("div", "account-content");

    const info = createElement("div", "account-info");
    info.append(
      createElement("strong", "", `${account.game_name}#${account.tag_line}`),
      createElement("span", "", `${account.region.toUpperCase()} · 테스트 계정`)
    );

    const webhookSection = createElement("div", "webhook-section");

    const webhookLabel = createElement("label", "", "Discord Webhook URL");
    const webhookInput = createElement("input", "webhook-input");
    webhookInput.type = "password";
    webhookInput.placeholder = "https://discord.com/api/webhooks/...";
    webhookInput.autocomplete = "off";

    const webhookActions = createElement("div", "webhook-actions");

    const saveButton = createElement("button", "webhook-save", "Webhook 저장");
    saveButton.type = "button";

    const deleteWebhookButton = createElement(
      "button",
      "webhook-delete",
      "Webhook 삭제"
    );
    deleteWebhookButton.type = "button";

    const webhookStatus = createElement(
      "span",
      "webhook-status",
      account.webhook_configured
        ? "Webhook 등록됨"
        : "Webhook 미등록"
    );

    saveButton.addEventListener("click", async () => {
      const webhookUrl = webhookInput.value.trim();

      if (!webhookUrl) {
        showNotice("Webhook URL을 입력해 주세요.", true);
        return;
      }

      saveButton.disabled = true;

      try {
        await api(`/api/accounts/${account.id}/webhook`, {
          method: "POST",
          body: JSON.stringify({ webhook_url: webhookUrl })
        });

        webhookInput.value = "";
        webhookStatus.textContent = "Webhook 등록됨";
        showNotice("Discord Webhook을 암호화하여 저장했습니다.");
      } catch (error) {
        showNotice(`Webhook 저장 실패: ${error.message}`, true);
      } finally {
        saveButton.disabled = false;
      }
    });

    deleteWebhookButton.addEventListener("click", async () => {
      if (!confirm("등록된 Discord Webhook을 삭제할까요?")) return;

      deleteWebhookButton.disabled = true;

      try {
        await api(`/api/accounts/${account.id}/webhook`, {
          method: "DELETE"
        });

        webhookStatus.textContent = "Webhook 미등록";
        webhookInput.value = "";
        showNotice("Discord Webhook을 삭제했습니다.");
      } catch (error) {
        showNotice(`Webhook 삭제 실패: ${error.message}`, true);
      } finally {
        deleteWebhookButton.disabled = false;
      }
    });

    webhookActions.append(saveButton, deleteWebhookButton);
    webhookSection.append(webhookLabel, webhookInput, webhookActions, webhookStatus);

    const deleteAccountButton = createElement(
      "button",
      "delete-button",
      "계정 삭제"
    );
    deleteAccountButton.type = "button";

    deleteAccountButton.addEventListener("click", async () => {
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

    content.append(info, webhookSection);
    item.append(content, deleteAccountButton);
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
