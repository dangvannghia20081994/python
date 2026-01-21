import requests
import pandas as pd
import datetime
import os
from dotenv import load_dotenv
from tqdm import tqdm   # 👈 thêm tqdm

load_dotenv()
TOKEN = os.getenv("GITHUB_TOKEN")
HEADERS = {"Authorization": f"token {TOKEN}"} if TOKEN else {}

owner = os.getenv("OWNER")
repos = ["rezil-esms-lib", "rezil-esms", "rezil-esms-mobile"]

with open("urls.txt", "r") as f:
    exclude_prs = [line.strip() for line in f if line.strip()]

def format_date(date_str):
    if not date_str:
        return None
    return datetime.datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%SZ").strftime("%Y/%m/%d")

def format_updated_at(created_at, updated_at):
  if not updated_at:
    return None
  if format_date(created_at) == format_date(updated_at):
    return None
  return format_date(updated_at)

def normalize_state(info):
    if info.get("draft"):
        return "Draft"
    elif info.get("merged_at"):
        return "Merged"
    elif info.get("state") == "open":
        return "Open"
    elif info.get("state") == "closed":
        return "Closed"
    return info.get("state").capitalize() if info.get("state") else None

data = []
username = os.getenv("USER_NAME")
usernameDisplay = os.getenv("USER_NAME_DISPLAY")
print(f"Hello: {username} - ({usernameDisplay}). Scanning...")

for repo in repos:
    print(f"🔍 Đang xử lý repo: {repo}")
    page = 1
    while True:
        url = f"https://api.github.com/repos/{owner}/{repo}/pulls?state=all&per_page=100&page={page}"
        r = requests.get(url, headers=HEADERS)
        prs = r.json()

        # Nếu API trả về dict có key "message" thì đó là lỗi
        if isinstance(prs, dict) and "message" in prs:
            print(f"⚠️ Lỗi API: {prs.get('message')} - {url}")
            break

        # Nếu không phải list thì cũng bỏ qua
        if not isinstance(prs, list):
            print(f"⚠️ Dữ liệu không phải list: {prs}")
            break

        if not prs or len(prs) == 0:
            print(f"✅ Repo {repo} đã hết dữ liệu (page {page})")
            break

        # 👇 hiển thị progress bar cho từng page
        for pr in tqdm(prs, desc=f"{repo} - Page {page}"):
            html_url = pr.get("html_url")
            if html_url not in exclude_prs and pr.get("user", {}).get("login") == username:
                pr_number = pr.get("number")
                detail_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}"
                detail = requests.get(detail_url, headers=HEADERS).json()

                data.append({
                    "Repo": repo,
                    "Title": pr.get("title"),
                    "Author": usernameDisplay,
                    "URL": pr.get("html_url"),
                    "State": normalize_state(pr),
                    "Total Changes": (detail.get("additions", 0) + detail.get("deletions", 0)),
                    "Created At": format_date(pr.get("created_at")),
                    "Updated At": format_updated_at(pr.get("created_at"), pr.get("updated_at"))
                })
        page += 1

# Xuất ra Excel
if data:
    now = datetime.datetime.now()
    date_str = now.strftime("%Y-%m-%d_%H-%M-%S")
    df = pd.DataFrame(data)
    df.to_excel(f"prs_list_{date_str}.xlsx", index=False)
    print(f"✅ Đã xuất dữ liệu ra prs_list_{date_str}.xlsx (tổng cộng {len(data)} PR)")
else:
    print("⚠️ Không có data, không tạo file Excel.")
