import requests

# Toffee API বা চ্যানেল সোর্সের ডেটা ফেচ করা
# (প্রয়োজন অনুযায়ী Toffee API URL এবং Headers আপডেট করুন)
API_URL = "https://toffeelive.com/api/v1/channels" 

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Origin": "https://toffeelive.com"
}

def generate_m3u():
    try:
        response = requests.get(API_URL, headers=headers)
        if response.status_code == 200:
            data = response.json()
            
            m3u_content = "#EXTM3U\n"
            
            # ডেটা প্রসেস করে M3U ফরম্যাটে সাজানো
            for channel in data.get("data", []):
                name = channel.get("channel_name", "Unknown Channel")
                logo = channel.get("logo_url", "")
                stream_url = channel.get("stream_url", "")
                
                m3u_content += f'#EXTINF:-1 tvg-logo="{logo}",{name}\n'
                m3u_content += f'{stream_url}\n\n'
            
            # ফাইল সেভ করা
            with open("playlist.m3u", "w", encoding="utf-8") as file:
                file.write(m3u_content)
                
            print("Playlist updated successfully!")
        else:
            print(f"Failed to fetch data: {response.status_code}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    generate_m3u()
