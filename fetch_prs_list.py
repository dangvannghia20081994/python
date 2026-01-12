import requests
import pandas as pd
import datetime
import os
from dotenv import load_dotenv

load_dotenv()
TOKEN = os.getenv("GITHUB_TOKEN") # Personal Access Token nếu repo private
HEADERS = {"Authorization": f"token {TOKEN}"} if TOKEN else {}

owner = os.getenv("OWNER")
repos = ["rezil-esms-lib", "rezil-esms", "rezil-esms-mobile"]

with open("urls.txt", "r") as f:
    exclude_prs = [line.strip() for line in f if line.strip()]

def format_date(date_str):
    if not date_str:
        return None
    return datetime.datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%SZ").strftime("%Y/%m/%d")

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
username = os.getenv("USER_NAME")  # username GitHub của bạn

for repo in repos:
    print(f"🔍 Đang xử lý repo: {repo}")
    page = 1
    while True:
        # gọi API list PR theo trang
        url = f"https://api.github.com/repos/{owner}/{repo}/pulls?state=all&per_page=100&page={page}"
        r = requests.get(url, headers=HEADERS)
        prs = r.json()

        # nếu không còn dữ liệu thì dừng
        if not prs or len(prs) == 0:
            print(f"✅ Repo {repo} đã hết dữ liệu (page {page})")
            break

        print(f"📄 Repo {repo} - Page {page} có {len(prs)} PR")

        for pr in prs:
            html_url = pr.get("html_url")
            if html_url not in exclude_prs and pr.get("user", {}).get("login") == username:
                pr_number = pr.get("number")
                print(f"➡️ Lấy chi tiết PR #{pr_number} từ {repo}")
                # gọi thêm API chi tiết để lấy additions/deletions
                detail_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}"
                detail = requests.get(detail_url, headers=HEADERS).json()

                data.append({
                    "Title": pr.get("title"),
                    "Author": "NghiaDV",
                    "URL": pr.get("html_url"),
                    "State": normalize_state(pr),
                    "Total Changes": (detail.get("additions", 0) + detail.get("deletions", 0)),
                    "Created At": format_date(pr.get("created_at")),
                    "Updated At": format_date(pr.get("updated_at"))
                })
        page += 1  # sang trang tiếp theo

# Xuất ra Excel
if data:
    now = datetime.datetime.now()
    date_str = now.strftime("%Y-%m-%d_%H-%M-%S")
    df = pd.DataFrame(data)
    df.to_excel(f"prs_list_{date_str}.xlsx", index=False)
    print(f"Đã xuất dữ liệu ra prs_list_{date_str}.xlsx")
else:
    print("⚠️ Không có data, không tạo file Excel.")
