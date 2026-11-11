import os
import sys
import urllib.request
import urllib.error

worker_url = os.environ.get("WORKER_URL", "").rstrip("/")
poll_secret = os.environ.get("POLL_SECRET", "")

if not worker_url or not poll_secret:
    print("WORKER_URL and POLL_SECRET GitHub Actions secrets are required.")
    sys.exit(1)

request = urllib.request.Request(
    f"{worker_url}/internal/poll",
    data=b"{}",
    headers={
        "Authorization": f"Bearer {poll_secret}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; ValorantMatchChecker/1.0)",
    },
    method="POST",
)

try:
    with urllib.request.urlopen(request, timeout=30) as response:
        print(response.read().decode("utf-8"))
except urllib.error.HTTPError as error:
    body = error.read().decode("utf-8", errors="replace")
    # 501 is expected until Riot API access and polling are implemented.
    if error.code == 501:
        print(f"Polling scaffold is deployed but not configured yet: {body}")
    else:
        print(f"Worker request failed ({error.code}): {body}")
        sys.exit(1)
