import requests

API_URL = "https://toffeelive.com/en/live" # আপনার ব্যবহৃত আসল API URL

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://toffeelive.com",
    "Referer": "https://toffeelive.com/"
}

def generate_m3u():
    try:
        response = requests.get(API_URL, headers=headers, timeout=15)
        
        # প্রিন্ট করে দেখুন সার্ভার থেকে কী রেসপন্স আসছে
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
            except ValueError:
                print("Error: Server did not return valid JSON. Response content:")
                print(response.text[:500]) # প্রথম ৫০০ ক্যারেক্টার প্রিন্ট করবে
                return

            m3u_content = "#EXTM3U\n"
            
            # আপনার API স্ট্রাকচার অনুযায়ী ডেটা পার্স করুন
            channels = data.get("data", [])
            if not channels:
                print("No channels found in response.")
                return

            for channel in channels:
                name = channel.get("channel_name", "Unknown Channel")
                logo = channel.get("logo_url", "")
                stream_url = channel.get("stream_url", "")
                
                if stream_url:
                    m3u_content += f'#EXTINF:-1 tvg-logo="{logo}",{name}\n'
                    m3u_content += f'{stream_url}\n\n'
            
            with open("playlist.m3u", "w", encoding="utf-8") as file:
                file.write(m3u_content)
                
            print("Playlist generated successfully!")
        else:
            print(f"HTTP Request Failed with Status Code: {response.status_code}")
            print(response.text[:300])

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    generate_m3u()
