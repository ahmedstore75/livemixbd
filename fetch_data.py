import os
import json
import uuid
import requests

M3U_FILE = "toffee.m3u"
JSON_FILE = "toffee.json"
DATA_BACKUP_FILE = "toffee_backup.json"

SESSION_ID = str(uuid.uuid4())
DEVICE_ID = str(uuid.uuid4())[:16]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Referer": "https://toffeelive.com/",
    "Origin": "https://toffeelive.com",
    "X-Session-Id": SESSION_ID,
    "X-Device-Id": DEVICE_ID,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin"
}

API_ENDPOINT = "https://toffeelive.com/api/v1/channels"
BASE_CDN = "https://bldcmprod-cdn.toffeelive.com/cdn/live"
DEFAULT_LOGO = "https://toffeelive.com/images/icons/signin-prompt.svg"

all_channels = []

try:
    session = requests.Session()
    session.headers.update(HEADERS)
    session.get("https://toffeelive.com/", timeout=10)
    response = session.get(API_ENDPOINT, timeout=12)
    
    extracted_cookies = session.cookies.get_dict()
    cookie_str = "; ".join([f"{k}={v}" for k, v in extracted_cookies.items()])
    
    if not cookie_str:
        cookie_str = "Edge-Cache-Cookie=URLPrefix=aHR0cHM6Ly9ibGRjbXByb2QtY2RuLnRvZmZlZWxpdmUuY29t; Expires=1788598874; KeyName=edge-cache-key"

    if response.status_code == 200:
        res_data = response.json()
        raw_list = res_data.get("data", []) or res_data.get("channels", []) or res_data.get("results", [])
        
        for ch in raw_list:
            slug = str(ch.get("slug") or ch.get("channel_slug") or ch.get("id") or "").strip().lower().replace(" ", "_")
            if not slug:
                continue

            ch_name = ch.get("name") or ch.get("title") or ch.get("channel_name") or "Toffee Channel"
            ch_group = ch.get("category_name") or ch.get("category") or ch.get("genre") or "Toffee Live"
            
            logo = ch.get("logo") or ch.get("image_url") or ch.get("poster") or ch.get("logo_url") or DEFAULT_LOGO
            if logo and logo.startswith("/"):
                logo = f"https://toffeelive.com{logo}"

            all_channels.append({
                "id": slug,
                "name": ch_name,
                "group": ch_group,
                "logo": logo,
                "url": f"{BASE_CDN}/{slug}/playlist.m3u8",
                "user_agent": "okhttp/3.1.0",
                "cookie": cookie_str
            })
            
except Exception as e:
    print(f"Fetch Error: {e}")

# ব্যাকআপ সেভ ও লোড
if all_channels:
    with open(DATA_BACKUP_FILE, "w", encoding="utf-8") as bf:
        json.dump(all_channels, bf, ensure_ascii=False)
elif os.path.exists(DATA_BACKUP_FILE):
    with open(DATA_BACKUP_FILE, "r", encoding="utf-8") as bf:
        all_channels = json.load(bf)

# মূল M3U স্ট্রাকচার অনুযায়ী সেভ করা
m3u_content = "#EXTM3U\n"
for ch in sorted(all_channels, key=lambda x: x["group"]):
    m3u_content += f'#EXTINF:-1 tvg-id="{ch["id"]}" tvg-name="{ch["name"]}" tvg-logo="{ch["logo"]}" group-title="{ch["group"]}",{ch["name"]}\n'
    m3u_content += f'#EXTVLCOPT:http-user-agent={ch["user_agent"]}\n'
    if ch.get("cookie"):
        m3u_content += f'#EXTHTTP:{{"cookie":"{ch["cookie"]}"}}\n'
    m3u_content += f'{ch["url"]}\n\n'

with open(M3U_FILE, "w", encoding="utf-8") as f:
    f.write(m3u_content.strip())

print(f"সফলভাবে আগের মতো M3U ফরম্যাটে {len(all_channels)} টি চ্যানেল সেভ করা হয়েছে!")
